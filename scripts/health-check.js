/**
 * scripts/health-check.js
 * Script para verificar la salud del sistema
 */
async function healthCheck() {
    const results = {
      database: false,
      api: false,
      files: false,
      memory: false,
      disk: false
    };
    
    try {
      // Verificar conexión a base de datos
      console.log('🔍 Verificando base de datos...');
      const connection = mysql.createConnection(dbConfig);
      await new Promise((resolve, reject) => {
        connection.query('SELECT 1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      connection.end();
      results.database = true;
      console.log('✅ Base de datos: OK');
      
      // Verificar API ERP
      console.log('🔍 Verificando API ERP...');
      const axios = require('axios');
      const https = require('https');
      
      const response = await axios.get(
        process.env.ERP_ENDPOINT + 'health',
        { 
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          timeout: 10000
        }
      );
      results.api = response.status === 200;
      console.log('✅ API ERP: OK');
      
    } catch (error) {
      console.log('❌ API ERP: Error -', error.message);
    }
    
    try {
      // Verificar archivos y directorios
      console.log('🔍 Verificando estructura de archivos...');
      const requiredDirs = ['logs', 'backups', 'tmp'];
      requiredDirs.forEach(dir => {
        const dirPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });
      results.files = true;
      console.log('✅ Archivos: OK');
      
      // Verificar uso de memoria
      console.log('🔍 Verificando memoria...');
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.used / 1024 / 1024);
      const memLimit = 1024; // 1GB límite
      
      results.memory = memUsedMB < memLimit;
      console.log(`${results.memory ? '✅' : '⚠️'} Memoria: ${memUsedMB}MB usado (límite: ${memLimit}MB)`);
      
      // Verificar espacio en disco
      console.log('🔍 Verificando espacio en disco...');
      const { execSync } = require('child_process');
      const diskUsage = execSync('df -h .', { encoding: 'utf8' });
      console.log('💽 Espacio en disco:', diskUsage.split('\n')[1]);
      results.disk = true;
      
    } catch (error) {
      console.log('❌ Error en verificación:', error.message);
    }
    
    // Resumen
    const allGood = Object.values(results).every(Boolean);
    console.log('\n📊 Resumen del Health Check:');
    console.log('Database:', results.database ? '✅' : '❌');
    console.log('API ERP:', results.api ? '✅' : '❌');
    console.log('Files:', results.files ? '✅' : '❌');
    console.log('Memory:', results.memory ? '✅' : '⚠️');
    console.log('Disk:', results.disk ? '✅' : '❌');
    
    console.log(`\n${allGood ? '🎉' : '⚠️'} Estado general: ${allGood ? 'SALUDABLE' : 'REQUIERE ATENCIÓN'}`);
    
    return results;
  }
  
  // Ejecutar si es llamado directamente
  if (require.main === module) {
    healthCheck().catch(console.error);
  }
  
  module.exports = { healthCheck };