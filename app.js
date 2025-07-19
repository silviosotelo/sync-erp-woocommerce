/**
 * app.js
 * Aplicación principal del Sincronizador ERP ↔ WooCommerce
 * Integra sincronización, dashboard web y APIs auxiliares
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Logger } = require('./sync-enhanced');

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
    Logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// ============ ARCHIVOS ESTÁTICOS ============
app.use(express.static(path.join(__dirname, 'dashboard')));

// ============ API ROUTES ============

// Rutas principales del dashboard (del dashboard-server.js)
const { query, BackupManager, ProductDeletionManager, main } = require('./sync-enhanced');

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
    main().catch(error => {
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
    res.json({ 
      status: 'OK', 
      timestamp: new Date(),
      version: '1.0.0',
      services: {
        database: 'connected',
        sync: 'running'
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔄 Sincronizador ERP → WooCommerce</h1>
          <div class="status success">
            ✅ Servidor ejecutándose en puerto ${PORT}
          </div>
          <h2>APIs Disponibles:</h2>
          <ul>
            <li><a href="/api/stats">GET /api/stats</a> - Estadísticas de sincronización</li>
            <li><a href="/api/logs">GET /api/logs</a> - Logs del sistema</li>
            <li><a href="/api/system/status">GET /api/system/status</a> - Estado del sistema</li>
            <li><a href="/health">GET /health</a> - Health check</li>
          </ul>
          <h2>Operaciones:</h2>
          <ul>
            <li>POST /api/sync/start - Iniciar sincronización manual</li>
            <li>POST /api/products/delete - Eliminar producto</li>
            <li>POST /api/products/restore - Restaurar producto</li>
          </ul>
        </div>
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
    
    Logger.info('Base de datos inicializada correctamente');
    
    // Crear directorios necesarios
    const dirs = ['logs', 'backups', 'tmp', 'dashboard'];
    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        Logger.info(`Directorio creado: ${dir}`);
      }
    });
    
    Logger.info('Aplicación inicializada correctamente');
    
  } catch (error) {
    Logger.error('Error inicializando aplicación:', error.message);
    throw error;
  }
}

// ============ INICIAR SERVIDOR ============
initializeApp().then(() => {
  app.listen(PORT, () => {
    Logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  🔄 SINCRONIZADOR ERP → WOOCOMMERCE                          ║
║                                                              ║
║  📊 Dashboard: http://localhost:${PORT}                           ║
║  🏥 Health: http://localhost:${PORT}/health                       ║
║  📝 API Docs: http://localhost:${PORT}/api                        ║
║                                                              ║
║  Status: ✅ EJECUTÁNDOSE                                     ║
║  Versión: 1.0.0                                             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}).catch(error => {
  Logger.error('Error crítico al iniciar servidor:', error.message);
  console.error('❌ Error crítico:', error.message);
  process.exit(1);
});

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGTERM', () => {
  Logger.info('Señal SIGTERM recibida, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('Señal SIGINT recibida, cerrando servidor...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  Logger.error('Excepción no capturada:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Promise rechazada no manejada:', reason);
  process.exit(1);
});

module.exports = app;