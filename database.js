const Database = require('better-sqlite3');

const db = new Database('youtube.db');
db.pragma('foreign_keys = ON');

db.exec(`
   CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0
   ) 
`);

const columns = db.prepare('PRAGMA table_info(videos)').all();

if (!columns.some(column => column.name === 'likes')) {
   db.exec(`
       ALTER TABLE videos
       ADD COLUMN likes INTEGER NOT NULL DEFAULT 0
      `);
}

db.exec(`
   CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      videoId INTEGER NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (videoId) REFERENCES videos(id)
   )   
`);

module.exports = db;