#!/usr/bin/env node

/**
 * start.js
 * Script de inicio inteligente para el Sincronizador ERP
 * Verifica prerrequisitos y inicia el sistema correctamente
 */

 const fs = require('fs');
 const path = require('path');
 const { spawn } = require('child_process');
 
 console.log('🚀 INICIADOR INTELIGENTE - Sincronizador ERP\n');
 
 async function main() {
     try {
         // Paso 1: Verificar prerrequisitos
         console.log('📋 Verificando prerrequisitos...\n');
         await checkPrerequisites();
         
         // Paso 2: Configurar entorno
         console.log('\n⚙️ Configurando entorno...\n');
         await setupEnvironment();
         
         // Paso 3: Iniciar aplicación
         console.log('\n🚀 Iniciando aplicación...\n');
         await startApplication();
         
     } catch (error) {
         console.error('\n❌ Error durante el inicio:', error.message);
         console.log('\n🛠️ Ejecuta el diagnóstico: node troubleshoot.js');
         process.exit(1);
     }
 }
 
 async function checkPrerequisites() {
     // Verificar Node.js
     const nodeVersion = process.version;
     const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
     
     if (majorVersion < 16) {
         throw new Error(`Node.js ${nodeVersion} no es compatible. Requerido: v16.0.0 o superior`);
     }
     console.log(`✅ Node.js ${nodeVersion} - Compatible`);
     
     // Verificar archivos principales
     const requiredFiles = ['app.js', 'sync-enhanced.js', 'package.json'];
     for (const file of requiredFiles) {
         if (!fs.existsSync(file)) {
             throw new Error(`Archivo requerido no encontrado: ${file}`);
         }
     }
     console.log('✅ Archivos principales encontrados');
     
     // Verificar package.json
     const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
     if (!packageJson.dependencies) {
         throw new Error('package.json no tiene dependencias definidas');
     }
     console.log('✅ package.json válido');
 }
 
 async function setupEnvironment() {
     // Crear directorios necesarios
     const dirs = ['logs', 'backups', 'tmp', 'dashboard'];
     dirs.forEach(dir => {
         if (!fs.existsSync(dir)) {
             fs.mkdirSync(dir, { recursive: true });
             console.log(`📁 Directorio creado: ${dir}/`);
         }
     });
     
     // Verificar .env
     if (!fs.existsSync('.env')) {
         console.log('⚠️  Archivo .env no encontrado');
         console.log('📝 Creando configuración básica...');
         createBasicEnv();
         console.log('✅ Archivo .env creado');
         console.log('📋 IMPORTANTE: Edita .env con tus credenciales antes de continuar');
         
         // Preguntar si continuar
         const readline = require('readline');
         const rl = readline.createInterface({
             input: process.stdin,
             output: process.stdout
         });
         
         return new Promise((resolve) => {
             rl.question('\n¿Deseas continuar con la configuración por defecto? (s/n): ', (answer) => {
                 rl.close();
                 if (answer.toLowerCase() !== 's') {
                     console.log('\n⏸️  Inicio pausado. Edita .env y ejecuta nuevamente: npm start');
                     process.exit(0);
                 }
                 resolve();
             });
         });
     } else {
         console.log('✅ Archivo .env encontrado');
     }
     
     // Verificar node_modules
     if (!fs.existsSync('node_modules')) {
         console.log('📦 Instalando dependencias...');
         await runCommand('npm', ['install']);
         console.log('✅ Dependencias instaladas');
     } else {
         console.log('✅ Dependencias ya instaladas');
     }
     
     // Cargar variables de entorno
     require('dotenv').config();
     
     // Verificar variables críticas
     const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
     const missing = requiredVars.filter(key => !process.env[key]);
     
     if (missing.length > 0) {
         console.log(`⚠️  Variables faltantes en .env: ${missing.join(', ')}`);
         console.log('📝 Estas variables son requeridas para funcionar');
     } else {
         console.log('✅ Variables de entorno configuradas');
     }
 }
 
 async function startApplication() {
     console.log('🔥 Iniciando servidor...');
     
     // Detectar modo de ejecución
     const args = process.argv.slice(2);
     const isDevelopment = args.includes('--dev') || process.env.NODE_ENV === 'development';
     
     if (isDevelopment) {
         console.log('🛠️  Modo desarrollo activado');
         // Usar nodemon si está disponible
         try {
             require.resolve('nodemon');
             await runCommand('npx', ['nodemon', 'app.js']);
         } catch (e) {
             console.log('⚠️  nodemon no disponible, usando modo normal');
             await runCommand('node', ['app.js']);
         }
     } else {
         console.log('🏭 Modo producción');
         await runCommand('node', ['app.js']);
     }
 }
 
 function createBasicEnv() {
     const basicEnv = `# ===================================================================
 # CONFIGURACIÓN BÁSICA - Sincronizador ERP
 # Generado automáticamente el ${new Date().toLocaleString('es-PY')}
 # ===================================================================
 
 # ============ SERVIDOR ============
 NODE_ENV=production
 PORT=3001
 HOST=0.0.0.0
 
 # ============ BASE DE DATOS ============
 # IMPORTANTE: Configura estos valores con tus credenciales reales
 DB_HOST=srv1313.hstgr.io
 DB_USER=u377556581_vWMEZ
 DB_PASSWORD=NJdPaC3A$j7DCzE&yU^P
 DB_NAME=u377556581_OXkxK
 DB_PREFIX=btw70
 DB_CONNECTION_LIMIT=15
 DB_TIMEOUT=30000
 
 # ============ API ERP ============
 # IMPORTANTE: Configura la URL de tu ERP
 ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/
 ERP_API_KEY=
 ERP_TIMEOUT=30000
 ERP_RETRY_ATTEMPTS=3
 
 # ============ CONFIGURACIÓN DE SINCRONIZACIÓN ============
 SYNC_INTERVAL_MINUTES=10
 SYNC_MAX_RETRIES=3
 SYNC_TIMEOUT_SECONDS=300
 SYNC_BATCH_SIZE=100
 AUTO_SYNC_ENABLED=true
 
 # ============ CONFIGURACIÓN DE LOGS ============
 LOG_LEVEL=INFO
 LOG_MAX_SIZE=10mb
 LOG_MAX_FILES=30
 LOG_DATE_FORMAT=DD/MM/YYYY HH:mm:ss
 LOG_TIMEZONE=America/Asuncion
 
 # ============ CONFIGURACIÓN DE BACKUP ============
 BACKUP_RETENTION_DAYS=30
 BACKUP_AUTO_CLEANUP=true
 BACKUP_COMPRESSION=true
 
 # ============ CONFIGURACIÓN DE NOTIFICACIONES (OPCIONAL) ============
 SMTP_ENABLED=false
 SMTP_HOST=smtp.gmail.com
 SMTP_PORT=587
 SMTP_SECURE=false
 SMTP_USER=tu_email@gmail.com
 SMTP_PASS=tu_password_de_aplicacion
 
 SMS_ENABLED=false
 TWILIO_ACCOUNT_SID=tu_twilio_account_sid
 TWILIO_AUTH_TOKEN=tu_twilio_auth_token
 TWILIO_PHONE_NUMBER=+1234567890
 
 # ============ CONFIGURACIÓN DE SEGURIDAD ============
 JWT_SECRET=jwt_secret_generado_automaticamente_${Date.now()}
 API_RATE_LIMIT=100
 API_RATE_WINDOW=900000
 CORS_ORIGIN=*
 
 # ============ CONFIGURACIÓN DE TIMEZONE ============
 TZ=America/Asuncion
 
 # ============ CONFIGURACIÓN DEL DASHBOARD ============
 DASHBOARD_ENABLED=true
 DASHBOARD_AUTH_REQUIRED=false
 DASHBOARD_USERNAME=admin
 DASHBOARD_PASSWORD=admin123
 
 # ===================================================================
 # NOTAS:
 # 1. Edita las credenciales de base de datos (DB_*)
 # 2. Configura la URL del ERP (ERP_ENDPOINT)
 # 3. Ajusta el intervalo de sincronización si es necesario
 # 4. Habilita notificaciones si las necesitas
 # ===================================================================
 `;
 
     fs.writeFileSync('.env', basicEnv);
 }
 
 function runCommand(command, args) {
     return new Promise((resolve, reject) => {
         console.log(`🔧 Ejecutando: ${command} ${args.join(' ')}`);
         
         const child = spawn(command, args, {
             stdio: 'inherit',
             shell: process.platform === 'win32'
         });
         
         child.on('close', (code) => {
             if (code === 0) {
                 resolve();
             } else {
                 reject(new Error(`Comando falló con código: ${code}`));
             }
         });
         
         child.on('error', (error) => {
             reject(error);
         });
     });
 }
 
 // Manejo de señales para cierre limpio
 process.on('SIGINT', () => {
     console.log('\n\n📴 Cerrando iniciador...');
     process.exit(0);
 });
 
 process.on('SIGTERM', () => {
     console.log('\n\n📴 Cerrando iniciador...');
     process.exit(0);
 });
 
 // Ejecutar si es llamado directamente
 if (require.main === module) {
     console.log('Argumentos recibidos:', process.argv.slice(2));
     main().catch(error => {
         console.error('\n💥 Error crítico en el iniciador:', error.message);
         process.exit(1);
     });
 }
 
 module.exports = { main, checkPrerequisites, setupEnvironment };