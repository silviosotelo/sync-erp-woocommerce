class StatsController {
  constructor(queue, logger) {
    this.queue = queue;
    this.logger = logger;
  }

  async getToday(req, res) {
    try {
      const stats = this.queue.getStatsToday();

      res.json(stats);
    } catch (error) {
      this.logger.error('Error getting today stats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getLast7Days(req, res) {
    try {
      const stats = this.queue.getStatsLast7Days();

      res.json(stats);
    } catch (error) {
      this.logger.error('Error getting 7 days stats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const history = this.queue.getHistory(limit);

      res.json({ batches: history });
    } catch (error) {
      this.logger.error('Error getting history:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = StatsController;
