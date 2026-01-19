const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class SQLiteDatabase {
  constructor(dbPath = './data/sync_queue.db') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initDatabase();
  }

  initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        art_cod_int TEXT NOT NULL UNIQUE,
        product_name TEXT,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        product_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        sync_type TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        total_products INTEGER,
        successful INTEGER,
        failed INTEGER,
        duration_ms INTEGER,
        started_at DATETIME,
        completed_at DATETIME,
        trigger_type TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        art_cod_int TEXT,
        error_type TEXT,
        error_message TEXT,
        stack_trace TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sync_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE,
        total_synced INTEGER DEFAULT 0,
        successful INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        avg_duration_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_queue_art_cod ON sync_queue(art_cod_int);
      CREATE INDEX IF NOT EXISTS idx_history_batch ON sync_history(batch_id);
      CREATE INDEX IF NOT EXISTS idx_stats_date ON sync_stats(date);
      CREATE INDEX IF NOT EXISTS idx_errors_resolved ON sync_errors(resolved);
    `);
  }

  getDatabase() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

module.exports = SQLiteDatabase;
