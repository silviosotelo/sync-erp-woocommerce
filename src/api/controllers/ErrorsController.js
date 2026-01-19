class ErrorsController {
  constructor(queue, logger) {
    this.queue = queue;
    this.logger = logger;
  }

  async getRecent(req, res) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const errors = this.queue.getRecentErrors(hours);

      res.json(errors);
    } catch (error) {
      this.logger.error('Error getting recent errors:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async markResolved(req, res) {
    try {
      const { errorId } = req.params;
      this.queue.markErrorResolved(errorId);

      res.json({
        success: true,
        error_id: errorId
      });
    } catch (error) {
      this.logger.error('Error marking error as resolved:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ErrorsController;
