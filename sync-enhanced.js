/**
 * sync-enhanced.js - VERSIÓN MODULAR v2.0
 * Sincronizador ERP ↔ WooCommerce con configuración modular completa
 * Funcionalidades configurables via .env
 */
const axios = require("axios");
const https = require("https");
const mysql = require("mysql");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const lockfile = require("lockfile");

// ---------- Cargar configuración -------------
require('dotenv').config();

// ---------- Configuración modular -------------
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 15,
  timeout: parseInt(process.env.DB_TIMEOUT) || 30000
};

const DB_PREFIX = process.env.DB_PREFIX || 'btw70';
const endpoint = process.env.ERP_ENDPOINT;

// Configuración de funcionalidades
const features = {
  multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
  whatsapp: process.env.WHATSAPP_ENABLED === 'true',
  email: process.env.SMTP_ENABLED === 'true',
  sms: process.env.SMS_ENABLED === 'true',
  backup: process.env.BACKUP_ENABLED !== 'false',
  autoSync: process.env.AUTO_SYNC_ENABLED !== 'false'
};

// Configuración de sincronización
const syncConfig = {
  interval: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 10,
  maxRetries: parseInt(process.env.SYNC_MAX_RETRIES) || 3,
  timeout: parseInt(process.env.SYNC_TIMEOUT_SECONDS) * 1000 || 300000,
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100
};

// --------- Directorios ------------
const tmpDir = path.join(__dirname, process.env.TEMP_DIR || "tmp");
const logDir = path.join(__dirname, process.env.LOGS_DIR || "logs");
const backupDir = path.join(__dirname, process.env.BACKUP_DIR || "backups");
const lockFile = path.join(tmpDir, "sync.lock");

[tmpDir, logDir, backupDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ------------ Pool MySQL --------------
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  queueLimit: 0,
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
  });
}

// ------------ Logger Avanzado ------------------
class Logger {
  static levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  static currentLevel = this.levels[process.env.LOG_LEVEL] || this.levels.INFO;

  static log(level, msg, data = null) {
    if (this.levels[level] > this.currentLevel) return;
    
    const date = new Date()
      .toLocaleDateString("es-PY", {
        timeZone: process.env.LOG_TIMEZONE || "America/Asuncion",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
      .split("/")
      .reverse()
      .join("-");
    
    const logFile = path.join(logDir, `${date}.log`);
    const ts = new Date().toLocaleString("es-PY", { 
      timeZone: process.env.LOG_TIMEZONE || "America/Asuncion" 
    });
    const logEntry = data ? `${ts} | [${level}] ${msg} | ${JSON.stringify(data)}` : `${ts} | [${level}] ${msg}`;
    
    fs.appendFileSync(logFile, logEntry + "\n");
    console.log(logEntry);

    // Enviar notificación crítica si está habilitada
    if (level === 'ERROR' && features.whatsapp) {
      try {
        const WhatsAppNotifier = require('./modules/whatsapp-notifier');
        WhatsAppNotifier.sendErrorAlert(msg, data?.context || 'Sistema').catch(() => {});
      } catch (error) {
        // Silenciosamente ignorar si WhatsApp no está disponible
      }
    }
  }

  static error(msg, data) { this.log('ERROR', msg, data); }
  static warn(msg, data) { this.log('WARN', msg, data); }
  static info(msg, data) { this.log('INFO', msg, data); }
  static debug(msg, data) { this.log('DEBUG', msg, data); }
}

// ------------ Sistema de Backup Mejorado --------------
class BackupManager {
  static async createBackup(type, productId = null) {
    if (!features.backup) {
      Logger.debug('Backup deshabilitado, saltando...');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${type}-${timestamp}-${productId || 'bulk'}.json`);
    
    try {
      let data;
      if (productId) {
        // Backup de producto específico
        const product = await query(
          `SELECT p.*, GROUP_CONCAT(CONCAT(pm.meta_key, ':', pm.meta_value) SEPARATOR '|') as metadata
           FROM ${DB_PREFIX}_posts p 
           LEFT JOIN ${DB_PREFIX}_postmeta pm ON p.ID = pm.post_id 
           WHERE p.ID = ? AND p.post_type = 'product'
           GROUP BY p.ID`,
          [productId]
        );
        data = { 
          type: 'single_product', 
          productId, 
          product: product[0],
          features,
          timestamp
        };
      } else {
        // Backup masivo
        data = { 
          type: 'bulk_operation', 
          timestamp, 
          note: 'Pre-operation backup',
          features,
          config: syncConfig
        };
      }
      
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
      Logger.debug(`Backup creado: ${backupFile}`);
      
      // Limpiar backups antiguos
      await this.cleanOldBackups();
      
      return backupFile;
    } catch (error) {
      Logger.error(`Error creando backup: ${error.message}`);
      throw error;
    }
  }

  static async cleanOldBackups() {
    try {
      const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const files = fs.readdirSync(backupDir);
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.birthtime < cutoffDate) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        Logger.info(`🧹 Limpieza de backups: ${cleanedCount} archivos antiguos eliminados`);
      }
    } catch (error) {
      Logger.warn(`Error limpiando backups antiguos: ${error.message}`);
    }
  }

  static async restoreFromBackup(backupFile) {
    try {
      const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      if (backup.type === 'single_product' && backup.product) {
        await this.restoreProduct(backup.product);
        Logger.info(`Producto restaurado desde backup: ${backupFile}`);
      }
    } catch (error) {
      Logger.error(`Error restaurando backup: ${error.message}`);
      throw error;
    }
  }

  static async restoreProduct(productData) {
    const { ID, post_title, post_content, post_status, metadata } = productData;
    
    await query(
      `UPDATE ${DB_PREFIX}_posts 
       SET post_title=?, post_content=?, post_status=?, post_modified=NOW() 
       WHERE ID=?`,
      [post_title, post_content, post_status, ID]
    );
    
    if (metadata) {
      const metaPairs = metadata.split('|');
      for (const pair of metaPairs) {
        const [key, value] = pair.split(':');
        await query(
          `INSERT INTO ${DB_PREFIX}_postmeta (post_id, meta_key, meta_value) 
           VALUES (?, ?, ?) 
           ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
          [ID, key, value]
        );
      }
    }
  }
}

// ------------ Estadísticas y Métricas Mejoradas --------------
class SyncStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.stats = {
      startTime: new Date(),
      productsCreated: 0,
      productsUpdated: 0,
      productsDeleted: 0,
      errors: 0,
      apiCalls: 0,
      endTime: null,
      features: { ...features },
      config: { ...syncConfig }
    };
  }

  increment(metric) {
    if (this.stats.hasOwnProperty(metric)) {
      this.stats[metric]++;
    }
  }

  finish() {
    this.stats.endTime = new Date();
    this.stats.duration = this.stats.endTime - this.stats.startTime;
  }

  getSummary() {
    return {
      ...this.stats,
      durationMs: this.stats.duration,
      durationMinutes: Math.round(this.stats.duration / 60000 * 100) / 100
    };
  }
}

// ------------ Gestor de Productos Eliminados Mejorado --------------
class ProductDeletionManager {
  static async getDeletedProducts() {
    try {
      const resp = await axios.get(
        `${endpoint}producto/deleted`,
        { 
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          timeout: syncConfig.timeout
        }
      );
      return resp.data.value || [];
    } catch (error) {
      Logger.warn(`Endpoint de eliminados no disponible: ${error.message}`);
      return [];
    }
  }

  static async softDeleteProduct(codInterno, reason = 'Eliminado del ERP') {
    try {
      const rows = await query(
        `SELECT post_id FROM ${DB_PREFIX}_postmeta 
         WHERE meta_key='cod_interno' AND meta_value=?`,
        [codInterno]
      );

      if (!rows[0]) {
        Logger.warn(`Producto no encontrado para eliminación: ${codInterno}`);
        return false;
      }

      const postId = rows[0].post_id;
      
      // Crear backup antes de eliminar (si está habilitado)
      if (features.backup) {
        await BackupManager.createBackup('deletion', postId);
      }

      // Verificar si tiene órdenes pendientes
      const hasOrders = await this.checkPendingOrders(postId);
      if (hasOrders) {
        Logger.warn(`Producto ${codInterno} tiene órdenes pendientes, marcando como oculto`);
        await this.hideProduct(postId);
      } else {
        await query(
          `UPDATE ${DB_PREFIX}_posts 
           SET post_status='trash', post_modified=NOW() 
           WHERE ID=?`,
          [postId]
        );

        await query(
          `INSERT INTO ${DB_PREFIX}_postmeta (post_id, meta_key, meta_value) 
           VALUES (?, 'deletion_reason', ?), (?, 'deletion_date', NOW())
           ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
          [postId, reason, postId]
        );
      }

      Logger.info(`Producto eliminado/oculto: ${codInterno}`, { postId, hasOrders });
      
      // Notificar por WhatsApp si está habilitado
      if (features.whatsapp) {
        try {
          const WhatsAppNotifier = require('./modules/whatsapp-notifier');
          const message = `🗑️ Producto eliminado\n\nCódigo: ${codInterno}\nRazón: ${reason}`;
          WhatsAppNotifier.sendNotification(message).catch(() => {});
        } catch (error) {
          Logger.debug('WhatsApp no disponible para notificación');
        }
      }
      
      return true;
    } catch (error) {
      Logger.error(`Error eliminando producto ${codInterno}: ${error.message}`);
      return false;
    }
  }

  static async checkPendingOrders(postId) {
    const orders = await query(
      `SELECT COUNT(*) as count 
       FROM ${DB_PREFIX}_woocommerce_order_items oi
       INNER JOIN ${DB_PREFIX}_woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
       INNER JOIN ${DB_PREFIX}_posts o ON oi.order_id = o.ID
       WHERE oim.meta_key = '_product_id' 
       AND oim.meta_value = ? 
       AND o.post_status IN ('wc-processing', 'wc-pending', 'wc-on-hold')`,
      [postId]
    );
    return orders[0].count > 0;
  }

  static async hideProduct(postId) {
    await query(
      `UPDATE ${DB_PREFIX}_posts 
       SET post_status='private' 
       WHERE ID=?`,
      [postId]
    );
    
    await query(
      `INSERT INTO ${DB_PREFIX}_postmeta (post_id, meta_key, meta_value) 
       VALUES (?, '_visibility', 'hidden')
       ON DUPLICATE KEY UPDATE meta_value = 'hidden'`,
      [postId]
    );
  }

  static async restoreProduct(codInterno) {
    try {
      const rows = await query(
        `SELECT post_id FROM ${DB_PREFIX}_postmeta 
         WHERE meta_key='cod_interno' AND meta_value=?`,
        [codInterno]
      );

      if (!rows[0]) return false;

      const postId = rows[0].post_id;
      
      await query(
        `UPDATE ${DB_PREFIX}_posts 
         SET post_status='publish' 
         WHERE ID=?`,
        [postId]
      );

      await query(
        `DELETE FROM ${DB_PREFIX}_postmeta 
         WHERE post_id=? AND meta_key IN ('deletion_reason', 'deletion_date')`,
        [postId]
      );

      Logger.info(`Producto restaurado: ${codInterno}`, { postId });
      
      // Notificar por WhatsApp si está habilitado
      if (features.whatsapp) {
        try {
          const WhatsAppNotifier = require('./modules/whatsapp-notifier');
          const message = `♻️ Producto restaurado\n\nCódigo: ${codInterno}`;
          WhatsAppNotifier.sendNotification(message).catch(() => {});
        } catch (error) {
          Logger.debug('WhatsApp no disponible para notificación');
        }
      }
      
      return true;
    } catch (error) {
      Logger.error(`Error restaurando producto ${codInterno}: ${error.message}`);
      return false;
    }
  }
}

// --------- Utilidades ----------------
function toGs(n) {
  return new Intl.NumberFormat("es-PY").format(n);
}

function slugify(text) {
  return text.toString().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// ----- Mapeo de sucursales (condicional) -----
let sucursalMap = new Map();
let allTermIds = [];

async function initMappings() {
  if (features.multiInventory) {
    try {
      const rows = await query(
        `SELECT term_id, codigo_erp FROM eco_sucursal_v ORDER BY term_id ASC`
      );
      rows.forEach(r => {
        const code = Number(r.codigo_erp);
        sucursalMap.set(code, r.term_id);
        allTermIds.push(r.term_id);
      });
      Logger.info(`📦 Multi-inventario activado: ${sucursalMap.size} sucursales mapeadas`);
    } catch (error) {
      Logger.warn('Error mapeando sucursales:', error.message);
      // Deshabilitar multi-inventario si hay error
      features.multiInventory = false;
      Logger.warn('🔧 Multi-inventario deshabilitado por error en mapping');
    }
  } else {
    Logger.info('📦 Multi-inventario deshabilitado - Solo productos básicos');
  }
}

// ----- Serializar existencias (condicional) --------
async function getSerializedStock(art_cod_int) {
  if (!features.multiInventory) {
    Logger.debug(`Saltando stock para ${art_cod_int} - Multi-inventario deshabilitado`);
    return null;
  }

  try {
    const resp = await axios.get(
      `${endpoint}product/list/stock/${art_cod_int}`,
      { 
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: syncConfig.timeout
      }
    );
    
    const exist = {};
    resp.data.value.forEach(s => {
      const code = Number(s.suc_codigo);
      const t = sucursalMap.get(code);
      if (t !== undefined) {
        exist[t] = s.suc_cantidad;
      }
    });
    
    let s = `a:${allTermIds.length}:{`;
    allTermIds.forEach(id => {
      const qty = (exist[id] !== undefined) ? exist[id] : 0;
      const str = qty.toString();
      s += `i:${id};s:${str.length}:"${str}";`;
    });
    return s + "}";
  } catch (error) {
    Logger.warn(`Error obteniendo stock para ${art_cod_int}: ${error.message}`);
    return null;
  }
}

// ------ Procesar un producto (mejorado) ---------
async function processProduct(p, stats) {
  try {
    stats.increment('apiCalls');
    
    const rows = await query(
      `SELECT MAX(post_id) AS id
         FROM ${DB_PREFIX}_postmeta
        WHERE meta_key='cod_interno' AND meta_value=?`,
      [p.art_cod_int]
    );
    
    const postId = rows[0].id;
    const now = new Date();
    
    // Obtener stock solo si multi-inventario está habilitado
    const stock = await getSerializedStock(p.art_cod_int);

    // Array común de metadatos
    const metas = [
      ["_price", p.art_precio_promo],
      ["_regular_price", p.art_precio_vta],
      ["_sale_price", p.art_precio_promo],
      ["_sku", p.art_codigo],
      ["cod_interno", p.art_cod_int],
      ["porc_dcto", p.art_porc_promo || 0],
      ["cod_promocion", p.art_cod_promo || 0],
      ["ind_controlado", p.art_controlado || "N"],
      ["ind_ecommerce", p.art_ind_ecommerce || "S"],
      ["ind_destacado", p.art_ind_destacado || "N"],
      ["fecha_sincronizacion", now.toLocaleString("es-PY", { 
        timeZone: process.env.LOG_TIMEZONE || "America/Asuncion" 
      })]
    ];

    // Solo agregar stock si multi-inventario está habilitado y hay datos
    if (stock && features.multiInventory) {
      metas.push(["woocommerce_multi_inventory_inventories_stock", stock]);
      Logger.debug(`Stock multi-inventario sincronizado para ${p.art_cod_int}`);
    }

    if (postId) {
      // Crear backup antes de actualizar (si está habilitado)
      if (features.backup) {
        await BackupManager.createBackup('update', postId);
      }
      
      // Actualización con upsert masivo
      const ph = metas.map(_ => '(?,?,?)').join(',');
      const vals = metas.flatMap(([k, v]) => [postId, k, v]);
      
      await query(
        `INSERT INTO ${DB_PREFIX}_postmeta (post_id,meta_key,meta_value)
           VALUES ${ph}
         ON DUPLICATE KEY UPDATE meta_value=VALUES(meta_value)`,
        vals
      );

      // Índice de búsqueda
      const priceHtml = `<del><span>Precio Normal:</span><bdi>₲ ${toGs(p.art_precio_vta)}</bdi></del>\\
<br><ins><span>Precio Web:</span><bdi>₲ ${toGs(p.art_precio_promo)}</bdi></ins>`;
      
      await query(
        `INSERT INTO ${DB_PREFIX}_dgwt_wcas_index (post_id,html_price)
           VALUES(?,?)
         ON DUPLICATE KEY UPDATE html_price=VALUES(html_price)`,
        [postId, priceHtml]
      );

      stats.increment('productsUpdated');
      Logger.debug(`Updated SKU:${p.art_codigo} - ${p.art_desc}`);
    } else {
      // Creación completa
      const slug = slugify(p.art_desc);
      const insert = await query(
        `INSERT INTO ${DB_PREFIX}_posts
          (post_author,post_date,post_date_gmt,post_content,post_title,
           post_status,comment_status,ping_status,post_name,
           post_modified,post_modified_gmt,post_parent,menu_order,
           post_type,comment_count)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [1, now, now, "", p.art_desc,
         "publish", "closed", "closed", slug,
         now, now, 0, 0, "product", 0]
      );
      
      const newId = insert.insertId;

      // Insertar metadatos
      const ph2 = metas.map(_ => '(?,?,?)').join(',');
      const vals2 = metas.flatMap(([k, v]) => [newId, k, v]);
      
      await query(
        `INSERT INTO ${DB_PREFIX}_postmeta (post_id,meta_key,meta_value)
           VALUES ${ph2}`,
        vals2
      );

      // Índice de búsqueda inicial
      const priceHtml = `<del><span>Precio Normal:</span><bdi>₲ ${toGs(p.art_precio_vta)}</bdi></del>\\
<br><ins><span>Precio Web:</span><bdi>₲ ${toGs(p.art_precio_promo)}</bdi></ins>`;
      
      await query(
        `INSERT INTO ${DB_PREFIX}_dgwt_wcas_index
           (post_id,created_date,name,description,sku,image,url,html_price,price,lang)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [newId, now, p.art_desc, "", p.art_codigo,
         process.env.PRODUCT_IMAGE_DEFAULT || `https://www.farmatotal.com.py/wp-content/uploads/no_img-90x90.webp`,
         `https://www.farmatotal.com.py/catalogo/${slug}`,
         priceHtml, p.art_precio_promo, "en"]
      );

      // Relación categoría
      const cat = await query(
        `SELECT term_id FROM eco_categorias_v WHERE flia_codigo=?`,
        [p.flia_codigo]
      );
      const term = cat[0]?.term_id || parseInt(process.env.PRODUCT_CATEGORY_DEFAULT) || 15;
      await query(
        `INSERT INTO ${DB_PREFIX}_term_relationships (object_id,term_taxonomy_id,term_order)
           VALUES(?,?,0)`,
        [newId, term]
      );

      stats.increment('productsCreated');
      Logger.debug(`Created SKU:${p.art_codigo} - ${p.art_desc}`);
    }

    // Notificar API como consumido
    await axios.post(`${endpoint}producto`, { id: p.art_cod_int.toString() })
      .catch(e => Logger.warn(`Error API delete ${p.art_cod_int}: ${e.message}`));

  } catch (err) {
    stats.increment('errors');
    Logger.error(`Error procesando ${p.art_cod_int}: ${err.message}`, { context: 'processProduct' });
  }
}

// -------- Función principal de sincronización (mejorada) ---------
async function main() {
  const stats = new SyncStats();
  
  try {
    Logger.info("=== INICIANDO SINCRONIZACIÓN MODULAR ===");
    Logger.info(`🎛️ Configuración activa:`, features);
    
    // Verificar conexión a base de datos
    await query('SELECT 1');
    Logger.info("✅ Conexión a base de datos OK");
    
    await initMappings();
    
    // Sincronizar productos nuevos/actualizados
    Logger.info("🔄 Obteniendo productos del ERP...");
    const resp = await axios.get(
      `${endpoint}producto`,
      { 
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: syncConfig.timeout
      }
    );
    
    const productos = resp.data.value;
    if (productos.length > 0) {
      Logger.info(`Sincronizando: ${productos.length} productos`);
      
      // Procesar en lotes si está configurado
      const batchSize = syncConfig.batchSize;
      for (let i = 0; i < productos.length; i += batchSize) {
        const batch = productos.slice(i, i + batchSize);
        Logger.debug(`Procesando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(productos.length/batchSize)}`);
        
        for (const p of batch) {
          await processProduct(p, stats);
        }
        
        // Pausa pequeña entre lotes para no sobrecargar
        if (i + batchSize < productos.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
      Logger.info("No hay productos nuevos para sincronizar");
    }

    // Procesar eliminaciones
    Logger.info("🗑️ Verificando productos eliminados...");
    const deletedProducts = await ProductDeletionManager.getDeletedProducts();
    if (deletedProducts.length > 0) {
      Logger.info(`Procesando eliminaciones: ${deletedProducts.length} productos`);
      for (const deleted of deletedProducts) {
        const success = await ProductDeletionManager.softDeleteProduct(deleted.art_cod_int);
        if (success) stats.increment('productsDeleted');
      }
    } else {
      Logger.info("No hay productos para eliminar");
    }

    stats.finish();
    const summary = stats.getSummary();
    
    Logger.info(`=== SINCRONIZACIÓN COMPLETA ===`, summary);
    
    // Guardar estadísticas
    await saveStats(summary);
    
    // Enviar reporte por WhatsApp si está habilitado
    if (features.whatsapp && (summary.productsCreated > 0 || summary.productsUpdated > 0 || summary.productsDeleted > 0 || summary.errors > 0)) {
      try {
        const WhatsAppNotifier = require('./modules/whatsapp-notifier');
        await WhatsAppNotifier.sendSyncReport(summary);
      } catch (error) {
        Logger.debug('WhatsApp no disponible para reporte');
      }
    }
    
    return summary;
    
  } catch (error) {
    Logger.error(`Error en main: ${error.message}`, { context: 'main' });
    throw error;
  }
}

// Guardar estadísticas en base de datos (mejorado)
async function saveStats(stats) {
  try {
    await query(
      `INSERT INTO sync_statistics 
       (start_time, end_time, duration_ms, products_created, products_updated, 
        products_deleted, errors, api_calls, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        stats.startTime,
        stats.endTime,
        stats.durationMs,
        stats.productsCreated,
        stats.productsUpdated,
        stats.productsDeleted,
        stats.errors,
        stats.apiCalls
      ]
    );
    
    // Limpiar estadísticas antiguas
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
    await query(
      `DELETE FROM sync_statistics 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [retentionDays]
    );
    
  } catch (error) {
    Logger.warn(`Error guardando estadísticas: ${error.message}`);
  }
}

// ============ SISTEMA DE CRON MEJORADO ============
let cronJob = null;
let isCronActive = false;

function startCronJob() {
  if (cronJob || isCronActive) {
    Logger.warn("Cron job ya está activo");
    return;
  }

  if (!features.autoSync) {
    Logger.info("🔇 Auto-sync deshabilitado en configuración");
    return;
  }

  const interval = syncConfig.interval;
  const cronPattern = `*/${interval} * * * *`;
  
  Logger.info(`🕒 Iniciando cron job con intervalo: cada ${interval} minutos`);
  Logger.info(`🎛️ Multi-inventario: ${features.multiInventory ? 'ACTIVADO' : 'DESACTIVADO'}`);
  
  cronJob = cron.schedule(cronPattern, async () => {
    Logger.info("⏰ Cron job activado - iniciando sincronización programada");
    
    if (lockfile.checkSync(lockFile)) {
      Logger.warn("🔒 Otra instancia en ejecución, saltando esta ronda");
      return;
    }
    
    try {
      lockfile.lockSync(lockFile, { stale: 10 * 60 * 1000 });
      await main();
    } catch (error) {
      Logger.error("❌ Error en sincronización programada: " + error.message);
    } finally {
      try {
        lockfile.unlockSync(lockFile);
      } catch (unlockError) {
        Logger.error("❌ Error unlocking file: " + unlockError.message);
      }
    }
  }, {
    scheduled: true,
    timezone: process.env.LOG_TIMEZONE || "America/Asuncion"
  });
  
  isCronActive = true;
  Logger.info(`✅ Cron job iniciado correctamente (patrón: ${cronPattern})`);
}

function stopCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    isCronActive = false;
    Logger.info("🛑 Cron job detenido");
  }
}

function getCronStatus() {
  return {
    active: isCronActive,
    scheduled: cronJob ? true : false,
    interval: syncConfig.interval,
    multiInventory: features.multiInventory,
    whatsapp: features.whatsapp,
    autoSyncEnabled: features.autoSync
  };
}

// ============ INICIALIZACIÓN AUTOMÁTICA ============
function initializeSync() {
  Logger.info("🚀 Inicializando sistema de sincronización modular...");
  Logger.info(`🎛️ Funcionalidades activas:`, features);
  Logger.info(`⚙️ Configuración de sync:`, syncConfig);
  
  // Crear tablas necesarias
  initDatabase().then(() => {
    // Iniciar cron job automáticamente si está habilitado
    if (features.autoSync) {
      startCronJob();
    } else {
      Logger.info("ℹ️ Sincronización automática deshabilitada (AUTO_SYNC_ENABLED=false)");
    }
  }).catch(error => {
    Logger.error("❌ Error inicializando base de datos:", error.message);
  });
}

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    Logger.info("✅ Tabla sync_statistics verificada");
  } catch (error) {
    Logger.error("❌ Error inicializando base de datos:", error.message);
    throw error;
  }
}

// ============ EJECUCIÓN DIRECTA ============
if (require.main === module) {
  // Si se ejecuta directamente, correr una sincronización única
  Logger.info("📁 Ejecutando sincronización única (modo directo)");
  main().catch(error => {
    Logger.error("❌ Error en ejecución directa:", error.message);
    process.exit(1);
  });
} else {
  // Si se importa como módulo, inicializar automáticamente
  Logger.info("📦 Módulo importado - inicializando sistema modular");
  initializeSync();
}

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGTERM', () => {
  Logger.info('📴 Señal SIGTERM recibida, cerrando sincronización...');
  stopCronJob();
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('📴 Señal SIGINT recibida, cerrando sincronización...');
  stopCronJob();
  process.exit(0);
});

// Exportar para uso en otros módulos
module.exports = {
  Logger,
  BackupManager,
  ProductDeletionManager,
  SyncStats,
  query,
  main,
  startCronJob,
  stopCronJob,
  getCronStatus,
  features,
  syncConfig
};