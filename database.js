const Database = require('better-sqlite3');

const db = new Database('youtube.db');

db.exec(`
   CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0
   ) 
`);

module.exports = db;