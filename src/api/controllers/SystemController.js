class SystemController {
  constructor(syncService, processor, logger) {
    this.syncService = syncService;
    this.processor = processor;
    this.logger = logger;
  }

  async getConfig(req, res) {
    try {
      const config = {
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3001,

        sync: {
          autoSyncEnabled: process.env.AUTO_SYNC_ENABLED === 'true',
          intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 10,
          batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100,
          maxRetries: parseInt(process.env.SYNC_MAX_RETRIES) || 3,
          timeoutSeconds: parseInt(process.env.SYNC_TIMEOUT_SECONDS) || 300
        },

        erp: {
          endpoint: process.env.ERP_ENDPOINT || 'N/A',
          timeout: parseInt(process.env.ERP_TIMEOUT) || 30000,
          retryAttempts: parseInt(process.env.ERP_RETRY_ATTEMPTS) || 3
        },

        database: {
          host: process.env.MYSQL_HOST || 'N/A',
          database: process.env.MYSQL_DATABASE || 'N/A',
          prefix: process.env.DB_PREFIX || 'wp_',
          connected: this.processor !== null
        },

        features: {
          multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
          stockSync: process.env.STOCK_SYNC_ENABLED === 'true',
          dailyReport: process.env.DAILY_REPORT_ENABLED === 'true',
          realtimeUpdates: process.env.REALTIME_UPDATES === 'true',
          whatsapp: process.env.WHATSAPP_ENABLED === 'true'
        },

        notifications: {
          onStart: process.env.NOTIFY_ON_START === 'true',
          onComplete: process.env.NOTIFY_ON_COMPLETE === 'true',
          onError: process.env.NOTIFY_ON_ERROR === 'true',
          errorThreshold: parseInt(process.env.ERROR_THRESHOLD_PERCENT) || 10
        }
      };

      res.json(config);
    } catch (error) {
      this.logger.error('Error obteniendo configuración:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),

        connections: {
          mysql: {
            connected: this.processor !== null,
            message: this.processor ? 'Conectado' : 'No disponible - Modo solo lectura'
          },
          erp: {
            endpoint: process.env.ERP_ENDPOINT,
            status: 'Configurado'
          }
        },

        services: {
          syncService: this.syncService !== null,
          queue: true,
          notifications: true
        }
      };

      res.json(status);
    } catch (error) {
      this.logger.error('Error obteniendo estado:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async testConnections(req, res) {
    try {
      const results = {
        timestamp: new Date().toISOString(),
        tests: {}
      };

      // Test MySQL
      if (this.processor) {
        try {
          await this.processor.testConnection();
          results.tests.mysql = { status: 'success', message: 'Conexión exitosa' };
        } catch (error) {
          results.tests.mysql = { status: 'error', message: error.message };
        }
      } else {
        results.tests.mysql = { status: 'disabled', message: 'MySQL no configurado' };
      }

      // Test ERP
      try {
        const axios = require('axios');
        const response = await axios.get(process.env.ERP_ENDPOINT, {
          timeout: 10000
        });
        results.tests.erp = {
          status: 'success',
          message: 'Endpoint accesible',
          statusCode: response.status
        };
      } catch (error) {
        results.tests.erp = {
          status: 'error',
          message: error.message,
          code: error.code
        };
      }

      res.json(results);
    } catch (error) {
      this.logger.error('Error probando conexiones:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getLastSync(req, res) {
    try {
      // Aquí puedes agregar lógica para obtener la última sincronización
      // desde la base de datos o logs
      const lastSync = {
        timestamp: new Date().toISOString(),
        message: 'Información de última sincronización no disponible aún'
      };

      res.json(lastSync);
    } catch (error) {
      this.logger.error('Error obteniendo última sincronización:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = SystemController;
