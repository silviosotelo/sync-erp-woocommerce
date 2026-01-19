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
  host: process.env.ERP_HOST || process.env.MYSQL_HOST,
  user: process.env.ERP_USER || process.env.MYSQL_USER,
  password: process.env.ERP_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.ERP_DATABASE || 'erp_database',
  port: process.env.ERP_PORT || 3306
};

Logger.info('Inicializando Farmatotal Sync v2...');

const queue = new SyncQueue(SQLITE_DB_PATH);
const validator = new QueueValidator();
const processor = new QueueProcessor(mysqlConfig, queue, Logger);

let whatsappClient = null;
const notifier = new WhatsAppNotifier(whatsappClient, Logger);

const syncService = new SyncService(
  erpConfig,
  queue,
  processor,
  validator,
  notifier,
  Logger,
  io
);

const reportGenerator = new DailyReportGenerator(queue, Logger);
const csvExporter = new CSVExporter(Logger);

const syncController = new SyncController(syncService, Logger);
const queueController = new QueueController(queue, Logger);
const statsController = new StatsController(queue, Logger);
const errorsController = new ErrorsController(queue, Logger);
const reportsController = new ReportsController(reportGenerator, csvExporter, Logger);

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
    queue_stats: queue.getStats()
  });
});

io.on('connection', (socket) => {
  Logger.info('Cliente conectado al dashboard');

  socket.emit('stats_update', queue.getStats());

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
    await syncService.checkStuckProcessing();
  } catch (error) {
    Logger.error('Error verificando cola bloqueada:', error);
  }
});

Logger.info('Tarea programada: verificación de cola bloqueada cada 10 minutos');

cron.schedule('0 2 * * *', async () => {
  try {
    const result = queue.cleanOldCompleted(7);
    Logger.info(`Limpieza automática: ${result.changes} productos completados eliminados`);
  } catch (error) {
    Logger.error('Error en limpieza automática:', error);
  }
});

Logger.info('Tarea programada: limpieza de completados cada día a las 2 AM');

process.on('SIGINT', async () => {
  Logger.info('Cerrando servidor...');

  queue.close();
  await processor.close();

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

server.listen(PORT, () => {
  Logger.info(`Servidor iniciado en puerto ${PORT}`);
  Logger.info(`Dashboard disponible en: http://localhost:${PORT}`);
  Logger.info('Sistema de colas con SQLite inicializado');
  Logger.info('Retry logic con transacciones habilitado');
  Logger.info('Notificaciones WhatsApp configuradas');
});

module.exports = { app, server, io, queue, syncService };
