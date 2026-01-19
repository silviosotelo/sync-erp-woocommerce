const mysql = require('mysql');
const util = require('util');

class MySQLConnection {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.pool = null;
    this.isConnected = false;
  }

  createPool() {
    const poolConfig = {
      ...this.config,
      connectionLimit: this.config.connectionLimit || 5,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: parseInt(process.env.MYSQL_CONNECT_TIMEOUT) || 60000,
      acquireTimeout: parseInt(process.env.MYSQL_ACQUIRE_TIMEOUT) || 60000,
      timeout: parseInt(process.env.MYSQL_TIMEOUT) || 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };

    this.logger.info('Creando pool MySQL con configuración:', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      connectionLimit: poolConfig.connectionLimit,
      connectTimeout: poolConfig.connectTimeout
    });

    this.pool = mysql.createPool(poolConfig);

    this.pool.on('error', (err) => {
      this.logger.error('Error en pool MySQL:', err);
      this.isConnected = false;
    });

    this.pool.on('connection', (connection) => {
      this.logger.info('Nueva conexión MySQL establecida');
      this.isConnected = true;

      connection.on('error', (err) => {
        this.logger.error('Error en conexión MySQL:', err);
      });
    });

    return this.pool;
  }

  async testConnection(maxRetries = 3) {
    if (!this.pool) {
      this.createPool();
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Probando conexión MySQL (intento ${attempt}/${maxRetries})...`);

        const query = util.promisify(this.pool.query).bind(this.pool);
        await query('SELECT 1');

        this.logger.info('Conexión MySQL exitosa');
        this.isConnected = true;
        return true;

      } catch (error) {
        this.logger.error(`Error en conexión MySQL (intento ${attempt}/${maxRetries}):`, {
          error: error.message,
          code: error.code,
          host: this.config.host,
          port: this.config.port
        });

        if (attempt < maxRetries) {
          const waitTime = 2000 * attempt;
          this.logger.info(`Reintentando en ${waitTime}ms...`);
          await this.sleep(waitTime);
        } else {
          throw new Error(`No se pudo conectar a MySQL después de ${maxRetries} intentos: ${error.message}`);
        }
      }
    }
  }

  getPool() {
    if (!this.pool) {
      this.createPool();
    }
    return this.pool;
  }

  async close() {
    if (this.pool) {
      return new Promise((resolve, reject) => {
        this.pool.end((err) => {
          if (err) {
            this.logger.error('Error cerrando pool MySQL:', err);
            reject(err);
          } else {
            this.logger.info('Pool MySQL cerrado correctamente');
            this.isConnected = false;
            resolve();
          }
        });
      });
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MySQLConnection;
