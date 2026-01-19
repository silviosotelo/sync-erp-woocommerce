const templates = require('./templates');

class WhatsAppNotifier {
  constructor(whatsappClient, logger) {
    this.client = whatsappClient;
    this.logger = logger;
    this.enabled = process.env.WHATSAPP_ENABLED === 'true';
    this.number = process.env.WHATSAPP_NUMBER;
  }

  async sendSyncStarted(batchId, totalProducts) {
    if (!this.enabled) return;

    try {
      const message = templates.syncStarted(batchId, totalProducts);
      await this.sendMessage(message);
      this.logger.info(`WhatsApp notification sent: Sync started (${batchId})`);
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error);
    }
  }

  async sendSyncCompleted(batchId, stats) {
    if (!this.enabled) return;

    try {
      const message = templates.syncCompleted(batchId, stats);
      await this.sendMessage(message);
      this.logger.info(`WhatsApp notification sent: Sync completed (${batchId})`);
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error);
    }
  }

  async sendSyncError(batchId, errorInfo) {
    if (!this.enabled) return;

    try {
      const message = templates.syncError(batchId, errorInfo);
      await this.sendMessage(message);
      this.logger.info(`WhatsApp notification sent: Sync error (${batchId})`);
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error);
    }
  }

  async sendCriticalError(errorInfo) {
    if (!this.enabled) return;

    try {
      const message = templates.criticalError(errorInfo);
      await this.sendMessage(message);
      this.logger.info('WhatsApp notification sent: Critical error');
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error);
    }
  }

  async sendQueueBlocked(stuckProducts) {
    if (!this.enabled) return;

    try {
      const message = templates.queueBlocked(stuckProducts);
      await this.sendMessage(message);
      this.logger.info('WhatsApp notification sent: Queue blocked');
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error);
    }
  }

  async sendDailyReport(reportData) {
    if (!this.enabled) return;

    try {
      const message = templates.dailyReport(reportData);
      await this.sendMessage(message);
      this.logger.info('WhatsApp notification sent: Daily report');
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error);
    }
  }

  async sendMessage(text) {
    if (!this.client || !this.number) {
      this.logger.warn('WhatsApp client or number not configured');
      return;
    }

    const jid = this.formatPhoneNumber(this.number);
    await this.client.sendMessage(jid, { text });
  }

  formatPhoneNumber(number) {
    const cleaned = number.replace(/\D/g, '');
    return `${cleaned}@s.whatsapp.net`;
  }
}

module.exports = WhatsAppNotifier;
