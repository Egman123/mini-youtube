const express = require('express');

const app = express();
app.use(express.json());

const db = require('./database');

app.get('/', (req, res) => {
    res.send('Welcome to Mini Youtube!')
})

app.get('/videos', (req, res) => {
   const page = Number(req.query.page ?? 1); 
   const limit = Number(req.query.limit ?? 10);
   const sort = req.query.sort ?? 'newest'

   if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({
        error: 'Page must be a positive integer'
    })
   }
   
   if (!Number.isInteger(limit) || limit < 1) {
     return res.status(400).json({
        error: 'limit must be a positive integer'
     })
   }

   if (sort !== 'newest' && sort !== 'views') {
    return res.status(400).json({
        error: 'sort must be newest or views'
    })
   }

   const offset = (page - 1) * limit;
   const result = db.prepare(
      'SELECT COUNT(*) AS total FROM videos'
   ).get()

   const totalPages = Math.ceil(result.total / limit);
   if (totalPages > 0 && page > totalPages) {
      return res.status(400).json({
        error: 'Page does not exist'
      })
   } 

   let videos;

   if (sort === 'views') {
    videos = db.prepare(
        'SELECT * FROM videos ORDER BY views DESC LIMIT ? OFFSET ?'
    ).all(limit, offset)
   } else {
    videos = db.prepare(
        'SELECT * FROM videos ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) 
   }

   res.json({
    videos,
    total: result.total,
    totalPages
   })
})

app.post('/videos', (req, res) => {
   const newVideo = req.body;
   
   if (!newVideo.title || !newVideo.title.trim()) {
    return res.status(400).json({
        error: 'Video title is required'
    });
   }

   if (newVideo.title.trim().length > 100) {
     return res.status(400).json({
        error: 'Video title must be 100 characters or fewer'
     })
   }

   if (
       newVideo.views !== undefined && 
       (
        typeof newVideo.views !== 'number' ||
        !Number.isInteger(newVideo.views) ||
        newVideo.views < 0
       )
   ) {
    return res.status(400).json({
        error: 'Views must be a non-negative integer'
    })
   }

   const result = db.prepare(
     'INSERT INTO videos (title, views) VALUES (?, ?)'
   ).run(newVideo.title.trim(), newVideo.views ?? 0);

   const savedVideo = db.prepare(
    'SELECT * FROM videos WHERE id = ?'
   ).get(result.lastInsertRowid);

   res.status(201).json(savedVideo);
})

app.get('/videos/search', (req, res) => {
    const query = req.query.q;
    const minViewsParam = req.query.minViews;
    const limitParam = req.query.limit;
    const limit = limitParam === undefined ? 10 : Number(limitParam)
    const page = Number(req.query.page ?? 1);

    if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({
            error: 'page must be a positive integer'
        });
    }

    if (!Number.isInteger(limit) || limit < 1) {
        return res.status(400).json({
            error: 'limit must be a positive integer'
        })
    }

    if (typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({
            error: 'Search query is required'
        })
    }

    let minViews;
    
    if (minViewsParam !== undefined) {
       if (Array.isArray(minViewsParam)) {
         return res.status(400).json({
            error: 'minViews must be a single number'
         })
       }

       minViews = Number(minViewsParam);

       if (
         !Number.isInteger(minViews) || 
         minViews < 0
       ) {
         return res.status(400).json({
            error: 'minViews must be a non-negative integer'
         }) 
       }
    }

    const offset = (page - 1) * limit;
    const cleanQuery = query.trim();

    let videos;
    let total;

    if (minViews === undefined) {
        total = db.prepare(
            'SELECT COUNT(*) AS total FROM videos WHERE title LIKE ?'
        ).get(`%${cleanQuery}%`).total;
        videos = db.prepare(
            'SELECT * FROM videos WHERE title LIKE ? ORDER BY views DESC, id DESC LIMIT ? OFFSET ?'
        ).all(`%${cleanQuery}%`, limit, offset)
    } else {
       total = db.prepare(
        'SELECT COUNT(*) AS total FROM videos WHERE title LIKE ? AND views >= ?'
       ).get(`%${cleanQuery}%`, minViews).total;
       videos = db.prepare(
          'SELECT * FROM videos WHERE title LIKE ? AND views >= ? ORDER BY views DESC, id DESC LIMIT ? OFFSET ?'
       ).all(`%${cleanQuery}%`, minViews, limit, offset)
    }
    
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    if (total > 0 && page > totalPages) {
        return res.status(400).json({
            error: 'Page exceeds total pages'
        });
    }

    res.json({
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        videos
    })
});

app.post('/videos/:id/view', (req, res) => {
   const id = Number(req.params.id);

   if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid video ID'
      });
   }

   const result = db.prepare(
       'UPDATE videos SET views = views + 1 WHERE id = ?'
   ).run(id)

   if (result.changes === 0) {
      return res.status(404).json({
        error: 'Video not found'
      })
   }

   const video = db.prepare(
      'SELECT * FROM videos WHERE id = ?'
   ).get(id)

   res.json(video);
})



app.get('/videos/:id', (req, res) => {
    const id = Number(req.params.id);
    
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Invalid video ID'
        })
    }

    const video = db.prepare(
        'SELECT * FROM videos WHERE id = ?'
    ).get(id)

    if (!video) {
        return res.status(404).json({
            error: 'Video not found'
        });
    }

    res.json(video);
})

app.delete('/videos/:id', (req, res) => {
   const id = Number(req.params.id);
   
   if (!Number.isInteger(id) || id <= 0) {
       return res.status(400).json({
         error: 'Invalid video ID'
       })
   }

   const result = db.prepare(
       'DELETE FROM videos WHERE id = ?'
   ).run(id);

   if (result.changes === 0) {
     return res.status(404).json({
        error: 'Video not found'
     })
   }

   res.status(204).send();
})

app.patch('/videos/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Invalid video ID'
        })
    }
    
    if (
        req.body === null ||
        typeof req.body !== 'object' ||
        Array.isArray(req.body)
    ) {
        return res.status(400).json({
            error: 'Request body must be a JSON object'
        })
    }

    const { title, views } = req.body;
    
    if (title === undefined && views === undefined) {
        return res.status(400).json({
            error: 'At least one field (title or views) is required'
        })
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
            error: 'Video title must be a non-empty string'
        });
      }

      if (title.trim().length > 100) {
        return res.status(400).json({
            error: 'Video title must be 100 characters or fewer'
        })
      }
    }
 
    if (
       views !== undefined &&
       (
        typeof views !== 'number' ||
        !Number.isInteger(views) ||
        views < 0
       )
    ) {
        return res.status(400).json({
           error: 'Views must be a non-negative integer'
        })
    }
    
    const existingVideo = db.prepare(
        'SELECT * FROM videos WHERE id = ?'
    ).get(id)

    if (!existingVideo) {
        return res.status(404).json({
            error: 'Video not found'
        });
    }

    const result = db.prepare(
        'UPDATE videos SET title = ?, views = ? WHERE id = ?'
    ).run(
        title === undefined ? existingVideo.title : title.trim(),
        views ?? existingVideo.views,
        id
    );

    if (result.changes === 0) {
        return res.status(404).json({
            error: 'Video not found'
        })
    }

    const video = db.prepare(
        'SELECT * FROM videos WHERE id = ?'
    ).get(id);

    res.json(video);
})

app.post('/videos/:id/like', (req, res) => {
    const id = Number(req.params.id);

    const video = db.prepare(
        'SELECT * FROM videos WHERE id = ?'
    ).get(id);

    if(!video) {
        return res.status(404).json({
            error: 'Video not found'
        })
    }

    db.prepare(
        'Update videos SET likes = likes + 1 WHERE id = ?'
    ).run(id)

    const updatedVideo = db.prepare(
        'SELECT * FROM videos WHERE id = ?'
    ).get(id);

    res.json(updatedVideo);
})

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'Invalid JSON'
        });
    }

   console.error(err)

    res.status(500).json({
    error: 'Internal server error'
   })
})

app.listen(3000, () => {
    console.log("Mini YouTube server is running on port 3000");
})
