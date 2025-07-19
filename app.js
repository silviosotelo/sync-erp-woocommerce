/**
 * app.js - VERSIÓN CORREGIDA
 * Aplicación principal del Sincronizador ERP ↔ WooCommerce
 * Integra sincronización, dashboard web y APIs auxiliares
 * ASEGURA que el cron job se inicie correctamente
 */
 const express = require('express');
 const path = require('path');
 const fs = require('fs');
 
 // Cargar variables de entorno ANTES de importar sync-enhanced
 require('dotenv').config();
 
 // Importar módulos del sincronizador
 const { Logger, BackupManager, ProductDeletionManager, query, main, startCronJob, stopCronJob, getCronStatus } = require('./sync-enhanced');
 
 // Importar rutas auxiliares
 const apiEndpoints = require('./api-endpoints');
 
 const app = express();
 const PORT = process.env.PORT || 3001;
 
 // ============ CONFIGURACIÓN GLOBAL ============
 process.env.DB_PREFIX = process.env.DB_PREFIX || 'btw70';
 
 // Middleware
 app.use(express.json({ limit: '10mb' }));
 app.use(express.urlencoded({ extended: true, limit: '10mb' }));
 
 // CORS configurado
 app.use((req, res, next) => {
   res.header('Access-Control-Allow-Origin', '*');
   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
   
   if (req.method === 'OPTIONS') {
     res.sendStatus(200);
   } else {
     next();
   }
 });
 
 // Logging middleware
 app.use((req, res, next) => {
   const start = Date.now();
   
   res.on('finish', () => {
     const duration = Date.now() - start;
     if (req.originalUrl !== '/api/system/status') { // Evitar spam de health checks
       Logger.debug(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
     }
   });
   
   next();
 });
 
 // ============ ARCHIVOS ESTÁTICOS ============
 app.use(express.static(path.join(__dirname, 'dashboard')));
 
 // ============ API ROUTES ============
 
 // Obtener estadísticas recientes
 app.get('/api/stats', async (req, res) => {
   try {
     const stats = await query(`
       SELECT * FROM sync_statistics 
       ORDER BY created_at DESC 
       LIMIT 10
     `);
     
     const summary = await query(`
       SELECT 
         COUNT(*) as total_syncs,
         SUM(products_created) as total_created,
         SUM(products_updated) as total_updated,
         SUM(products_deleted) as total_deleted,
         SUM(errors) as total_errors,
         AVG(duration_ms) as avg_duration
       FROM sync_statistics 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
     `);
 
     res.json({
       recent: stats,
       summary: summary[0] || {},
       timestamp: new Date()
     });
   } catch (error) {
     Logger.error('Error obteniendo estadísticas:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Obtener logs del día actual
 app.get('/api/logs', async (req, res) => {
   try {
     const date = new Date()
       .toLocaleDateString("es-PY", {
         timeZone: "America/Asuncion",
         year: "numeric",
         month: "2-digit",
         day: "2-digit"
       })
       .split("/")
       .reverse()
       .join("-");
     
     const logFile = path.join(__dirname, 'logs', `${date}.log`);
     
     if (fs.existsSync(logFile)) {
       const logs = fs.readFileSync(logFile, 'utf8')
         .split('\n')
         .filter(line => line.trim())
         .slice(-100)
         .map(line => {
           const match = line.match(/^(.+?) \| \[(.+?)\] (.+)/);
           if (match) {
             return {
               timestamp: match[1],
               level: match[2],
               message: match[3]
             };
           }
           return { timestamp: '', level: 'INFO', message: line };
         });
       
       res.json({ logs, count: logs.length });
     } else {
       res.json({ logs: [], count: 0 });
     }
   } catch (error) {
     Logger.error('Error obteniendo logs:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Iniciar sincronización manual
 app.post('/api/sync/start', async (req, res) => {
   try {
     Logger.info('Sincronización manual iniciada desde dashboard');
     
     // Ejecutar en background
     main().then(result => {
       Logger.info('Sincronización manual completada', result);
     }).catch(error => {
       Logger.error('Error en sincronización manual:', error.message);
     });
     
     res.json({ 
       success: true, 
       message: 'Sincronización iniciada',
       timestamp: new Date()
     });
   } catch (error) {
     Logger.error('Error iniciando sincronización:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // ============ CONTROL DEL CRON JOB ============
 
 // Obtener estado del cron job
 app.get('/api/cron/status', (req, res) => {
   try {
     const status = getCronStatus();
     res.json({
       success: true,
       status,
       timestamp: new Date()
     });
   } catch (error) {
     Logger.error('Error obteniendo estado del cron:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Iniciar cron job manualmente
 app.post('/api/cron/start', (req, res) => {
   try {
     startCronJob();
     res.json({
       success: true,
       message: 'Cron job iniciado',
       status: getCronStatus()
     });
   } catch (error) {
     Logger.error('Error iniciando cron job:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Detener cron job manualmente
 app.post('/api/cron/stop', (req, res) => {
   try {
     stopCronJob();
     res.json({
       success: true,
       message: 'Cron job detenido',
       status: getCronStatus()
     });
   } catch (error) {
     Logger.error('Error deteniendo cron job:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Restaurar producto eliminado
 app.post('/api/products/restore', async (req, res) => {
   try {
     const { codInterno } = req.body;
     
     if (!codInterno) {
       return res.status(400).json({ error: 'Código interno requerido' });
     }
     
     const success = await ProductDeletionManager.restoreProduct(codInterno);
     
     if (success) {
       res.json({ 
         success: true, 
         message: `Producto ${codInterno} restaurado exitosamente` 
       });
     } else {
       res.status(404).json({ 
         error: `Producto ${codInterno} no encontrado` 
       });
     }
   } catch (error) {
     Logger.error('Error restaurando producto:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Eliminar producto manualmente
 app.post('/api/products/delete', async (req, res) => {
   try {
     const { codInterno, reason } = req.body;
     
     if (!codInterno) {
       return res.status(400).json({ error: 'Código interno requerido' });
     }
     
     const success = await ProductDeletionManager.softDeleteProduct(
       codInterno, 
       reason || 'Eliminación manual desde dashboard'
     );
     
     if (success) {
       res.json({ 
         success: true, 
         message: `Producto ${codInterno} eliminado exitosamente` 
       });
     } else {
       res.status(404).json({ 
         error: `Producto ${codInterno} no encontrado` 
       });
     }
   } catch (error) {
     Logger.error('Error eliminando producto:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Obtener productos eliminados recientemente
 app.get('/api/products/deleted', async (req, res) => {
   try {
     const deleted = await query(`
       SELECT 
         p.ID,
         p.post_title,
         p.post_modified,
         pm1.meta_value as cod_interno,
         pm2.meta_value as deletion_reason,
         pm3.meta_value as deletion_date
       FROM ${process.env.DB_PREFIX}_posts p
       INNER JOIN ${process.env.DB_PREFIX}_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'cod_interno'
       LEFT JOIN ${process.env.DB_PREFIX}_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'deletion_reason'
       LEFT JOIN ${process.env.DB_PREFIX}_postmeta pm3 ON p.ID = pm3.post_id AND pm3.meta_key = 'deletion_date'
       WHERE p.post_type = 'product' 
       AND p.post_status IN ('trash', 'private')
       ORDER BY p.post_modified DESC
       LIMIT 50
     `);
     
     res.json({ products: deleted });
   } catch (error) {
     Logger.error('Error obteniendo productos eliminados:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Obtener status del sistema
 app.get('/api/system/status', async (req, res) => {
   try {
     const lockFile = path.join(__dirname, 'tmp', 'sync.lock');
     const isRunning = fs.existsSync(lockFile);
     
     // Verificar conexión a base de datos
     let dbStatus = 'disconnected';
     try {
       await query('SELECT 1');
       dbStatus = 'connected';
     } catch (dbError) {
       dbStatus = 'error';
     }
     
     // Estado del cron job
     const cronStatus = getCronStatus();
     
     // Información del sistema
     const systemInfo = {
       nodeVersion: process.version,
       platform: process.platform,
       uptime: process.uptime(),
       memoryUsage: process.memoryUsage(),
       pid: process.pid
     };
     
     res.json({
       isRunning,
       dbStatus,
       cronStatus,
       systemInfo,
       timestamp: new Date()
     });
   } catch (error) {
     Logger.error('Error obteniendo status del sistema:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // ============ RUTAS AUXILIARES ============
 app.use('/api', apiEndpoints);
 
 // ============ RUTAS DE ARCHIVOS ============
 
 // Descargar backup
 app.get('/api/backups/:filename', (req, res) => {
   try {
     const filename = req.params.filename;
     const filepath = path.join(__dirname, 'backups', filename);
     
     if (!fs.existsSync(filepath) || !filename.endsWith('.json')) {
       return res.status(404).json({ error: 'Backup no encontrado' });
     }
     
     res.download(filepath, filename);
   } catch (error) {
     Logger.error('Error descargando backup:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Obtener lista de backups
 app.get('/api/backups', async (req, res) => {
   try {
     const backupDir = path.join(__dirname, 'backups');
     
     if (!fs.existsSync(backupDir)) {
       return res.json({ backups: [] });
     }
     
     const files = fs.readdirSync(backupDir)
       .filter(file => file.endsWith('.json'))
       .map(file => {
         const filePath = path.join(backupDir, file);
         const stats = fs.statSync(filePath);
         return {
           name: file,
           size: stats.size,
           created: stats.birthtime,
           modified: stats.mtime
         };
       })
       .sort((a, b) => b.created - a.created);
     
     res.json({ backups: files });
   } catch (error) {
     Logger.error('Error obteniendo backups:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // Restaurar desde backup
 app.post('/api/backups/restore', async (req, res) => {
   try {
     const { filename } = req.body;
     const filepath = path.join(__dirname, 'backups', filename);
     
     if (!fs.existsSync(filepath)) {
       return res.status(404).json({ error: 'Backup no encontrado' });
     }
     
     await BackupManager.restoreFromBackup(filepath);
     
     res.json({ 
       success: true, 
       message: `Backup ${filename} restaurado exitosamente` 
     });
   } catch (error) {
     Logger.error('Error restaurando backup:', error.message);
     res.status(500).json({ error: 'Error interno del servidor' });
   }
 });
 
 // ============ HEALTH CHECK ============
 app.get('/health', async (req, res) => {
   try {
     await query('SELECT 1');
     const cronStatus = getCronStatus();
     
     res.json({ 
       status: 'OK', 
       timestamp: new Date(),
       version: '1.0.0',
       services: {
         database: 'connected',
         sync: cronStatus.active ? 'running' : 'stopped',
         cronJob: cronStatus
       }
     });
   } catch (error) {
     res.status(503).json({ 
       status: 'ERROR', 
       timestamp: new Date(),
       error: error.message 
     });
   }
 });
 
 // ============ SERVIR DASHBOARD ============
 app.get('/', (req, res) => {
   const dashboardPath = path.join(__dirname, 'dashboard', 'index.html');
   
   if (fs.existsSync(dashboardPath)) {
     res.sendFile(dashboardPath);
   } else {
     // Servir una página básica si no existe el dashboard
     res.send(`
       <!DOCTYPE html>
       <html>
       <head>
         <title>Sincronizador ERP - WooCommerce</title>
         <style>
           body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
           .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
           .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
           .success { background: #d4edda; color: #155724; }
           .error { background: #f8d7da; color: #721c24; }
           .warning { background: #fff3cd; color: #856404; }
         </style>
       </head>
       <body>
         <div class="container">
           <h1>🔄 Sincronizador ERP → WooCommerce</h1>
           <div class="status success">
             ✅ Servidor ejecutándose en puerto ${PORT}
           </div>
           
           <h2>Estado del Sistema:</h2>
           <div class="status warning" id="cronStatus">
             ⏳ Verificando estado del cron job...
           </div>
           
           <h2>APIs Disponibles:</h2>
           <ul>
             <li><a href="/api/stats">GET /api/stats</a> - Estadísticas de sincronización</li>
             <li><a href="/api/logs">GET /api/logs</a> - Logs del sistema</li>
             <li><a href="/api/system/status">GET /api/system/status</a> - Estado del sistema</li>
             <li><a href="/api/cron/status">GET /api/cron/status</a> - Estado del cron job</li>
             <li><a href="/health">GET /health</a> - Health check</li>
           </ul>
           
           <h2>Control del Cron Job:</h2>
           <button onclick="startCron()" style="background: #28a745; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer;">▶️ Iniciar Cron</button>
           <button onclick="stopCron()" style="background: #dc3545; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer;">⏹️ Detener Cron</button>
           <button onclick="checkStatus()" style="background: #007bff; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer;">🔍 Verificar Estado</button>
           
           <h2>Operaciones:</h2>
           <ul>
             <li>POST /api/sync/start - Iniciar sincronización manual</li>
             <li>POST /api/products/delete - Eliminar producto</li>
             <li>POST /api/products/restore - Restaurar producto</li>
             <li>POST /api/cron/start - Iniciar cron job</li>
             <li>POST /api/cron/stop - Detener cron job</li>
           </ul>
         </div>
         
         <script>
           async function startCron() {
             try {
               const response = await fetch('/api/cron/start', { method: 'POST' });
               const data = await response.json();
               alert(data.message || 'Cron job iniciado');
               checkStatus();
             } catch (error) {
               alert('Error: ' + error.message);
             }
           }
           
           async function stopCron() {
             try {
               const response = await fetch('/api/cron/stop', { method: 'POST' });
               const data = await response.json();
               alert(data.message || 'Cron job detenido');
               checkStatus();
             } catch (error) {
               alert('Error: ' + error.message);
             }
           }
           
           async function checkStatus() {
             try {
               const response = await fetch('/api/cron/status');
               const data = await response.json();
               const statusDiv = document.getElementById('cronStatus');
               if (data.status.active) {
                 statusDiv.innerHTML = '✅ Cron job ACTIVO (sincronización cada ' + data.status.interval + ' minutos)';
                 statusDiv.className = 'status success';
               } else {
                 statusDiv.innerHTML = '❌ Cron job INACTIVO';
                 statusDiv.className = 'status error';
               }
             } catch (error) {
               console.error('Error checking status:', error);
             }
           }
           
           // Verificar estado al cargar la página
           checkStatus();
         </script>
       </body>
       </html>
     `);
   }
 });
 
 // ============ ERROR HANDLING ============
 app.use((err, req, res, next) => {
   Logger.error('Error no manejado:', err.message);
   res.status(500).json({ 
     error: 'Error interno del servidor',
     message: err.message,
     timestamp: new Date()
   });
 });
 
 // 404 handler
 app.use((req, res) => {
   res.status(404).json({ 
     error: 'Endpoint no encontrado',
     path: req.originalUrl,
     timestamp: new Date()
   });
 });
 
 // ============ INICIALIZACIÓN ============
 async function initializeApp() {
   try {
     Logger.info('🚀 Inicializando aplicación...');
     
     // Crear tablas necesarias
     await query(`
       CREATE TABLE IF NOT EXISTS sync_statistics (
         id INT AUTO_INCREMENT PRIMARY KEY,
         start_time DATETIME,
         end_time DATETIME,
         duration_ms INT,
         products_created INT DEFAULT 0,
         products_updated INT DEFAULT 0,
         products_deleted INT DEFAULT 0,
         errors INT DEFAULT 0,
         api_calls INT DEFAULT 0,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )
     `);
     
     Logger.info('✅ Base de datos inicializada correctamente');
     
     // Crear directorios necesarios
     const dirs = ['logs', 'backups', 'tmp', 'dashboard'];
     dirs.forEach(dir => {
       const dirPath = path.join(__dirname, dir);
       if (!fs.existsSync(dirPath)) {
         fs.mkdirSync(dirPath, { recursive: true });
         Logger.info(`📁 Directorio creado: ${dir}`);
       }
     });
     
     // ============ VERIFICAR Y FORZAR INICIO DEL CRON JOB ============
     Logger.info('⏰ Verificando estado del cron job...');
     const cronStatus = getCronStatus();
     
     if (!cronStatus.active) {
       Logger.warn('⚠️ Cron job no está activo, iniciando...');
       try {
         startCronJob();
         Logger.info('✅ Cron job iniciado correctamente');
       } catch (cronError) {
         Logger.error('❌ Error iniciando cron job:', cronError.message);
       }
     } else {
       Logger.info('✅ Cron job ya está activo');
     }
     
     // Verificar nuevamente el estado
     const finalCronStatus = getCronStatus();
     Logger.info('📊 Estado final del cron job:', finalCronStatus);
     
     Logger.info('✅ Aplicación inicializada correctamente');
     
   } catch (error) {
     Logger.error('❌ Error inicializando aplicación:', error.message);
     throw error;
   }
 }
 
 // ============ INICIAR SERVIDOR ============
 initializeApp().then(() => {
   app.listen(PORT, () => {
     Logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
     
     // Verificar estado del cron job después de iniciar el servidor
     setTimeout(() => {
       const cronStatus = getCronStatus();
       Logger.info('🔄 Estado del cron job después del inicio:', cronStatus);
       
       if (!cronStatus.active) {
         Logger.warn('⚠️ Cron job aún no está activo, reintentando...');
         try {
           startCronJob();
           Logger.info('✅ Cron job iniciado en segundo intento');
         } catch (error) {
           Logger.error('❌ Error en segundo intento de iniciar cron job:', error.message);
         }
       }
     }, 5000); // Verificar después de 5 segundos
     
     console.log(`
 ╔══════════════════════════════════════════════════════════════╗
 ║                                                              ║
 ║  🔄 SINCRONIZADOR ERP → WOOCOMMERCE (v2.0)                  ║
 ║                                                              ║
 ║  📊 Dashboard: http://localhost:${PORT}                           ║
 ║  🏥 Health: http://localhost:${PORT}/health                       ║
 ║  📝 Cron Status: http://localhost:${PORT}/api/cron/status         ║
 ║                                                              ║
 ║  Status: ✅ EJECUTÁNDOSE                                     ║
 ║  Versión: 2.0.0 (Cron Job Mejorado)                        ║
 ║                                                              ║
 ╚══════════════════════════════════════════════════════════════╝
     `);
   });
 }).catch(error => {
   Logger.error('❌ Error crítico al iniciar servidor:', error.message);
   console.error('💥 Error crítico:', error.message);
   process.exit(1);
 });
 
 // ============ GRACEFUL SHUTDOWN ============
 process.on('SIGTERM', () => {
   Logger.info('📴 Señal SIGTERM recibida, cerrando servidor...');
   stopCronJob();
   process.exit(0);
 });
 
 process.on('SIGINT', () => {
   Logger.info('📴 Señal SIGINT recibida, cerrando servidor...');
   stopCronJob();
   process.exit(0);
 });
 
 process.on('uncaughtException', (error) => {
   Logger.error('💥 Excepción no capturada:', error.message);
   process.exit(1);
 });
 
 process.on('unhandledRejection', (reason, promise) => {
   Logger.error('💥 Promise rechazada no manejada:', reason);
   process.exit(1);
 });
 
 module.exports = app;