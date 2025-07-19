/**
 * app.js - VERSIÓN MODULAR
 * Aplicación principal del Sincronizador ERP ↔ WooCommerce
 * Configuración modular basada en variables de entorno
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno ANTES de importar módulos
require('dotenv').config();

// Verificar configuración y mostrar funcionalidades activas
checkConfigurationAndShowFeatures();

// Importar módulos del sincronizador
const { Logger, BackupManager, ProductDeletionManager, query, main, startCronJob, stopCronJob, getCronStatus } = require('./sync-enhanced');

// Importar rutas auxiliares
const apiEndpoints = require('./api-endpoints');

// Importar módulos opcionales según configuración
let WhatsAppNotifier = null;
if (process.env.WHATSAPP_ENABLED === 'true') {
  try {
    WhatsAppNotifier = require('./modules/whatsapp-notifier');
    Logger.info('📱 Módulo WhatsApp cargado');
  } catch (error) {
    Logger.warn('⚠️ Módulo WhatsApp no disponible:', error.message);
  }
}

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

// Obtener configuración del sistema
app.get('/api/config', (req, res) => {
  try {
    const config = {
      features: {
        multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
        whatsapp: process.env.WHATSAPP_ENABLED === 'true',
        email: process.env.SMTP_ENABLED === 'true',
        sms: process.env.SMS_ENABLED === 'true',
        webhooks: process.env.WEBHOOK_ENABLED === 'true',
        autoSync: process.env.AUTO_SYNC_ENABLED !== 'false',
        backup: process.env.BACKUP_ENABLED !== 'false'
      },
      settings: {
        syncInterval: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 10,
        logLevel: process.env.LOG_LEVEL || 'INFO',
        maxRetries: parseInt(process.env.SYNC_MAX_RETRIES) || 3,
        batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100
      },
      database: {
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 15,
        timeout: parseInt(process.env.DB_TIMEOUT) || 30000
      },
      version: require('./package.json').version || '2.0.0'
    };
    
    res.json({
      success: true,
      config,
      timestamp: new Date()
    });
  } catch (error) {
    Logger.error('Error obteniendo configuración:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar configuración en tiempo real
app.post('/api/config/update', (req, res) => {
  try {
    const { feature, enabled } = req.body;
    
    const validFeatures = [
      'MULTI_INVENTORY_ENABLED',
      'WHATSAPP_ENABLED', 
      'SMTP_ENABLED',
      'SMS_ENABLED',
      'AUTO_SYNC_ENABLED'
    ];
    
    if (!validFeatures.includes(feature)) {
      return res.status(400).json({ error: 'Funcionalidad no válida' });
    }
    
    // Actualizar variable de entorno en tiempo de ejecución
    process.env[feature] = enabled ? 'true' : 'false';
    
    Logger.info(`Configuración actualizada: ${feature} = ${enabled}`);
    
    res.json({
      success: true,
      message: `${feature} ${enabled ? 'habilitado' : 'deshabilitado'}`,
      timestamp: new Date()
    });
  } catch (error) {
    Logger.error('Error actualizando configuración:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

    // Estadísticas adicionales si multi-inventory está habilitado
    let inventoryStats = null;
    if (process.env.MULTI_INVENTORY_ENABLED === 'true') {
      try {
        inventoryStats = await query(`
          SELECT 
            COUNT(DISTINCT pm.post_id) as products_with_inventory,
            COUNT(*) as total_inventory_records
          FROM ${process.env.DB_PREFIX}_postmeta pm
          WHERE pm.meta_key = 'woocommerce_multi_inventory_inventories_stock'
        `);
      } catch (error) {
        Logger.warn('Error obteniendo estadísticas de inventario:', error.message);
      }
    }

    res.json({
      recent: stats,
      summary: summary[0] || {},
      inventoryStats: inventoryStats ? inventoryStats[0] : null,
      features: {
        multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
        whatsapp: process.env.WHATSAPP_ENABLED === 'true'
      },
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
      
      // Enviar notificación si está habilitada
      if (process.env.WHATSAPP_ENABLED === 'true' && WhatsAppNotifier) {
        const message = `🔄 Sincronización completada\n\n` +
                       `✅ Creados: ${result.productsCreated}\n` +
                       `🔄 Actualizados: ${result.productsUpdated}\n` +
                       `🗑️ Eliminados: ${result.productsDeleted}\n` +
                       `❌ Errores: ${result.errors}\n` +
                       `⏱️ Duración: ${Math.round(result.durationMs/1000)}s`;
        
        WhatsAppNotifier.sendNotification(message).catch(err => {
          Logger.warn('Error enviando notificación WhatsApp:', err.message);
        });
      }
    }).catch(error => {
      Logger.error('Error en sincronización manual:', error.message);
      
      // Enviar notificación de error si está habilitada
      if (process.env.WHATSAPP_ENABLED === 'true' && WhatsAppNotifier) {
        const message = `❌ Error en sincronización\n\n${error.message}`;
        WhatsAppNotifier.sendNotification(message).catch(err => {
          Logger.warn('Error enviando notificación de error WhatsApp:', err.message);
        });
      }
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
    const multiInventoryEnabled = process.env.MULTI_INVENTORY_ENABLED === 'true';
    
    res.json({
      success: true,
      status: {
        ...status,
        multiInventory: multiInventoryEnabled,
        estimatedDbGrowth: multiInventoryEnabled ? 'Alto (stock por sucursal)' : 'Bajo (solo productos básicos)'
      },
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

// ============ WHATSAPP NOTIFICATIONS ============

// Enviar notificación de prueba por WhatsApp
app.post('/api/whatsapp/test', async (req, res) => {
  try {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      return res.status(400).json({ error: 'WhatsApp no está habilitado' });
    }
    
    if (!WhatsAppNotifier) {
      return res.status(500).json({ error: 'Módulo WhatsApp no disponible' });
    }
    
    const { message } = req.body;
    const testMessage = message || '🧪 Mensaje de prueba del Sincronizador ERP';
    
    await WhatsAppNotifier.sendNotification(testMessage);
    
    res.json({
      success: true,
      message: 'Notificación WhatsApp enviada exitosamente'
    });
  } catch (error) {
    Logger.error('Error enviando notificación WhatsApp:', error.message);
    res.status(500).json({ error: 'Error enviando notificación WhatsApp' });
  }
});

// Obtener estado de WhatsApp
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      return res.json({
        enabled: false,
        status: 'disabled',
        message: 'WhatsApp no está habilitado en la configuración'
      });
    }
    
    if (!WhatsAppNotifier) {
      return res.json({
        enabled: true,
        status: 'error',
        message: 'Módulo WhatsApp no se pudo cargar'
      });
    }
    
    const status = await WhatsAppNotifier.getStatus();
    res.json(status);
  } catch (error) {
    Logger.error('Error obteniendo estado WhatsApp:', error.message);
    res.status(500).json({ error: 'Error obteniendo estado WhatsApp' });
  }
});

// ============ GESTIÓN DE PRODUCTOS ============

// Restaurar producto eliminado
app.post('/api/products/restore', async (req, res) => {
  try {
    const { codInterno } = req.body;
    
    if (!codInterno) {
      return res.status(400).json({ error: 'Código interno requerido' });
    }
    
    const success = await ProductDeletionManager.restoreProduct(codInterno);
    
    if (success) {
      // Notificar por WhatsApp si está habilitado
      if (process.env.WHATSAPP_ENABLED === 'true' && WhatsAppNotifier) {
        const message = `♻️ Producto restaurado\n\nCódigo: ${codInterno}\nAcción: Restauración manual desde dashboard`;
        WhatsAppNotifier.sendNotification(message).catch(err => {
          Logger.warn('Error enviando notificación WhatsApp:', err.message);
        });
      }
      
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
      // Notificar por WhatsApp si está habilitado
      if (process.env.WHATSAPP_ENABLED === 'true' && WhatsAppNotifier) {
        const message = `🗑️ Producto eliminado\n\nCódigo: ${codInterno}\nRazón: ${reason || 'Eliminación manual'}\nAcción: Manual desde dashboard`;
        WhatsAppNotifier.sendNotification(message).catch(err => {
          Logger.warn('Error enviando notificación WhatsApp:', err.message);
        });
      }
      
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
    
    // Estado de WhatsApp
    let whatsappStatus = { enabled: false };
    if (process.env.WHATSAPP_ENABLED === 'true' && WhatsAppNotifier) {
      try {
        whatsappStatus = await WhatsAppNotifier.getStatus();
      } catch (error) {
        whatsappStatus = { enabled: true, status: 'error', message: error.message };
      }
    }
    
    // Información del sistema
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      pid: process.pid
    };
    
    // Funcionalidades activas
    const features = {
      multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
      whatsapp: process.env.WHATSAPP_ENABLED === 'true',
      email: process.env.SMTP_ENABLED === 'true',
      sms: process.env.SMS_ENABLED === 'true',
      autoSync: process.env.AUTO_SYNC_ENABLED !== 'false'
    };
    
    res.json({
      isRunning,
      dbStatus,
      cronStatus,
      whatsappStatus,
      features,
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
      version: '2.0.0',
      services: {
        database: 'connected',
        sync: cronStatus.active ? 'running' : 'stopped',
        cronJob: cronStatus,
        whatsapp: process.env.WHATSAPP_ENABLED === 'true' ? 'enabled' : 'disabled',
        multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true' ? 'enabled' : 'disabled'
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
    // Servir página básica con información de configuración
    res.send(generateBasicDashboard());
  }
});

// ============ FUNCIONES AUXILIARES ============

function checkConfigurationAndShowFeatures() {
  console.log('\n🔧 CONFIGURACIÓN DEL SISTEMA\n');
  
  // Mostrar funcionalidades activas
  const features = {
    'Multi-Inventario': process.env.MULTI_INVENTORY_ENABLED === 'true',
    'WhatsApp': process.env.WHATSAPP_ENABLED === 'true',
    'Email SMTP': process.env.SMTP_ENABLED === 'true',
    'SMS Twilio': process.env.SMS_ENABLED === 'true',
    'Webhooks': process.env.WEBHOOK_ENABLED === 'true',
    'Auto-Sync': process.env.AUTO_SYNC_ENABLED !== 'false',
    'Backup': process.env.BACKUP_ENABLED !== 'false'
  };
  
  console.log('📋 Funcionalidades activas:');
  Object.entries(features).forEach(([name, enabled]) => {
    const status = enabled ? '✅' : '❌';
    console.log(`   ${status} ${name}`);
  });
  
  // Advertencias
  if (process.env.MULTI_INVENTORY_ENABLED === 'true') {
    console.log('\n⚠️  ADVERTENCIA: Multi-inventario activado');
    console.log('   📈 Esto aumentará significativamente el uso de base de datos');
    console.log('   🔢 Se sincronizará stock para cada sucursal');
  }
  
  if (process.env.WHATSAPP_ENABLED === 'true') {
    console.log('\n📱 WhatsApp habilitado - Se enviaran notificaciones');
  }
  
  console.log('\n🚀 Para cambiar configuración, edita el archivo .env\n');
}

function generateBasicDashboard() {
  const features = {
    multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
    whatsapp: process.env.WHATSAPP_ENABLED === 'true',
    email: process.env.SMTP_ENABLED === 'true',
    sms: process.env.SMS_ENABLED === 'true',
    autoSync: process.env.AUTO_SYNC_ENABLED !== 'false'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sincronizador ERP - WooCommerce (Modular)</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .warning { background: #fff3cd; color: #856404; }
        .info { background: #d1ecf1; color: #0c5460; }
        .feature { display: inline-block; margin: 5px; padding: 8px 12px; border-radius: 15px; font-size: 0.9em; }
        .feature.enabled { background: #d4edda; color: #155724; }
        .feature.disabled { background: #f8d7da; color: #721c24; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔄 Sincronizador ERP → WooCommerce (v2.0)</h1>
        
        <div class="status success">
          ✅ Servidor ejecutándose en puerto ${PORT}
        </div>
        
        <h2>🎛️ Funcionalidades Configuradas:</h2>
        <div>
          <span class="feature ${features.multiInventory ? 'enabled' : 'disabled'}">
            📦 Multi-Inventario: ${features.multiInventory ? 'ACTIVADO' : 'DESACTIVADO'}
          </span>
          <span class="feature ${features.whatsapp ? 'enabled' : 'disabled'}">
            📱 WhatsApp: ${features.whatsapp ? 'ACTIVADO' : 'DESACTIVADO'}
          </span>
          <span class="feature ${features.email ? 'enabled' : 'disabled'}">
            📧 Email: ${features.email ? 'ACTIVADO' : 'DESACTIVADO'}
          </span>
          <span class="feature ${features.sms ? 'enabled' : 'disabled'}">
            📱 SMS: ${features.sms ? 'ACTIVADO' : 'DESACTIVADO'}
          </span>
          <span class="feature ${features.autoSync ? 'enabled' : 'disabled'}">
            🔄 Auto-Sync: ${features.autoSync ? 'ACTIVADO' : 'DESACTIVADO'}
          </span>
        </div>
        
        ${features.multiInventory ? `
        <div class="status warning">
          ⚠️ MULTI-INVENTARIO ACTIVADO: La base de datos crecerá exponencialmente con el stock por sucursal
        </div>
        ` : ''}
        
        <div class="grid">
          <div>
            <h3>🔧 Control del Sistema:</h3>
            <button onclick="startCron()">▶️ Iniciar Auto-Sync</button>
            <button onclick="stopCron()">⏹️ Detener Auto-Sync</button>
            <button onclick="checkStatus()">🔍 Verificar Estado</button>
            <button onclick="manualSync()">🚀 Sync Manual</button>
          </div>
          
          <div>
            <h3>📱 WhatsApp (${features.whatsapp ? 'Activo' : 'Inactivo'}):</h3>
            ${features.whatsapp ? `
            <button onclick="testWhatsApp()">📱 Probar WhatsApp</button>
            <button onclick="checkWhatsAppStatus()">📊 Estado WhatsApp</button>
            ` : `
            <p>Para activar WhatsApp, configura WHATSAPP_ENABLED=true en .env</p>
            `}
          </div>
        </div>
        
        <div class="status info" id="cronStatus">
          ⏳ Verificando estado del cron job...
        </div>
        
        <h2>🌐 APIs Disponibles:</h2>
        <ul>
          <li><a href="/api/config">GET /api/config</a> - Configuración del sistema</li>
          <li><a href="/api/stats">GET /api/stats</a> - Estadísticas de sincronización</li>
          <li><a href="/api/system/status">GET /api/system/status</a> - Estado completo del sistema</li>
          <li><a href="/api/cron/status">GET /api/cron/status</a> - Estado del cron job</li>
          <li><a href="/api/whatsapp/status">GET /api/whatsapp/status</a> - Estado de WhatsApp</li>
          <li><a href="/health">GET /health</a> - Health check</li>
        </ul>
        
        <h2>📋 Configuración (.env):</h2>
        <p>Para modificar funcionalidades, edita el archivo .env:</p>
        <ul>
          <li><strong>MULTI_INVENTORY_ENABLED</strong>=true/false - Activar multi-inventario</li>
          <li><strong>WHATSAPP_ENABLED</strong>=true/false - Activar notificaciones WhatsApp</li>
          <li><strong>AUTO_SYNC_ENABLED</strong>=true/false - Activar sincronización automática</li>
          <li><strong>SYNC_INTERVAL_MINUTES</strong>=10 - Intervalo de sincronización</li>
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
        
        async function manualSync() {
          try {
            const response = await fetch('/api/sync/start', { method: 'POST' });
            const data = await response.json();
            alert('Sincronización manual iniciada');
            checkStatus();
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
        
        async function testWhatsApp() {
          try {
            const response = await fetch('/api/whatsapp/test', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: '🧪 Prueba desde dashboard del Sincronizador ERP' })
            });
            const data = await response.json();
            alert(data.message || 'Mensaje WhatsApp enviado');
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
        
        async function checkWhatsAppStatus() {
          try {
            const response = await fetch('/api/whatsapp/status');
            const data = await response.json();
            alert('Estado WhatsApp: ' + data.status + '\\n' + (data.message || ''));
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
        setInterval(checkStatus, 30000); // Actualizar cada 30 segundos
      </script>
    </body>
    </html>
  `;
}

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
    Logger.info('🚀 Inicializando aplicación modular...');
    
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
    const dirs = ['logs', 'backups', 'tmp', 'dashboard', 'modules'];
    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        Logger.info(`📁 Directorio creado: ${dir}`);
      }
    });
    
    // Inicializar WhatsApp si está habilitado
    if (process.env.WHATSAPP_ENABLED === 'true' && WhatsAppNotifier) {
      try {
        await WhatsAppNotifier.initialize();
        Logger.info('📱 WhatsApp inicializado correctamente');
      } catch (error) {
        Logger.warn('⚠️ Error inicializando WhatsApp:', error.message);
      }
    }
    
    // Verificar y forzar inicio del cron job si está habilitado
    if (process.env.AUTO_SYNC_ENABLED !== 'false') {
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
    } else {
      Logger.info('ℹ️ Auto-sync deshabilitado (AUTO_SYNC_ENABLED=false)');
    }
    
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
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  🔄 SINCRONIZADOR ERP → WOOCOMMERCE (v2.0 MODULAR)          ║
║                                                              ║
║  📊 Dashboard: http://localhost:${PORT}                           ║
║  🏥 Health: http://localhost:${PORT}/health                       ║
║  ⚙️ Config: http://localhost:${PORT}/api/config                   ║
║                                                              ║
║  🎛️ Multi-Inventario: ${process.env.MULTI_INVENTORY_ENABLED === 'true' ? '✅ ACTIVADO' : '❌ DESACTIVADO'}              ║
║  📱 WhatsApp: ${process.env.WHATSAPP_ENABLED === 'true' ? '✅ ACTIVADO' : '❌ DESACTIVADO'}                     ║
║  🔄 Auto-Sync: ${process.env.AUTO_SYNC_ENABLED !== 'false' ? '✅ ACTIVADO' : '❌ DESACTIVADO'}                    ║
║                                                              ║
║  Status: ✅ EJECUTÁNDOSE                                     ║
║  Versión: 2.0.0 (Sistema Modular)                          ║
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
  if (WhatsAppNotifier) {
    WhatsAppNotifier.disconnect();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('📴 Señal SIGINT recibida, cerrando servidor...');
  stopCronJob();
  if (WhatsAppNotifier) {
    WhatsAppNotifier.disconnect();
  }
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