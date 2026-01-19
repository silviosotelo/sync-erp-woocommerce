class DailyReportGenerator {
  constructor(queue, logger) {
    this.queue = queue;
    this.logger = logger;
  }

  async generateReport(date) {
    try {
      const dateStr = this.formatDate(date);

      const history = await this.getHistoryForDate(dateStr);
      const stats = await this.getStatsForDate(dateStr);
      const topErrors = await this.getTopErrors(dateStr);
      const hourlyDistribution = await this.getHourlyDistribution(dateStr);
      const weeklyComparison = await this.getWeeklyComparison(date);

      const totalBatches = history.length;
      const totalProducts = stats.reduce((sum, s) => sum + s.total_synced, 0);
      const successful = stats.reduce((sum, s) => sum + s.successful, 0);
      const failed = stats.reduce((sum, s) => sum + s.failed, 0);
      const totalDuration = history.reduce((sum, h) => sum + h.duration_ms, 0);
      const avgDuration = stats.length > 0
        ? Math.round(stats.reduce((sum, s) => sum + s.avg_duration_ms, 0) / stats.length)
        : 0;

      return {
        date: dateStr,
        totalBatches,
        totalProducts,
        successful,
        failed,
        totalDuration,
        avgDuration,
        topErrors,
        hourlyDistribution,
        weeklyComparison
      };
    } catch (error) {
      this.logger.error('Error generating daily report:', error);
      throw error;
    }
  }

  async getHistoryForDate(dateStr) {
    const db = this.queue.db;
    const stmt = db.prepare(`
      SELECT * FROM sync_history
      WHERE date(started_at) = ?
      ORDER BY started_at DESC
    `);

    return stmt.all(dateStr);
  }

  async getStatsForDate(dateStr) {
    const db = this.queue.db;
    const stmt = db.prepare(`
      SELECT * FROM sync_stats
      WHERE date = ?
    `);

    return stmt.all(dateStr);
  }

  async getTopErrors(dateStr) {
    const db = this.queue.db;
    const stmt = db.prepare(`
      SELECT
        error_type as type,
        COUNT(*) as count
      FROM sync_errors
      WHERE date(created_at) = ?
      GROUP BY error_type
      ORDER BY count DESC
      LIMIT 5
    `);

    return stmt.all(dateStr);
  }

  async getHourlyDistribution(dateStr) {
    const db = this.queue.db;
    const stmt = db.prepare(`
      SELECT
        strftime('%H:00', created_at) as hour,
        COUNT(*) as count
      FROM sync_queue
      WHERE date(created_at) = ?
      AND status = 'completed'
      GROUP BY hour
      ORDER BY hour
    `);

    return stmt.all(dateStr);
  }

  async getWeeklyComparison(date) {
    const db = this.queue.db;
    const results = [];

    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(date);
      targetDate.setDate(targetDate.getDate() - i);
      const dateStr = this.formatDate(targetDate);

      const stmt = db.prepare(`
        SELECT
          date,
          total_synced,
          successful,
          failed
        FROM sync_stats
        WHERE date = ?
      `);

      const stat = stmt.get(dateStr);

      const dayName = targetDate.toLocaleDateString('es-PY', { weekday: 'short' });
      const products = stat ? stat.total_synced : 0;
      const successRate = stat && stat.total_synced > 0
        ? ((stat.successful / stat.total_synced) * 100).toFixed(1)
        : 0;

      results.push({
        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        products,
        successRate,
        isToday: i === 0
      });
    }

    return results;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}

module.exports = DailyReportGenerator;
