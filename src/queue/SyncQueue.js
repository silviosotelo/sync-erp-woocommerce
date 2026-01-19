const SQLiteDatabase = require('../database/sqlite');

class SyncQueue {
  constructor(dbPath) {
    this.sqlite = new SQLiteDatabase(dbPath);
    this.db = this.sqlite.getDatabase();
  }

  add(product, syncType = 'update') {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_queue
      (art_cod_int, product_name, product_data, sync_type, status, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'))
    `);

    return stmt.run(
      product.art_cod_int,
      product.art_nombre || product.art_nombre_web || 'Sin nombre',
      JSON.stringify(product),
      syncType
    );
  }

  addBatch(products, syncType = 'update') {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO sync_queue
      (art_cod_int, product_name, product_data, sync_type, status, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'))
    `);

    const insertMany = this.db.transaction((items) => {
      for (const product of items) {
        insert.run(
          product.art_cod_int,
          product.art_nombre || product.art_nombre_web || 'Sin nombre',
          JSON.stringify(product),
          syncType
        );
      }
    });

    return insertMany(products);
  }

  getNext() {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE status = 'pending'
      AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT 1
    `);

    const row = stmt.get();
    if (!row) return null;

    try {
      row.product_data = JSON.parse(row.product_data);
    } catch (e) {
      row.product_data = {};
    }

    return row;
  }

  markAsProcessing(artCodInt) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'processing', updated_at = datetime('now')
      WHERE art_cod_int = ?
    `);

    return stmt.run(artCodInt);
  }

  markAsCompleted(artCodInt) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'completed',
          processed_at = datetime('now'),
          updated_at = datetime('now'),
          error_message = NULL
      WHERE art_cod_int = ?
    `);

    return stmt.run(artCodInt);
  }

  markAsFailed(artCodInt, errorMessage) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'failed',
          error_message = ?,
          updated_at = datetime('now')
      WHERE art_cod_int = ?
    `);

    return stmt.run(errorMessage, artCodInt);
  }

  incrementAttempts(artCodInt) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET attempts = attempts + 1,
          status = 'pending',
          updated_at = datetime('now')
      WHERE art_cod_int = ?
    `);

    return stmt.run(artCodInt);
  }

  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY status
    `);

    const rows = stmt.all();
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };

    rows.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });

    return stats;
  }

  getStatsToday() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
      FROM sync_queue
      WHERE date(updated_at) = date('now')
    `);

    const result = stmt.get();

    const successRate = result.total > 0
      ? ((result.completed / result.total) * 100).toFixed(2)
      : 0;

    return {
      ...result,
      success_rate: parseFloat(successRate)
    };
  }

  getAllFailed() {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE status = 'failed'
      ORDER BY updated_at DESC
    `);

    return stmt.all().map(row => {
      try {
        row.product_data = JSON.parse(row.product_data);
      } catch (e) {
        row.product_data = {};
      }
      return row;
    });
  }

  retryFailed() {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'pending',
          attempts = 0,
          error_message = NULL,
          updated_at = datetime('now')
      WHERE status = 'failed'
    `);

    return stmt.run();
  }

  retrySingle(artCodInt) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'pending',
          attempts = 0,
          error_message = NULL,
          updated_at = datetime('now')
      WHERE art_cod_int = ? AND status = 'failed'
    `);

    return stmt.run(artCodInt);
  }

  cleanOldCompleted(days = 7) {
    const stmt = this.db.prepare(`
      DELETE FROM sync_queue
      WHERE status = 'completed'
      AND processed_at < datetime('now', '-${days} days')
    `);

    return stmt.run();
  }

  getAverageDuration() {
    const stmt = this.db.prepare(`
      SELECT AVG(
        (julianday(processed_at) - julianday(created_at)) * 86400000
      ) as avg_ms
      FROM sync_queue
      WHERE status = 'completed'
      AND processed_at > datetime('now', '-1 day')
    `);

    const result = stmt.get();
    return result?.avg_ms || 300;
  }

  countByStatus(status) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM sync_queue
      WHERE status = ?
    `);

    return stmt.get(status)?.count || 0;
  }

  getPage(page = 1, limit = 20, filters = {}) {
    let whereClause = '1=1';
    const params = [];

    if (filters.status && filters.status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      whereClause += ' AND (art_cod_int LIKE ? OR product_name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const offset = (page - 1) * limit;

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM sync_queue WHERE ${whereClause}
    `);
    const countResult = countStmt.get(...params);

    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE ${whereClause}
      ORDER BY
        CASE status
          WHEN 'processing' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'failed' THEN 3
          WHEN 'completed' THEN 4
        END,
        updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const data = stmt.all(...params, limit, offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    };
  }

  addHistory(batchId, stats, startTime, triggerType = 'manual') {
    const duration = Date.now() - startTime;

    const stmt = this.db.prepare(`
      INSERT INTO sync_history
      (batch_id, total_products, successful, failed, duration_ms, started_at, completed_at, trigger_type)
      VALUES (?, ?, ?, ?, ?, datetime(?, 'unixepoch', 'subsec'), datetime('now'), ?)
    `);

    return stmt.run(
      batchId,
      stats.total,
      stats.successful,
      stats.failed,
      duration,
      Math.floor(startTime / 1000),
      triggerType
    );
  }

  getHistory(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_history
      ORDER BY completed_at DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  addError(artCodInt, errorType, errorMessage, stackTrace) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_errors
      (art_cod_int, error_type, error_message, stack_trace)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(artCodInt, errorType, errorMessage, stackTrace);
  }

  getRecentErrors(hours = 24) {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_errors
      WHERE created_at > datetime('now', '-${hours} hours')
      AND resolved = 0
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return stmt.all();
  }

  markErrorResolved(errorId) {
    const stmt = this.db.prepare(`
      UPDATE sync_errors
      SET resolved = 1
      WHERE id = ?
    `);

    return stmt.run(errorId);
  }

  updateDailyStats(date, stats) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_stats (date, total_synced, successful, failed, avg_duration_ms)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_synced = total_synced + excluded.total_synced,
        successful = successful + excluded.successful,
        failed = failed + excluded.failed,
        avg_duration_ms = (avg_duration_ms + excluded.avg_duration_ms) / 2
    `);

    return stmt.run(
      date,
      stats.total,
      stats.successful,
      stats.failed,
      stats.avg_duration_ms || 0
    );
  }

  getStatsLast7Days() {
    const stmt = this.db.prepare(`
      SELECT
        date,
        total_synced,
        successful,
        failed,
        avg_duration_ms
      FROM sync_stats
      WHERE date >= date('now', '-7 days')
      ORDER BY date ASC
    `);

    return stmt.all();
  }

  getStuckProcessing(timeoutMinutes = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE status = 'processing'
      AND updated_at < datetime('now', '-${timeoutMinutes} minutes')
    `);

    return stmt.all();
  }

  resetStuckProcessing() {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'pending',
          updated_at = datetime('now')
      WHERE status = 'processing'
      AND updated_at < datetime('now', '-10 minutes')
    `);

    return stmt.run();
  }

  close() {
    this.sqlite.close();
  }
}

module.exports = SyncQueue;
