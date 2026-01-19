class QueueController {
  constructor(queue, logger) {
    this.queue = queue;
    this.logger = logger;
  }

  async getStats(req, res) {
    try {
      const stats = this.queue.getStats();
      const statsToday = this.queue.getStatsToday();
      const avgDuration = this.queue.getAverageDuration();

      const pending = stats.pending || 0;
      const eta = pending > 0 ? this.calculateETA(pending, avgDuration) : null;

      res.json({
        ...stats,
        ...statsToday,
        avg_duration: avgDuration,
        eta
      });
    } catch (error) {
      this.logger.error('Error getting queue stats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getQueue(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {
        status: req.query.status || 'all',
        search: req.query.search || ''
      };

      const result = this.queue.getPage(page, limit, filters);

      res.json(result);
    } catch (error) {
      this.logger.error('Error getting queue:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async retryFailed(req, res) {
    try {
      const result = this.queue.retryFailed();

      res.json({
        success: true,
        count: result.changes
      });
    } catch (error) {
      this.logger.error('Error retrying failed:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async retrySingle(req, res) {
    try {
      const { artCodInt } = req.params;
      const result = this.queue.retrySingle(artCodInt);

      res.json({
        success: true,
        art_cod_int: artCodInt,
        modified: result.changes > 0
      });
    } catch (error) {
      this.logger.error('Error retrying single product:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async cleanCompleted(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = this.queue.cleanOldCompleted(days);

      res.json({
        success: true,
        deleted: result.changes
      });
    } catch (error) {
      this.logger.error('Error cleaning completed:', error);
      res.status(500).json({ error: error.message });
    }
  }

  calculateETA(pending, avgDurationMs) {
    const totalMs = pending * avgDurationMs;
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

module.exports = QueueController;
