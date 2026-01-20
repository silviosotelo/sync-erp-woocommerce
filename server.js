require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cron = require('node-cron');

const Logger = require('./src/utils/Logger');
const SyncQueue = require('./src/queue/SyncQueue');
const QueueValidator = require('./src/queue/QueueValidator');
const QueueProcessor = require('./src/queue/QueueProcessor');
const SyncService = require('./src/sync/SyncService');
const WhatsAppNotifier = require('./src/notifications/WhatsAppNotifier');
const DailyReportGenerator = require('./src/reports/DailyReportGenerator');
const CSVExporter = require('./src/reports/CSVExporter');

const SyncController = require('./src/api/controllers/SyncController');
const QueueController = require('./src/api/controllers/QueueController');
const StatsController = require('./src/api/controllers/StatsController');
const ErrorsController = require('./src/api/controllers/ErrorsController');
const ReportsController = require('./src/api/controllers/ReportsController');

const syncRoutes = require('./src/api/routes/sync.routes');
const queueRoutes = require('./src/api/routes/queue.routes');
const statsRoutes = require('./src/api/routes/stats.routes');
const errorsRoutes = require('./src/api/routes/errors.routes');
const reportsRoutes = require('./src/api/routes/reports.routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './data/sync_queue.db';

const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306
};

const erpConfig = {
  endpoint: process.env.ERP_ENDPOINT,
  timeout: parseInt(process.env.ERP_TIMEOUT) || 30000,
  retryAttempts: parseInt(process.env.ERP_RETRY_ATTEMPTS) || 3
};

console.log('\n' + '='.repeat(60));
console.log('  FARMATOTAL SYNC v2.0 - SISTEMA MEJORADO');
console.log('='.repeat(60) + '\n');

Logger.info('Inicializando Farmatotal Sync v2...');
Logger.info('Si ves errores de timeout, lee: IMPORTANTE-LEER.md');

let queue, validator, processor, syncService, notifier, reportGenerator, csvExporter;
let syncController, queueController, statsController, errorsController, reportsController;

async function initializeServices() {
  try {
    Logger.info('Inicializando SQLite queue...');
    queue = new SyncQueue(SQLITE_DB_PATH);
    Logger.info('SQLite queue inicializado correctamente');

    validator = new QueueValidator();

    Logger.info('Inicializando MySQL processor...');
    processor = new QueueProcessor(mysqlConfig, queue, Logger);
    await processor.initialize();
    Logger.info('MySQL processor inicializado correctamente');

    let whatsappClient = null;
    notifier = new WhatsAppNotifier(whatsappClient, Logger);

    Logger.info('Inicializando sync service...');
    syncService = new SyncService(
      erpConfig,
      queue,
      processor,
      validator,
      notifier,
      Logger,
      io
    );
    Logger.info('Sync service inicializado correctamente');

    reportGenerator = new DailyReportGenerator(queue, Logger);
    csvExporter = new CSVExporter(Logger);

    syncController = new SyncController(syncService, Logger);
    queueController = new QueueController(queue, Logger);
    statsController = new StatsController(queue, Logger);
    errorsController = new ErrorsController(queue, Logger);
    reportsController = new ReportsController(reportGenerator, csvExporter, Logger);

    Logger.info('Todos los servicios inicializados correctamente');
  } catch (error) {
    Logger.error('Error inicializando servicios:', error);
    throw error;
  }
}

async function startServer() {
  try {
    await initializeServices();

    app.use('/api/sync', syncRoutes(syncController));
    app.use('/api/queue', queueRoutes(queueController));
    app.use('/api/stats', statsRoutes(statsController));
    app.use('/api/errors', errorsRoutes(errorsController));
    app.use('/api/reports', reportsRoutes(reportsController));

    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'dashboard-v2.html'));
    });

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        queue_stats: queue ? queue.getStats() : {}
      });
    });

    io.on('connection', (socket) => {
      Logger.info('Cliente conectado al dashboard');

      if (queue) {
        socket.emit('stats_update', queue.getStats());
      }

      socket.on('disconnect', () => {
        Logger.info('Cliente desconectado del dashboard');
      });
    });

    if (process.env.DAILY_REPORT_ENABLED === 'true') {
      const reportTime = process.env.DAILY_REPORT_TIME || '08:00';
      const [hour, minute] = reportTime.split(':');

      cron.schedule(`${minute} ${hour} * * *`, async () => {
        Logger.info('Generando reporte diario automático...');

        try {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          const reportData = await reportGenerator.generateReport(yesterday);

          await notifier.sendDailyReport(reportData);

          const dateStr = yesterday.toISOString().split('T')[0];
          const csvPath = path.join(process.cwd(), 'reports', 'daily', `${dateStr}.csv`);
          await csvExporter.exportDailyReport(reportData, csvPath);

          Logger.info('Reporte diario generado y enviado correctamente');
        } catch (error) {
          Logger.error('Error generando reporte diario:', error);
        }
      });

      Logger.info(`Reporte diario programado para las ${reportTime}`);
    }

    cron.schedule('*/10 * * * *', async () => {
      try {
        if (syncService) {
          await syncService.checkStuckProcessing();
        }
      } catch (error) {
        Logger.error('Error verificando cola bloqueada:', error);
      }
    });

    Logger.info('Tarea programada: verificación de cola bloqueada cada 10 minutos');

    cron.schedule('0 2 * * *', async () => {
      try {
        if (queue) {
          const result = queue.cleanOldCompleted(7);
          Logger.info(`Limpieza automática: ${result.changes} productos completados eliminados`);
        }
      } catch (error) {
        Logger.error('Error en limpieza automática:', error);
      }
    });

    Logger.info('Tarea programada: limpieza de completados cada día a las 2 AM');

    server.listen(PORT, () => {
      Logger.info(`Servidor iniciado en puerto ${PORT}`);
      Logger.info(`Dashboard disponible en: http://localhost:${PORT}`);
      Logger.info('Sistema de colas con SQLite inicializado');
      Logger.info('Retry logic con transacciones habilitado');
      Logger.info('Notificaciones WhatsApp configuradas');
    });

  } catch (error) {
    Logger.error('Error fatal iniciando servidor:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  Logger.info('Cerrando servidor...');

  if (queue) queue.close();
  if (processor) await processor.close();

  server.close(() => {
    Logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  Logger.error('Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Promesa rechazada no manejada:', { reason, promise });
});

startServer();

module.exports = { app, server, io, queue, syncService };
