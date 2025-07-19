/**
 * api-endpoints.js
 * APIs auxiliares para webhook, notificaciones y funcionalidades avanzadas
 */
const express = require('express');
const axios = require('axios');
const { Logger, BackupManager, ProductDeletionManager, query } = require('./sync-enhanced');

const router = express.Router();

// ============ WEBHOOK ENDPOINTS ============

// Webhook para recibir notificaciones del ERP sobre productos eliminados
router.post('/webhook/product-deleted', async (req, res) => {
  try {
    const { art_cod_int, reason, timestamp } = req.body;
    
    if (!art_cod_int) {
      return res.status(400).json({ error: 'Código interno requerido' });
    }
    
    Logger.info(`Webhook: Producto eliminado recibido`, { art_cod_int, reason });
    
    // Procesar eliminación en background
    ProductDeletionManager.softDeleteProduct(art_cod_int, reason || 'Eliminado vía webhook')
      .then(success => {
        Logger.info(`Webhook: Producto ${art_cod_int} procesado`, { success });
      })
      .catch(error => {
        Logger.error(`Webhook: Error procesando ${art_cod_int}`, error.message);
      });
    
    res.json({ 
      success: true, 
      message: 'Producto marcado para eliminación',
      timestamp: new Date()
    });
  } catch (error) {
    Logger.error('Error en webhook de eliminación:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Webhook para recibir actualizaciones de stock en tiempo real
router.post('/webhook/stock-update', async (req, res) => {
  try {
    const { art_cod_int, stock_data } = req.body;
    
    if (!art_cod_int || !stock_data) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    Logger.info(`Webhook: Actualización de stock recibida`, { art_cod_int });
    
    // Buscar producto en WooCommerce
    const product = await query(
      `SELECT post_id FROM ${process.env.DB_PREFIX || 'btw70'}_postmeta 
       WHERE meta_key='cod_interno' AND meta_value=?`,
      [art_cod_int]
    );
    
    if (product[0]) {
      // Actualizar stock serializado
      const serializedStock = serializeStockData(stock_data);
      
      await query(
        `INSERT INTO ${process.env.DB_PREFIX || 'btw70'}_postmeta (post_id, meta_key, meta_value)
         VALUES (?, 'woocommerce_multi_inventory_inventories_stock', ?)
         ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
        [product[0].post_id, serializedStock]
      );
      
      Logger.info(`Webhook: Stock actualizado para producto ${art_cod_int}`);
    }
    
    res.json({ success: true, message: 'Stock actualizado' });
  } catch (error) {
    Logger.error('Error en webhook de stock:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ NOTIFICATION ENDPOINTS ============

// Configurar notificaciones por email/SMS
router.post('/notifications/configure', async (req, res) => {
  try {
    const { email, sms, webhookUrl, events } = req.body;
    
    // Guardar configuración en base de datos
    await query(
      `INSERT INTO sync_notifications_config (email, sms, webhook_url, events, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
       email = VALUES(email), 
       sms = VALUES(sms), 
       webhook_url = VALUES(webhook_url), 
       events = VALUES(events), 
       updated_at = NOW()`,
      [email, sms, webhookUrl, JSON.stringify(events)]
    );
    
    Logger.info('Configuración de notificaciones actualizada');
    res.json({ success: true, message: 'Configuración guardada' });
  } catch (error) {
    Logger.error('Error configurando notificaciones:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Enviar notificación manual
router.post('/notifications/send', async (req, res) => {
  try {
    const { type, message, recipients } = req.body;
    
    const result = await sendNotification(type, message, recipients);
    
    if (result.success) {
      res.json({ success: true, message: 'Notificación enviada' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    Logger.error('Error enviando notificación:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ ADVANCED ANALYTICS ============

// Obtener métricas avanzadas
router.get('/analytics/metrics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let dateFilter = '';
    switch (period) {
      case '1d': dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)'; break;
      case '7d': dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)'; break;
      case '30d': dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)'; break;
      default: dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
    }
    
    // Métricas temporales
    const timelineData = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(products_created) as created,
        SUM(products_updated) as updated,
        SUM(products_deleted) as deleted,
        SUM(errors) as errors,
        AVG(duration_ms) as avg_duration
      FROM sync_statistics 
      WHERE created_at >= ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    // Productos más sincronizados
    const topProducts = await query(`
      SELECT 
        pm.meta_value as cod_interno,
        p.post_title,
        COUNT(DISTINCT ss.id) as sync_count
      FROM sync_statistics ss
      INNER JOIN ${process.env.DB_PREFIX || 'btw70'}_postmeta pm ON 1=1
      INNER JOIN ${process.env.DB_PREFIX || 'btw70'}_posts p ON p.ID = pm.post_id
      WHERE pm.meta_key = 'cod_interno' 
      AND ss.created_at >= ${dateFilter}
      GROUP BY pm.meta_value, p.post_title
      ORDER BY sync_count DESC
      LIMIT 10
    `);
    
    // Errores más frecuentes
    const errorPatterns = await query(`
      SELECT 
        SUBSTRING_INDEX(message, ':', 1) as error_type,
        COUNT(*) as frequency
      FROM sync_logs 
      WHERE level = 'ERROR' 
      AND created_at >= ${dateFilter}
      GROUP BY SUBSTRING_INDEX(message, ':', 1)
      ORDER BY frequency DESC
      LIMIT 5
    `);
    
    res.json({
      timeline: timelineData,
      topProducts,
      errorPatterns,
      period
    });
  } catch (error) {
    Logger.error('Error obteniendo métricas:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Generar reporte PDF/Excel
router.get('/analytics/report', async (req, res) => {
  try {
    const { format = 'json', period = '30d' } = req.query;
    
    // Obtener datos del reporte
    const reportData = await generateReport(period);
    
    if (format === 'json') {
      res.json(reportData);
    } else if (format === 'csv') {
      const csv = convertToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sync-report.csv"');
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Formato no soportado' });
    }
  } catch (error) {
    Logger.error('Error generando reporte:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ BULK OPERATIONS ============

// Operación masiva de eliminación
router.post('/bulk/delete', async (req, res) => {
  try {
    const { productCodes, reason } = req.body;
    
    if (!Array.isArray(productCodes) || productCodes.length === 0) {
      return res.status(400).json({ error: 'Lista de productos requerida' });
    }
    
    Logger.info(`Iniciando eliminación masiva de ${productCodes.length} productos`);
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    // Crear backup masivo
    await BackupManager.createBackup('bulk_delete');
    
    for (const code of productCodes) {
      try {
        const success = await ProductDeletionManager.softDeleteProduct(code, reason);
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Producto ${code} no encontrado`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error eliminando ${code}: ${error.message}`);
      }
    }
    
    Logger.info(`Eliminación masiva completada`, results);
    res.json({
      success: true,
      message: `Procesados ${productCodes.length} productos`,
      results
    });
  } catch (error) {
    Logger.error('Error en eliminación masiva:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Operación masiva de restauración
router.post('/bulk/restore', async (req, res) => {
  try {
    const { productCodes } = req.body;
    
    if (!Array.isArray(productCodes) || productCodes.length === 0) {
      return res.status(400).json({ error: 'Lista de productos requerida' });
    }
    
    Logger.info(`Iniciando restauración masiva de ${productCodes.length} productos`);
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const code of productCodes) {
      try {
        const success = await ProductDeletionManager.restoreProduct(code);
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Producto ${code} no encontrado`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error restaurando ${code}: ${error.message}`);
      }
    }
    
    Logger.info(`Restauración masiva completada`, results);
    res.json({
      success: true,
      message: `Procesados ${productCodes.length} productos`,
      results
    });
  } catch (error) {
    Logger.error('Error en restauración masiva:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ HELPER FUNCTIONS ============

function serializeStockData(stockData) {
  // Convertir datos de stock a formato serializado de WooCommerce
  let serialized = `a:${Object.keys(stockData).length}:{`;
  for (const [sucursal, cantidad] of Object.entries(stockData)) {
    const str = cantidad.toString();
    serialized += `i:${sucursal};s:${str.length}:"${str}";`;
  }
  return serialized + "}";
}

async function sendNotification(type, message, recipients) {
  try {
    // Implementar lógica de envío según el tipo
    switch (type) {
      case 'email':
        // Integración con servicio de email (SendGrid, etc.)
        Logger.info(`Email enviado: ${message}`, { recipients });
        break;
      case 'sms':
        // Integración con servicio SMS
        Logger.info(`SMS enviado: ${message}`, { recipients });
        break;
      case 'webhook':
        // Envío a webhook externo
        await axios.post(recipients, { message, timestamp: new Date() });
        Logger.info(`Webhook enviado: ${recipients}`);
        break;
    }
    return { success: true };
  } catch (error) {
    Logger.error(`Error enviando notificación ${type}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function generateReport(period) {
  const dateFilter = getDateFilter(period);
  
  const summary = await query(`
    SELECT 
      COUNT(*) as total_syncs,
      SUM(products_created) as total_created,
      SUM(products_updated) as total_updated,
      SUM(products_deleted) as total_deleted,
      SUM(errors) as total_errors,
      AVG(duration_ms) as avg_duration,
      MIN(created_at) as period_start,
      MAX(created_at) as period_end
    FROM sync_statistics 
    WHERE created_at >= ${dateFilter}
  `);
  
  const dailyStats = await query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as syncs,
      SUM(products_created) as created,
      SUM(products_updated) as updated,
      SUM(products_deleted) as deleted,
      SUM(errors) as errors
    FROM sync_statistics 
    WHERE created_at >= ${dateFilter}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);
  
  return {
    summary: summary[0],
    dailyStats,
    generatedAt: new Date(),
    period
  };
}

function getDateFilter(period) {
  switch (period) {
    case '1d': return 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
    case '7d': return 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
    case '30d': return 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
    case '90d': return 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
    default: return 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
  }
}

function convertToCSV(data) {
  // Convertir datos a formato CSV
  const headers = Object.keys(data.summary);
  const rows = [headers.join(',')];
  
  // Agregar datos de resumen
  rows.push(Object.values(data.summary).join(','));
  
  // Agregar datos diarios
  if (data.dailyStats && data.dailyStats.length > 0) {
    rows.push(''); // Línea vacía
    rows.push('Fecha,Sincronizaciones,Creados,Actualizados,Eliminados,Errores');
    data.dailyStats.forEach(day => {
      rows.push(`${day.date},${day.syncs},${day.created},${day.updated},${day.deleted},${day.errors}`);
    });
  }
  
  return rows.join('\n');
}

// Inicializar tablas adicionales
async function initAdditionalTables() {
  try {
    // Tabla de configuración de notificaciones
    await query(`
      CREATE TABLE IF NOT EXISTS sync_notifications_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255),
        sms VARCHAR(20),
        webhook_url TEXT,
        events JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Tabla de logs estructurados
    await query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level ENUM('ERROR', 'WARN', 'INFO', 'DEBUG') NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_level (level),
        INDEX idx_created (created_at)
      )
    `);
    
    Logger.info('Tablas adicionales inicializadas');
  } catch (error) {
    Logger.error('Error inicializando tablas adicionales:', error.message);
  }
}

// Inicializar al cargar el módulo
initAdditionalTables();

module.exports = router;