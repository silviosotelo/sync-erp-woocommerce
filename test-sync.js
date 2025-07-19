#!/usr/bin/env node

/**
 * test-sync.js
 * Script de prueba para verificar que el sincronizador funcione correctamente
 */

 const fs = require('fs');
 const path = require('path');
 const axios = require('axios');
 
 console.log('🧪 PRUEBA DEL SISTEMA - Sincronizador ERP\n');
 
 async function main() {
     const results = {
         environment: false,
         database: false,
         api: false,
         cron: false,
         sync: false
     };
     
     try {
         console.log('📋 Ejecutando batería de pruebas...\n');
         
         // Prueba 1: Verificar entorno
         results.environment = await testEnvironment();
         
         // Prueba 2: Verificar base de datos
         results.database = await testDatabase();
         
         // Prueba 3: Verificar API ERP
         results.api = await testERPAPI();
         
         // Prueba 4: Verificar cron job (si el servidor está corriendo)
         results.cron = await testCronJob();
         
         // Prueba 5: Prueba de sincronización
         if (results.database && results.api) {
             results.sync = await testSynchronization();
         }
         
         // Mostrar resultados
         showResults(results);
         
         // Generar reporte
         generateReport(results);
         
     } catch (error) {
         console.error('❌ Error durante las pruebas:', error.message);
         process.exit(1);
     }
 }
 
 async function testEnvironment() {
     console.log('🔍 Prueba 1: Verificando entorno...');
     
     try {
         // Cargar variables de entorno
         require('dotenv').config();
         
         // Verificar Node.js
         const nodeVersion = process.version;
         const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
         
         if (majorVersion < 16) {
             console.log(`   ❌ Node.js ${nodeVersion} no compatible (requerido: v16+)`);
             return false;
         }
         
         // Verificar variables requeridas
         const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'ERP_ENDPOINT'];
         const missing = required.filter(key => !process.env[key]);
         
         if (missing.length > 0) {
             console.log(`   ❌ Variables faltantes: ${missing.join(', ')}`);
             return false;
         }
         
         // Verificar archivos
         const files = ['app.js', 'sync-enhanced.js', 'package.json'];
         for (const file of files) {
             if (!fs.existsSync(file)) {
                 console.log(`   ❌ Archivo faltante: ${file}`);
                 return false;
             }
         }
         
         console.log('   ✅ Entorno configurado correctamente');
         return true;
         
     } catch (error) {
         console.log(`   ❌ Error: ${error.message}`);
         return false;
     }
 }
 
 async function testDatabase() {
     console.log('🔍 Prueba 2: Verificando base de datos...');
     
     try {
         const mysql = require('mysql');
         
         const dbConfig = {
             host: process.env.DB_HOST,
             user: process.env.DB_USER,
             password: process.env.DB_PASSWORD,
             database: process.env.DB_NAME,
             timeout: 10000
         };
         
         return new Promise((resolve) => {
             const connection = mysql.createConnection(dbConfig);
             
             connection.connect((err) => {
                 if (err) {
                     console.log(`   ❌ Error de conexión: ${err.message}`);
                     resolve(false);
                     return;
                 }
                 
                 // Probar consulta
                 connection.query('SELECT 1 as test', (queryErr, results) => {
                     if (queryErr) {
                         console.log(`   ❌ Error de consulta: ${queryErr.message}`);
                         connection.end();
                         resolve(false);
                         return;
                     }
                     
                     // Verificar tabla de WordPress
                     const prefix = process.env.DB_PREFIX || 'btw70';
                     connection.query(`SHOW TABLES LIKE '${prefix}_posts'`, (tableErr, tables) => {
                         connection.end();
                         
                         if (tableErr || tables.length === 0) {
                             console.log(`   ❌ Tabla ${prefix}_posts no encontrada`);
                             resolve(false);
                         } else {
                             console.log('   ✅ Conexión a base de datos exitosa');
                             resolve(true);
                         }
                     });
                 });
             });
         });
         
     } catch (error) {
         console.log(`   ❌ Error: ${error.message}`);
         return false;
     }
 }
 
 async function testERPAPI() {
     console.log('🔍 Prueba 3: Verificando API ERP...');
     
     try {
         const https = require('https');
         
         const response = await axios.get(
             process.env.ERP_ENDPOINT + 'producto',
             { 
                 httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                 timeout: 15000
             }
         );
         
         if (response.status === 200) {
             const productos = response.data.value || [];
             console.log(`   ✅ API ERP responde correctamente (${productos.length} productos disponibles)`);
             return true;
         } else {
             console.log(`   ❌ API ERP respondió con código: ${response.status}`);
             return false;
         }
         
     } catch (error) {
         console.log(`   ❌ Error conectando al API ERP: ${error.message}`);
         return false;
     }
 }
 
 async function testCronJob() {
     console.log('🔍 Prueba 4: Verificando cron job...');
     
     try {
         // Intentar conectar al servidor local para verificar el cron
         const port = process.env.PORT || 3001;
         
         const response = await axios.get(`http://localhost:${port}/api/cron/status`, {
             timeout: 5000
         });
         
         if (response.data.status.active) {
             console.log(`   ✅ Cron job activo (intervalo: ${response.data.status.interval} minutos)`);
             return true;
         } else {
             console.log('   ⚠️  Cron job inactivo');
             return false;
         }
         
     } catch (error) {
         console.log(`   ⚠️  Servidor no responde (${error.message})`);
         console.log('   💡 Inicia el servidor con: npm start');
         return false;
     }
 }
 
 async function testSynchronization() {
     console.log('🔍 Prueba 5: Prueba de sincronización...');
     
     try {
         // Importar módulo de sincronización
         const { main, Logger } = require('./sync-enhanced');
         
         console.log('   🔄 Ejecutando sincronización de prueba...');
         
         const result = await main();
         
         if (result) {
             const { productsCreated, productsUpdated, productsDeleted, errors } = result;
             console.log(`   ✅ Sincronización exitosa:`);
             console.log(`      - Creados: ${productsCreated}`);
             console.log(`      - Actualizados: ${productsUpdated}`);
             console.log(`      - Eliminados: ${productsDeleted}`);
             console.log(`      - Errores: ${errors}`);
             return true;
         } else {
             console.log('   ❌ Sincronización falló');
             return false;
         }
         
     } catch (error) {
         console.log(`   ❌ Error en sincronización: ${error.message}`);
         return false;
     }
 }
 
 function showResults(results) {
     console.log('\n📊 RESULTADOS DE LAS PRUEBAS\n');
     
     const tests = [
         { name: 'Entorno', key: 'environment' },
         { name: 'Base de Datos', key: 'database' },
         { name: 'API ERP', key: 'api' },
         { name: 'Cron Job', key: 'cron' },
         { name: 'Sincronización', key: 'sync' }
     ];
     
     let passed = 0;
     const total = tests.length;
     
     tests.forEach(test => {
         const status = results[test.key] ? '✅ PASS' : '❌ FAIL';
         console.log(`${status} ${test.name}`);
         if (results[test.key]) passed++;
     });
     
     console.log(`\n📈 Resultado: ${passed}/${total} pruebas exitosas`);
     
     if (passed === total) {
         console.log('🎉 ¡TODAS LAS PRUEBAS EXITOSAS! El sistema está funcionando correctamente.');
     } else if (passed >= 3) {
         console.log('⚠️  La mayoría de pruebas exitosas. Revisa los errores mostrados arriba.');
     } else {
         console.log('❌ Múltiples fallas detectadas. Ejecuta el diagnóstico: node troubleshoot.js');
     }
 }
 
 function generateReport(results) {
     const timestamp = new Date().toISOString();
     const report = {
         timestamp,
         nodeVersion: process.version,
         platform: process.platform,
         results,
         summary: {
             total: Object.keys(results).length,
             passed: Object.values(results).filter(Boolean).length,
             failed: Object.values(results).filter(r => !r).length
         }
     };
     
     // Crear directorio de reportes si no existe
     const reportsDir = path.join(__dirname, 'reports');
     if (!fs.existsSync(reportsDir)) {
         fs.mkdirSync(reportsDir, { recursive: true });
     }
     
     // Generar nombre de archivo
     const date = new Date().toISOString().split('T')[0];
     const reportFile = path.join(reportsDir, `test-report-${date}.json`);
     
     // Guardar reporte
     fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
     console.log(`\n📋 Reporte guardado en: ${reportFile}`);
 }
 
 // Función para mostrar ayuda
 function showHelp() {
     console.log(`
 🧪 Script de Prueba del Sincronizador ERP
 
 Uso:
   node test-sync.js [opciones]
 
 Opciones:
   --help, -h     Mostrar esta ayuda
   --quick        Ejecutar solo pruebas rápidas (sin sincronización)
   --verbose      Mostrar información detallada
   --report-only  Solo generar reporte sin ejecutar pruebas
 
 Ejemplos:
   node test-sync.js           # Ejecutar todas las pruebas
   node test-sync.js --quick   # Pruebas rápidas solamente
   node test-sync.js --verbose # Información detallada
 
 Nota: Para las pruebas completas, asegúrate de que el archivo .env esté configurado.
 `);
 }
 
 // Procesamiento de argumentos
 const args = process.argv.slice(2);
 
 if (args.includes('--help') || args.includes('-h')) {
     showHelp();
     process.exit(0);
 }
 
 // Ejecutar pruebas
 if (require.main === module) {
     const isQuick = args.includes('--quick');
     const isVerbose = args.includes('--verbose');
     
     if (isVerbose) {
         console.log('🔧 Modo verbose activado');
         process.env.LOG_LEVEL = 'DEBUG';
     }
     
     if (isQuick) {
         console.log('⚡ Modo rápido: omitiendo prueba de sincronización\n');
     }
     
     main().catch(error => {
         console.error('\n💥 Error crítico durante las pruebas:', error.message);
         process.exit(1);
     });
 }
 
 module.exports = { main, testEnvironment, testDatabase, testERPAPI, testCronJob, testSynchronization };