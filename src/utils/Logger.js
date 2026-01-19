const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    const logsDir = path.join(process.cwd(), 'logs');
    const errorsDir = path.join(logsDir, 'errors');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    if (!fs.existsSync(errorsDir)) {
      fs.mkdirSync(errorsDir, { recursive: true });
    }

    const logLevel = process.env.LOG_LEVEL || 'info';

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          dirname: logsDir,
          filename: '%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: process.env.LOG_MAX_FILES || '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `[${timestamp}] ${level.toUpperCase()}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
            })
          )
        }),

        new DailyRotateFile({
          dirname: errorsDir,
          filename: '%DATE%-errors.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: process.env.LOG_MAX_FILES || '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
              return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack || ''}\n${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
          )
        }),

        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message }) => {
              return `[${timestamp}] ${level}: ${message}`;
            })
          )
        })
      ]
    });
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }
}

module.exports = new Logger();
