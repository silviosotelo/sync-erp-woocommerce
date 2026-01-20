const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const https = require('https');

class SyncService {
  constructor(erpConfig, queue, processor, validator, notifier, logger, io) {
    this.erpEndpoint = erpConfig.endpoint || process.env.ERP_ENDPOINT;
    this.erpTimeout = parseInt(process.env.ERP_TIMEOUT) || 30000;
    this.queue = queue;
    this.processor = processor;
    this.validator = validator;
    this.notifier = notifier;
    this.logger = logger;
    this.io = io;
    this.isRunning = false;

    this.axiosConfig = {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: this.erpTimeout
    };
  }

  async startSync() {
    if (this.isRunning) {
      throw new Error('Sincronización ya en proceso');
    }

    this.isRunning = true;
    const batchId = this.generateBatchId();
    const startTime = Date.now();

    try {
      this.logger.info(`Iniciando sincronización: Batch ${batchId}`);

      const products = await this.fetchProductsFromERP();

      this.logger.info(`Productos obtenidos del ERP: ${products.length}`);

      await this.notifier.sendSyncStarted(batchId, products.length);

      this.io.emit('sync_started', { batch_id: batchId, total: products.length });

      const validationResult = this.validator.validateBatch(products);

      this.logger.info(`Productos válidos: ${validationResult.valid.length}, Inválidos: ${validationResult.invalid.length}`);

      if (validationResult.invalid.length > 0) {
        validationResult.invalid.forEach(item => {
          this.logger.warn(`Producto inválido ${item.product.art_cod_int}: ${item.errors.join(', ')}`);
          this.queue.addError(
            item.product.art_cod_int,
            'ValidationError',
            item.errors.join(', '),
            null
          );
        });
      }

      this.queue.addBatch(validationResult.valid, 'update');

      const stats = await this.processQueue(batchId);

      const duration = Date.now() - startTime;
      const avgDuration = stats.total > 0 ? Math.round(duration / stats.total) : 0;

      this.queue.addHistory(batchId, stats, startTime, 'manual');

      const today = new Date().toISOString().split('T')[0];
      this.queue.updateDailyStats(today, {
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        avg_duration_ms: avgDuration
      });

      const errorBreakdown = await this.getErrorBreakdown();

      await this.notifier.sendSyncCompleted(batchId, {
        ...stats,
        startTime,
        endTime: Date.now(),
        duration,
        avgDuration,
        errorBreakdown
      });

      this.io.emit('sync_completed', stats);

      this.logger.info(`Sincronización completada: ${stats.successful}/${stats.total} exitosos`);

      return { batchId, stats };

    } catch (error) {
      this.logger.error('Error en sincronización:', error);

      await this.notifier.sendSyncError(batchId, {
        message: error.message,
        failedCount: 0,
        totalProcessed: 0
      });

      throw error;

    } finally {
      this.isRunning = false;
    }
  }

  async processQueue(batchId) {
    const stats = {
      total: 0,
      successful: 0,
      failed: 0
    };

    while (true) {
      const item = this.queue.getNext();
      if (!item) break;

      stats.total++;

      this.io.emit('sync_progress', {
        processed: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        current: item.product_name,
        pending: this.queue.countByStatus('pending')
      });

      const result = await this.processor.processWithRetry(item);

      if (result.success) {
        stats.successful++;
        this.io.emit('product_completed', { art_cod_int: item.art_cod_int });
      } else {
        stats.failed++;
        this.io.emit('product_failed', {
          art_cod_int: item.art_cod_int,
          error: result.error
        });
      }

      if (stats.total % 10 === 0) {
        this.io.emit('stats_update', this.queue.getStats());
      }
    }

    this.io.emit('stats_update', this.queue.getStats());

    return stats;
  }

  async fetchProductsFromERP() {
    try {
      this.logger.info('Descargando productos desde API ERP...');
      this.logger.info(`Endpoint: ${this.erpEndpoint}producto`);

      const response = await axios.get(
        `${this.erpEndpoint}producto`,
        this.axiosConfig
      );

      const products = response.data.value || [];

      this.logger.info(`Productos descargados desde API: ${products.length}`);

      return products;

    } catch (error) {
      this.logger.error('Error descargando productos desde API ERP:', {
        error: error.message,
        endpoint: `${this.erpEndpoint}producto`,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw new Error(`Error al obtener productos de la API: ${error.message}`);
    }
  }

  async fetchStockFromERP(artCodInt) {
    try {
      const response = await axios.get(
        `${this.erpEndpoint}product/list/stock/${artCodInt}`,
        this.axiosConfig
      );

      return response.data || [];

    } catch (error) {
      this.logger.error(`Error descargando stock para producto ${artCodInt}:`, error.message);
      return [];
    }
  }

  async fetchDeletedProductsFromERP() {
    try {
      this.logger.info('Descargando productos eliminados desde API ERP...');

      const response = await axios.get(
        `${this.erpEndpoint}producto/deleted`,
        this.axiosConfig
      );

      const deletedProducts = response.data.value || [];

      this.logger.info(`Productos eliminados descargados: ${deletedProducts.length}`);

      return deletedProducts;

    } catch (error) {
      this.logger.error('Error descargando productos eliminados:', error.message);
      return [];
    }
  }

  async notifyERPProductProcessed(artCodInt) {
    try {
      await axios.post(
        `${this.erpEndpoint}producto`,
        { id: artCodInt.toString() },
        this.axiosConfig
      );

      this.logger.debug(`Notificación enviada al ERP para producto ${artCodInt}`);

    } catch (error) {
      this.logger.warn(`Error notificando al ERP producto ${artCodInt}:`, error.message);
    }
  }

  async getErrorBreakdown() {
    const errors = this.queue.getRecentErrors(1);
    const breakdown = {};

    errors.forEach(error => {
      if (!breakdown[error.error_type]) {
        breakdown[error.error_type] = 0;
      }
      breakdown[error.error_type]++;
    });

    return breakdown;
  }

  async triggerReindex() {
    this.logger.info('Reindexación solicitada');
  }

  async getStatus() {
    return {
      is_running: this.isRunning,
      queue_stats: this.queue.getStats()
    };
  }

  async checkStuckProcessing() {
    const stuck = this.queue.getStuckProcessing();

    if (stuck.length > 0) {
      this.logger.warn(`Productos atascados en procesamiento: ${stuck.length}`);

      await this.notifier.sendQueueBlocked(stuck);

      this.queue.resetStuckProcessing();
    }
  }

  generateBatchId() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
    return `${dateStr}-${timeStr}`;
  }
}

module.exports = SyncService;
