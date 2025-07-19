/**
 * scripts/init-database.js
 * Script para inicializar la base de datos con las tablas necesarias
 */
const mysql = require('mysql');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || "srv1313.hstgr.io",
  user: process.env.DB_USER || "u377556581_vWMEZ",
  password: process.env.DB_PASSWORD || "NJdPaC3A$j7DCzE&yU^P",
  database: process.env.DB_NAME || "u377556581_OXkxK",
};

const DB_PREFIX = process.env.DB_PREFIX || "btw70";

const connection = mysql.createConnection(dbConfig);

function query(sql) {
  return new Promise((resolve, reject) => {
    connection.query(sql, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

async function initDatabase() {
  try {
    console.log('🚀 Inicializando base de datos...');
    
    // Tabla de estadísticas de sincronización
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
    console.log('✅ Tabla sync_statistics creada');

    // Tabla de configuración de notificaciones
    await query(`
      CREATE TABLE IF NOT EXISTS sync_notifications_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255),
        sms VARCHAR(20),
        webhook_url TEXT,
        events JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla sync_notifications_config creada');

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla sync_logs creada');

    // Tabla de auditoría de cambios
    await query(`
      CREATE TABLE IF NOT EXISTS sync_audit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE') NOT NULL,
        product_code VARCHAR(100),
        product_id INT,
        old_data JSON,
        new_data JSON,
        user_agent VARCHAR(255),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product_code (product_code),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla sync_audit creada');

    // Tabla de configuración del sistema
    await query(`
      CREATE TABLE IF NOT EXISTS sync_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla sync_config creada');

    // Insertar configuración por defecto
    await query(`
      INSERT IGNORE INTO sync_config (config_key, config_value, description) VALUES
      ('sync_interval', '10', 'Intervalo de sincronización en minutos'),
      ('max_retries', '3', 'Máximo número de reintentos por producto'),
      ('backup_retention', '30', 'Días de retención de backups'),
      ('log_level', 'INFO', 'Nivel de logging'),
      ('enable_notifications', '1', 'Habilitar notificaciones'),
      ('api_timeout', '30000', 'Timeout de API en milisegundos')
    `);
    console.log('✅ Configuración por defecto insertada');

    // Verificar que las vistas necesarias existen
    const views = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = '${dbConfig.database}' 
      AND TABLE_NAME IN ('eco_sucursal_v', 'eco_categorias_v')
    `);
    
    if (views.length < 2) {
      console.log('⚠️  Advertencia: Las vistas eco_sucursal_v y/o eco_categorias_v no existen');
      console.log('   Asegúrate de crearlas en tu base de datos ERP');
    } else {
      console.log('✅ Vistas ERP verificadas');
    }

    console.log('🎉 Base de datos inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    process.exit(1);
  } finally {
    connection.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };

// =============================================================================
