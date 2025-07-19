#!/usr/bin/env node

/**
 * install-service-native.js
 * Instalación específica de servicio nativo de Windows usando node-windows
 * Este servicio SÍ aparecerá en services.msc
 */

 const path = require('path');
 const fs = require('fs');
 const { execSync } = require('child_process');
 
 console.log('🔧 INSTALADOR DE SERVICIO NATIVO DE WINDOWS\n');
 console.log('Este servicio APARECERÁ en services.msc\n');
 
 // Verificar sistema operativo
 if (process.platform !== 'win32') {
     console.error('❌ Este script es solo para Windows');
     process.exit(1);
 }
 
 // Verificar permisos de administrador
 if (!checkAdminRights()) {
     console.error('❌ PERMISOS DE ADMINISTRADOR REQUERIDOS');
     console.log('\n📋 Instrucciones:');
     console.log('   1. Abre "Símbolo del sistema" como Administrador');
     console.log('   2. Navega a tu proyecto: cd "C:\\ruta\\a\\tu\\proyecto"');
     console.log('   3. Ejecuta: node install-service-native.js\n');
     process.exit(1);
 }
 
 async function main() {
     try {
         console.log('✅ Permisos de administrador confirmados\n');
         
         // Paso 1: Verificar prerrequisitos
         await checkPrerequisites();
         
         // Paso 2: Instalar node-windows si no está disponible
         await ensureNodeWindows();
         
         // Paso 3: Crear el servicio
         await createWindowsService();
         
     } catch (error) {
         console.error('\n❌ Error durante la instalación:', error.message);
         console.log('\n🛠️  Soluciones alternativas:');
         console.log('   1. Usar PM2: npm install -g pm2 && pm2 start ecosystem.config.js');
         console.log('   2. Usar NSSM: Descargar desde nssm.cc');
         console.log('   3. Usar Task Scheduler: taskschd.msc');
         process.exit(1);
     }
 }
 
 function checkAdminRights() {
     try {
         execSync('net session', { stdio: 'ignore' });
         return true;
     } catch (e) {
         return false;
     }
 }
 
 async function checkPrerequisites() {
     console.log('🔍 Verificando prerrequisitos...\n');
     
     // Verificar Node.js
     console.log(`✅ Node.js: ${process.version}`);
     
     // Verificar archivo principal
     const appPath = path.join(__dirname, 'app.js');
     if (!fs.existsSync(appPath)) {
         throw new Error(`No se encontró app.js en: ${appPath}`);
     }
     console.log('✅ app.js encontrado');
     
     // Verificar .env
     const envPath = path.join(__dirname, '.env');
     if (!fs.existsSync(envPath)) {
         console.log('⚠️  Archivo .env no encontrado, creando básico...');
         createBasicEnv();
     } else {
         console.log('✅ .env encontrado');
     }
     
     // Verificar node_modules
     if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
         console.log('📦 Instalando dependencias...');
         execSync('npm install', { stdio: 'inherit', cwd: __dirname });
     } else {
         console.log('✅ Dependencias instaladas');
     }
     
     console.log('✅ Todos los prerrequisitos cumplidos\n');
 }
 
 async function ensureNodeWindows() {
     console.log('🔍 Verificando node-windows...\n');
     
     try {
         require.resolve('node-windows');
         console.log('✅ node-windows ya está disponible');
     } catch (e) {
         console.log('📦 Instalando node-windows globalmente...');
         
         try {
             execSync('npm install -g node-windows', { stdio: 'inherit' });
             console.log('✅ node-windows instalado exitosamente');
             
             // Verificar que se instaló correctamente
             require.resolve('node-windows');
             
         } catch (installError) {
             throw new Error(`Error instalando node-windows: ${installError.message}`);
         }
     }
 }
 
 async function createWindowsService() {
     console.log('🚀 Creando servicio nativo de Windows...\n');
     
     const Service = require('node-windows').Service;
     
     // Configuración del servicio
     const serviceConfig = {
         name: 'Sincronizador ERP WooCommerce',
         description: 'Servicio de sincronización bidireccional entre ERP y WooCommerce - Farmatotal',
         script: path.join(__dirname, 'app.js'),
         nodeOptions: [
             '--max_old_space_size=1024'
         ],
         env: [
             {
                 name: "NODE_ENV",
                 value: "production"
             },
             {
                 name: "PORT",
                 value: "3001"
             },
             {
                 name: "PATH",
                 value: process.env.PATH
             }
         ],
         workingDirectory: __dirname,
         allowServiceLogon: true,
         maxRestarts: 10,
         maxRestartSeconds: 60,
         grow: 0.5,
         wait: 1,
         abortOnError: false
     };
     
     console.log('📋 Configuración del servicio:');
     console.log(`   Nombre: ${serviceConfig.name}`);
     console.log(`   Script: ${serviceConfig.script}`);
     console.log(`   Directorio de trabajo: ${serviceConfig.workingDirectory}`);
     console.log('');
     
     // Crear el servicio
     const svc = new Service(serviceConfig);
     
     return new Promise((resolve, reject) => {
         // Configurar eventos
         svc.on('install', function() {
             console.log('✅ Servicio instalado exitosamente en Windows');
             console.log('🚀 Iniciando servicio...');
             svc.start();
         });
         
         svc.on('start', function() {
             console.log('\n🎉 ¡SERVICIO INICIADO EXITOSAMENTE!\n');
             
             console.log('📋 Información del servicio:');
             console.log(`   Nombre: ${serviceConfig.name}`);
             console.log(`   Estado: EJECUTÁNDOSE`);
             console.log(`   Tipo de inicio: Automático`);
             console.log(`   Cuenta: Sistema local`);
             console.log('');
             
             console.log('🔧 Gestión del servicio:');
             console.log('   • Abrir "Servicios" (services.msc)');
             console.log('   • Buscar "Sincronizador ERP WooCommerce"');
             console.log('   • Click derecho para Iniciar/Detener/Reiniciar');
             console.log('');
             
             console.log('🌐 Acceso al dashboard:');
             console.log('   • URL: http://localhost:3001');
             console.log('   • Health check: http://localhost:3001/health');
             console.log('');
             
             console.log('📝 Logs del servicio:');
             console.log(`   • Carpeta: ${path.join(__dirname, 'daemon')}`);
             console.log('   • Ver logs: Explorador de eventos de Windows');
             console.log('');
             
             console.log('🗑️  Para desinstalar:');
             console.log('   • Ejecutar: node uninstall-service-native.js');
             console.log('   • O desde services.msc: Click derecho > Eliminar');
             
             resolve();
         });
         
         svc.on('error', function(err) {
             console.error('❌ Error durante la instalación del servicio:', err.message);
             reject(err);
         });
         
         svc.on('invalidinstallation', function() {
             console.error('❌ Instalación inválida del servicio');
             reject(new Error('Instalación inválida'));
         });
         
         // Verificar si el servicio ya existe
         if (svc.exists) {
             console.log('⚠️  El servicio ya existe. Desinstalando primero...');
             
             svc.on('uninstall', function() {
                 console.log('🗑️  Servicio anterior desinstalado');
                 console.log('🔄 Reinstalando servicio...');
                 
                 setTimeout(() => {
                     svc.install();
                 }, 3000);
             });
             
             svc.uninstall();
         } else {
             console.log('📦 Instalando servicio...');
             svc.install();
         }
         
         // Timeout de seguridad
         setTimeout(() => {
             reject(new Error('Timeout: La instalación tardó demasiado'));
         }, 60000); // 1 minuto
     });
 }
 
 function createBasicEnv() {
     const basicEnv = `# Configuración básica para servicio de Windows
 NODE_ENV=production
 PORT=3001
 HOST=0.0.0.0
 
 # Base de datos (CONFIGURA ESTOS VALORES)
 DB_HOST=srv1313.hstgr.io
 DB_USER=u377556581_vWMEZ
 DB_PASSWORD=NJdPaC3A$j7DCzE&yU^P
 DB_NAME=u377556581_OXkxK
 DB_PREFIX=btw70
 
 # ERP (CONFIGURA ESTOS VALORES)
 ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/
 ERP_API_KEY=
 
 # Configuración de sincronización
 SYNC_INTERVAL_MINUTES=10
 AUTO_SYNC_ENABLED=true
 LOG_LEVEL=INFO
 
 # Timezone
 TZ=America/Asuncion
 `;
     
     fs.writeFileSync(path.join(__dirname, '.env'), basicEnv);
     console.log('✅ Archivo .env básico creado');
     console.log('⚠️  IMPORTANTE: Configura las variables de base de datos y ERP');
 }
 
 // Función para mostrar el estado actual de servicios
 function showCurrentServices() {
     console.log('\n🔍 Servicios de Windows relacionados encontrados:\n');
     
     const serviceNames = [
         'Sincronizador ERP WooCommerce',
         'PM2'
     ];
     
     serviceNames.forEach(serviceName => {
         try {
             const output = execSync(`sc query "${serviceName}"`, { 
                 encoding: 'utf8', 
                 stdio: 'pipe' 
             });
             
             console.log(`✅ ${serviceName}:`);
             const state = output.includes('RUNNING') ? 'EJECUTÁNDOSE' : 
                          output.includes('STOPPED') ? 'DETENIDO' : 'DESCONOCIDO';
             console.log(`   Estado: ${state}`);
             
         } catch (e) {
             console.log(`❌ ${serviceName}: No instalado`);
         }
     });
 }
 
 // Verificar servicios existentes antes de instalar
 console.log('🔍 Verificando servicios existentes...');
 showCurrentServices();
 
 // Preguntar si continuar
 const readline = require('readline');
 const rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout
 });
 
 rl.question('\n¿Continuar con la instalación del servicio nativo? (s/n): ', (answer) => {
     rl.close();
     
     if (answer.toLowerCase() === 's') {
         main();
     } else {
         console.log('Instalación cancelada.');
         process.exit(0);
     }
 });
 
 module.exports = { main, checkAdminRights, createWindowsService };