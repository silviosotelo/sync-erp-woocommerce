const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql');
const util = require('util');

class SyncService {
  constructor(erpConfig, queue, processor, validator, notifier, logger, io) {
    this.erpConfig = erpConfig;
    this.queue = queue;
    this.processor = processor;
    this.validator = validator;
    this.notifier = notifier;
    this.logger = logger;
    this.io = io;
    this.isRunning = false;

    this.erpPool = mysql.createPool({
      host: erpConfig.host,
      port: erpConfig.port || 3306,
      user: erpConfig.user,
      password: erpConfig.password,
      database: erpConfig.database,
      connectionLimit: 3,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    this.erpQuery = util.promisify(this.erpPool.query).bind(this.erpPool);

    this.erpPool.on('error', (err) => {
      this.logger.error('Error en pool ERP:', err);
    });
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
    const query = `
      SELECT
        art_cod_int,
        art_nombre,
        art_nombre_web,
        art_descripcion,
        art_descripcion_larga,
        art_precio,
        art_precio_oferta,
        art_stock,
        art_imagen_url,
        art_activo
      FROM productos
      WHERE art_activo = 'S'
    `;

    const products = await this.erpQuery(query);
    return products;
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
