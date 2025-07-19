
/**
 * scripts/backup.js
 * Script para crear backups manuales del sistema
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function createFullBackup() {
  try {
    console.log('🔄 Creando backup completo...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', `full-backup-${timestamp}`);
    
    // Crear directorio de backup
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Backup de base de datos
    console.log('📄 Backing up database...');
    const dbBackupFile = path.join(backupDir, 'database.sql');
    
    const mysqldumpCmd = `mysqldump -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${dbBackupFile}`;
    execSync(mysqldumpCmd, { stdio: 'inherit' });
    
    // Backup de configuración
    console.log('⚙️  Backing up configuration...');
    const configFiles = ['.env', 'package.json', 'ecosystem.config.js'];
    configFiles.forEach(file => {
      const srcPath = path.join(__dirname, '..', file);
      const destPath = path.join(backupDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    });
    
    // Backup de logs recientes (últimos 7 días)
    console.log('📋 Backing up recent logs...');
    const logsDir = path.join(__dirname, '..', 'logs');
    const backupLogsDir = path.join(backupDir, 'logs');
    fs.mkdirSync(backupLogsDir, { recursive: true });
    
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir)
        .filter(file => {
          const fileDate = new Date(file.replace('.log', ''));
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return fileDate >= weekAgo;
        });
      
      logFiles.forEach(file => {
        fs.copyFileSync(
          path.join(logsDir, file),
          path.join(backupLogsDir, file)
        );
      });
    }
    
    // Crear archivo de metadatos
    const metadata = {
      timestamp: new Date().toISOString(),
      version: require('../package.json').version,
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development'
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log(`✅ Backup completo creado en: ${backupDir}`);
    return backupDir;
    
  } catch (error) {
    console.error('❌ Error creando backup:', error.message);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createFullBackup().catch(console.error);
}

module.exports = { createFullBackup };

// =============================================================================

