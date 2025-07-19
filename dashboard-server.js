/**
 * dashboard-server.js
 * Servidor Express para Dashboard de Monitoreo del Sincronizador
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Logger, BackupManager, ProductDeletionManager, query, main } = require('./sync-enhanced');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

// ============ API ENDPOINTS ============

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
      summary: summary[0],
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
        .slice(-100) // Últimas 100 líneas
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

// Obtener lista de backups
app.get('/api/backups', async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
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
      FROM ${process.env.DB_PREFIX || 'btw70'}_posts p
      INNER JOIN ${process.env.DB_PREFIX || 'btw70'}_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'cod_interno'
      LEFT JOIN ${process.env.DB_PREFIX || 'btw70'}_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'deletion_reason'
      LEFT JOIN ${process.env.DB_PREFIX || 'btw70'}_postmeta pm3 ON p.ID = pm3.post_id AND pm3.meta_key = 'deletion_date'
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

// Configurar nivel de logging
app.post('/api/system/log-level', async (req, res) => {
  try {
    const { level } = req.body;
    const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    
    if (!validLevels.includes(level)) {
      return res.status(400).json({ 
        error: 'Nivel inválido. Use: ERROR, WARN, INFO, DEBUG' 
      });
    }
    
    Logger.currentLevel = Logger.levels[level];
    Logger.info(`Nivel de logging cambiado a: ${level}`);
    
    res.json({ 
      success: true, 
      message: `Nivel de logging configurado a: ${level}` 
    });
  } catch (error) {
    Logger.error('Error configurando nivel de logging:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

// Crear tabla de estadísticas si no existe
async function initDatabase() {
  try {
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
    Logger.info('Base de datos inicializada');
  } catch (error) {
    Logger.error('Error inicializando base de datos:', error.message);
  }
}

// Servir archivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

// Iniciar servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    Logger.info(`Dashboard iniciado en http://localhost:${PORT}`);
    console.log(`🚀 Dashboard del Sincronizador ejecutándose en http://localhost:${PORT}`);
  });
}).catch(error => {
  Logger.error('Error iniciando servidor:', error.message);
  process.exit(1);
});