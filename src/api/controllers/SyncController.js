class SyncController {
  constructor(syncService, logger) {
    this.syncService = syncService;
    this.logger = logger;
  }

  async startSync(req, res) {
    try {
      const result = await this.syncService.startSync();

      res.json({
        success: true,
        batch_id: result.batchId,
        message: 'Sincronización iniciada'
      });
    } catch (error) {
      this.logger.error('Error starting sync:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async triggerReindex(req, res) {
    try {
      await this.syncService.triggerReindex();

      res.json({
        success: true,
        message: 'Reindexación iniciada'
      });
    } catch (error) {
      this.logger.error('Error triggering reindex:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getStatus(req, res) {
    try {
      const status = await this.syncService.getStatus();

      res.json(status);
    } catch (error) {
      this.logger.error('Error getting sync status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = SyncController;
