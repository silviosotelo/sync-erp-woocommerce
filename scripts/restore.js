/**
 * scripts/restore.js
 * Script para restaurar desde backup
 */
async function restoreFromBackup(backupPath) {
    try {
      console.log(`🔄 Restaurando desde backup: ${backupPath}`);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup no encontrado: ${backupPath}`);
      }
      
      // Verificar estructura del backup
      const metadataPath = path.join(backupPath, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        console.log(`📋 Backup info:`, metadata);
      }
      
      // Restaurar base de datos
      const dbBackupFile = path.join(backupPath, 'database.sql');
      if (fs.existsSync(dbBackupFile)) {
        console.log('📄 Restaurando base de datos...');
        const mysqlCmd = `mysql -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} < ${dbBackupFile}`;
        execSync(mysqlCmd, { stdio: 'inherit' });
        console.log('✅ Base de datos restaurada');
      }
      
      // Restaurar configuración
      const configFiles = ['.env', 'ecosystem.config.js'];
      configFiles.forEach(file => {
        const srcPath = path.join(backupPath, file);
        const destPath = path.join(__dirname, '..', file);
        if (fs.existsSync(srcPath)) {
          console.log(`⚙️  Restaurando ${file}...`);
          fs.copyFileSync(srcPath, destPath);
        }
      });
      
      console.log('🎉 Restauración completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error durante la restauración:', error.message);
      throw error;
    }
  }
  
  // Ejecutar si es llamado directamente
  if (require.main === module) {
    const backupPath = process.argv[2];
    if (!backupPath) {
      console.error('❌ Uso: node restore.js <ruta-del-backup>');
      process.exit(1);
    }
    
    restoreFromBackup(backupPath).catch(console.error);
  }
  
  module.exports = { restoreFromBackup };
  
  // =============================================================================
  
  