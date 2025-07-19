#!/usr/bin/env node

/**
 * troubleshoot.js
 * Script de diagnóstico y solución de problemas para el Sincronizador ERP
 */

 const fs = require('fs');
 const path = require('path');
 const mysql = require('mysql');
 
 console.log('🔧 DIAGNÓSTICO Y SOLUCIÓN DE PROBLEMAS - Sincronizador ERP\n');
 
 async function main() {
     console.log('📋 Ejecutando diagnóstico completo...\n');
     
     const results = {
         environment: await checkEnvironment(),
         database: await checkDatabase(),
         files: await checkFiles(),
         dependencies: await checkDependencies(),
         api: await checkAPI(),
         cron: await checkCronJob(),
         permissions: await checkPermissions()
     };
     
     console.log('\n📊 RESUMEN DEL DIAGNÓSTICO\n');
     
     let allGood = true;
     for (const [category, result] of Object.entries(results)) {
         const status = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
         console.log(`${status} ${category.toUpperCase()}: ${result.message}`);
         if (result.status === 'ERROR') allGood = false;
     }
     
     if (allGood) {
         console.log('\n🎉 DIAGNÓSTICO COMPLETADO: Todo parece estar funcionando correctamente');
         console.log('\n💡 Si el cron job aún no funciona, intenta:');
         console.log('   1. Reiniciar el servidor: npm start');
         console.log('   2. Verificar logs: tail -f logs/$(date +%Y-%m-%d).log');
         console.log('   3. Verificar estado: curl http://localhost:3001/api/cron/status');
     } else {
         console.log('\n⚠️ DIAGNÓSTICO COMPLETADO: Se encontraron problemas que requieren atención');
         
         // Mostrar soluciones específicas
         console.log('\n🛠️ SOLUCIONES RECOMENDADAS:\n');
         for (const [category, result] of Object.entries(results)) {
             if (result.status === 'ERROR' && result.solution) {
                 console.log(`🔧 ${category.toUpperCase()}:`);
                 console.log(`   Problema: ${result.message}`);
                 console.log(`   Solución: ${result.solution}\n`);
             }
         }
     }
 }
 
 async function checkEnvironment() {
     try {
         console.log('🔍 Verificando variables de entorno...');
         
         require('dotenv').config();
         
         const required = [
             'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 
             'ERP_ENDPOINT'
         ];
         
         const missing = required.filter(key => !process.env[key]);
         
         if (missing.length > 0) {
             return {
                 status: 'ERROR',
                 message: `Variables faltantes: ${missing.join(', ')}`,
                 solution: 'Crear o completar el archivo .env con todas las variables requeridas'
             };
         }
         
         // Verificar que .env existe
         if (!fs.existsSync('.env')) {
             return {
                 status: 'ERROR',
                 message: 'Archivo .env no encontrado',
                 solution: 'Ejecutar: node setup.js para crear configuración inicial'
             };
         }
         
         console.log('   ✅ Variables de entorno OK');
         return {
             status: 'OK',
             message: 'Variables de entorno configuradas correctamente'
         };
         
     } catch (error) {
         return {
             status: 'ERROR',
             message: `Error verificando entorno: ${error.message}`,
             solution: 'Verificar sintaxis del archivo .env'
         };
     }
 }
 
 async function checkDatabase() {
     try {
         console.log('🔍 Verificando conexión a base de datos...');
         
         require('dotenv').config();
         
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
                     resolve({
                         status: 'ERROR',
                         message: `Error de conexión: ${err.message}`,
                         solution: 'Verificar credenciales de base de datos en .env'
                     });
                     return;
                 }
                 
                 connection.query('SELECT 1', (queryErr) => {
                     connection.end();
                     
                     if (queryErr) {
                         resolve({
                             status: 'ERROR',
                             message: `Error de consulta: ${queryErr.message}`,
                             solution: 'Verificar permisos de base de datos'
                         });
                     } else {
                         console.log('   ✅ Conexión a base de datos OK');
                         resolve({
                             status: 'OK',
                             message: 'Conexión a base de datos exitosa'
                         });
                     }
                 });
             });
         });
         
     } catch (error) {
         return {
             status: 'ERROR',
             message: `Error configurando conexión: ${error.message}`,
             solution: 'Verificar configuración de base de datos en .env'
         };
     }
 }
 
 async function checkFiles() {
     try {
         console.log('🔍 Verificando archivos y directorios...');
         
         const requiredFiles = [
             'app.js',
             'sync-enhanced.js',
             'package.json'
         ];
         
         const requiredDirs = [
             'logs',
             'backups',
             'tmp'
         ];
         
         // Verificar archivos
         for (const file of requiredFiles) {
             if (!fs.existsSync(file)) {
                 return {
                     status: 'ERROR',
                     message: `Archivo faltante: ${file}`,
                     solution: 'Asegurar que todos los archivos del proyecto estén presentes'
                 };
             }
         }
         
         // Crear directorios si no existen
         for (const dir of requiredDirs) {
             if (!fs.existsSync(dir)) {
                 fs.mkdirSync(dir, { recursive: true });
                 console.log(`   📁 Directorio creado: ${dir}`);
             }
         }
         
         console.log('   ✅ Archivos y directorios OK');
         return {
             status: 'OK',
             message: 'Todos los archivos necesarios están presentes'
         };
         
     } catch (error) {
         return {
             status: 'ERROR',
             message: `Error verificando archivos: ${error.message}`,
             solution: 'Verificar permisos del sistema de archivos'
         };
     }
 }
 
 async function checkDependencies() {
     try {
         console.log('🔍 Verificando dependencias...');
         
         // Verificar node_modules
         if (!fs.existsSync('node_modules')) {
             return {
                 status: 'ERROR',
                 message: 'Directorio node_modules no encontrado',
                 solution: 'Ejecutar: npm install'
             };
         }
         
         // Verificar dependencias críticas
         const criticalDeps = [
             'express',
             'mysql',
             'node-cron',
             'axios',
             'dotenv'
         ];
         
         for (const dep of criticalDeps) {
             try {
                 require.resolve(dep);
             } catch (e) {
                 return {
                     status: 'ERROR',
                     message: `Dependencia faltante: ${dep}`,
                     solution: 'Ejecutar: npm install'
                 };
             }
         }
         
         console.log('   ✅ Dependencias OK');
         return {
             status: 'OK',
             message: 'Todas las dependencias están instaladas'
         };
         
     } catch (error) {
         return {
             status: 'ERROR',
             message: `Error verificando dependencias: ${error.message}`,
             solution: 'Ejecutar: npm install --force'
         };
     }
 }
 
 async function checkAPI() {
     try {
         console.log('🔍 Verificando conexión al API ERP...');
         
         require('dotenv').config();
         
         if (!process.env.ERP_ENDPOINT) {
             return {
                 status: 'WARNING',
                 message: 'ERP_ENDPOINT no configurado',
                 solution: 'Configurar ERP_ENDPOINT en el archivo .env'
             };
         }
         
         const axios = require('axios');
         const https = require('https');
         
         const response = await axios.get(
             process.env.ERP_ENDPOINT + 'producto',
             { 
                 httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                 timeout: 10000
             }
         );
         
         if (response.status === 200) {
             console.log('   ✅ API ERP OK');
             return {
                 status: 'OK',
                 message: 'Conexión al API ERP exitosa'
             };
         } else {
             return {
                 status: 'WARNING',
                 message: `API ERP respondió con código: ${response.status}`,
                 solution: 'Verificar estado del servidor ERP'
             };
         }
         
     } catch (error) {
         return {
             status: 'WARNING',
             message: `Error conectando al API ERP: ${error.message}`,
             solution: 'Verificar URL del ERP y conectividad de red'
         };
     }
 }
 
 async function checkCronJob() {
     try {
         console.log('🔍 Verificando configuración del cron job...');
         
         // Verificar que node-cron esté disponible
         try {
             require('node-cron');
         } catch (e) {
             return {
                 status: 'ERROR',
                 message: 'node-cron no está instalado',
                 solution: 'Ejecutar: npm install node-cron'
             };
         }
         
         // Verificar archivo lock
         const lockFile = path.join(__dirname, 'tmp', 'sync.lock');
         if (fs.existsSync(lockFile)) {
             // Verificar si es un lock antiguo
             const stats = fs.statSync(lockFile);
             const now = new Date();
             const lockAge = now - stats.mtime;
             
             if (lockAge > 30 * 60 * 1000) { // 30 minutos
                 fs.unlinkSync(lockFile);
                 console.log('   🧹 Lock file antiguo eliminado');
             } else {
                 return {
                     status: 'WARNING',
                     message: 'Proceso de sincronización puede estar ejecutándose',
                     solution: 'Esperar o eliminar manualmente el archivo tmp/sync.lock'
                 };
             }
         }
         
         console.log('   ✅ Configuración del cron job OK');
         return {
             status: 'OK',
             message: 'Configuración del cron job correcta'
         };
         
     } catch (error) {
         return {
             status: 'ERROR',
             message: `Error verificando cron job: ${error.message}`,
             solution: 'Verificar instalación de node-cron'
         };
     }
 }
 
 async function checkPermissions() {
     try {
         console.log('🔍 Verificando permisos de archivos...');
         
         // Verificar permisos de escritura en directorios críticos
         const testDirs = ['logs', 'backups', 'tmp'];
         
         for (const dir of testDirs) {
             const testFile = path.join(dir, 'test-write.tmp');
             try {
                 fs.writeFileSync(testFile, 'test');
                 fs.unlinkSync(testFile);
             } catch (e) {
                 return {
                     status: 'ERROR',
                     message: `Sin permisos de escritura en: ${dir}`,
                     solution: `Verificar permisos del directorio ${dir}`
                 };
             }
         }
         
         console.log('   ✅ Permisos OK');
         return {
             status: 'OK',
             message: 'Permisos de archivos correctos'
         };
         
     } catch (error) {
         return {
             status: 'ERROR',
             message: `Error verificando permisos: ${error.message}`,
             solution: 'Verificar permisos del directorio del proyecto'
         };
     }
 }
 
 // Función adicional para crear configuración básica
 function createBasicSetup() {
     console.log('\n🛠️ CREANDO CONFIGURACIÓN BÁSICA...\n');
     
     // Crear .env si no existe
     if (!fs.existsSync('.env')) {
         const basicEnv = `# Configuración básica - EDITAR ESTOS VALORES
 NODE_ENV=production
 PORT=3001
 
 # Base de datos MySQL/MariaDB
 DB_HOST=srv1313.hstgr.io
 DB_USER=u377556581_vWMEZ
 DB_PASSWORD=NJdPaC3A$j7DCzE&yU^P
 DB_NAME=u377556581_OXkxK
 DB_PREFIX=btw70
 
 # API del ERP
 ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/
 ERP_API_KEY=
 
 # Configuración de sincronización
 SYNC_INTERVAL_MINUTES=10
 AUTO_SYNC_ENABLED=true
 LOG_LEVEL=INFO
 
 # Timezone
 TZ=America/Asuncion
 `;
         
         fs.writeFileSync('.env', basicEnv);
         console.log('✅ Archivo .env creado');
         console.log('⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales reales');
     }
     
     // Crear directorios
     const dirs = ['logs', 'backups', 'tmp', 'dashboard'];
     dirs.forEach(dir => {
         if (!fs.existsSync(dir)) {
             fs.mkdirSync(dir, { recursive: true });
             console.log(`✅ Directorio ${dir} creado`);
         }
     });
     
     console.log('\n✅ Configuración básica completada');
 }
 
 // Ejecutar diagnóstico
 if (require.main === module) {
     // Verificar si se debe crear configuración básica
     const args = process.argv.slice(2);
     if (args.includes('--setup')) {
         createBasicSetup();
         process.exit(0);
     }
     
     main().catch(error => {
         console.error('❌ Error durante el diagnóstico:', error.message);
         process.exit(1);
     });
 }
 
 module.exports = { main, createBasicSetup };