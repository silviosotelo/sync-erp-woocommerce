<<<<<<< HEAD
#!/usr/bin/env node

/**
 * install-service.js - VERSIÓN CORREGIDA
 * Script para instalar el Sincronizador ERP como servicio de Windows
 * Incluye verificaciones exhaustivas y múltiples métodos de instalación
 */

 const path = require('path');
 const fs = require('fs');
 const os = require('os');
 
 console.log('🔧 INSTALADOR DE SERVICIO WINDOWS - Sincronizador ERP (v2.0)\n');
 
 // Verificar sistema operativo
 if (process.platform !== 'win32') {
     console.error('❌ Este script es solo para Windows');
     process.exit(1);
 }
 
 // Verificar permisos de administrador
 if (!checkAdminRights()) {
     console.log('⚠️  ADVERTENCIA: Se requieren permisos de administrador');
     console.log('💡 Ejecuta cmd como Administrador y vuelve a intentar\n');
 }
 
 // Variables globales
 const APP_NAME = 'sync-erp-woocommerce';
 const SERVICE_NAME = 'Sincronizador ERP WooCommerce';
 const APP_PATH = path.join(__dirname, 'app.js');
 const NODE_PATH = process.execPath;
 
 async function main() {
     try {
         console.log('📋 VERIFICANDO PRERREQUISITOS...\n');
         await checkPrerequisites();
         
         console.log('\n🔍 DETECTANDO MÉTODOS DE INSTALACIÓN...\n');
         const methods = await detectInstallationMethods();
         
         if (methods.length === 0) {
             console.log('❌ No hay métodos de instalación disponibles');
             console.log('📦 Instalando dependencias necesarias...\n');
             await installDependencies();
             return main(); // Reintentar después de instalar dependencias
         }
         
         await promptInstallMethod(methods);
         
     } catch (error) {
         console.error('\n❌ Error durante la instalación:', error.message);
         console.log('\n🛠️ Intenta los siguientes pasos:');
         console.log('   1. Ejecutar como Administrador');
         console.log('   2. Verificar que Node.js esté instalado');
         console.log('   3. Instalar manualmente: npm install -g pm2');
         process.exit(1);
     }
 }
 
 function checkAdminRights() {
     try {
         const { execSync } = require('child_process');
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
     if (!fs.existsSync(APP_PATH)) {
         throw new Error(`No se encontró app.js en: ${APP_PATH}`);
     }
     console.log('✅ app.js encontrado');
     
     // Verificar .env
     const envPath = path.join(__dirname, '.env');
     if (!fs.existsSync(envPath)) {
         console.log('⚠️  No se encontró archivo .env');
         console.log('💡 Creando .env básico...');
         await createBasicEnv();
     } else {
         console.log('✅ .env encontrado');
     }
     
     // Verificar package.json
     if (!fs.existsSync(path.join(__dirname, 'package.json'))) {
         throw new Error('No se encontró package.json');
     }
     console.log('✅ package.json encontrado');
     
     // Verificar node_modules
     if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
         console.log('⚠️  No se encontró node_modules');
         console.log('📦 Instalando dependencias...');
         const { execSync } = require('child_process');
         execSync('npm install', { stdio: 'inherit', cwd: __dirname });
     } else {
         console.log('✅ node_modules encontrado');
     }
     
     // Crear directorios necesarios
     const dirs = ['logs', 'backups', 'tmp'];
     dirs.forEach(dir => {
         const dirPath = path.join(__dirname, dir);
         if (!fs.existsSync(dirPath)) {
             fs.mkdirSync(dirPath, { recursive: true });
             console.log(`✅ Directorio ${dir}/ creado`);
         }
     });
 }
 
 async function createBasicEnv() {
     const basicEnv = `# Configuración básica generada automáticamente
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
     console.log('⚠️  RECUERDA: Configura las variables de base de datos y ERP en .env');
 }
 
 async function detectInstallationMethods() {
     const methods = [];
     
     // Verificar PM2
     if (await checkPM2()) {
         methods.push({
             id: 'pm2',
             name: 'PM2 Process Manager (Recomendado)',
             description: 'Fácil de gestionar, incluye monitoreo'
         });
     }
     
     // Verificar node-windows
     if (await checkNodeWindows()) {
         methods.push({
             id: 'nodewindows',
             name: 'Servicio nativo de Windows',
             description: 'Integración completa con Windows Services'
         });
     }
     
     // Verificar WinSW
     if (await checkWinSW()) {
         methods.push({
             id: 'winsw',
             name: 'Windows Service Wrapper',
             description: 'Método alternativo robusto'
         });
     }
     
     // Método manual siempre disponible
     methods.push({
         id: 'manual',
         name: 'Configuración manual',
         description: 'Instrucciones para configurar manualmente'
     });
     
     methods.forEach((method, index) => {
         console.log(`   ${index + 1}. ${method.name}`);
         console.log(`      ${method.description}`);
     });
     
     return methods;
 }
 
 async function checkPM2() {
     try {
         const { execSync } = require('child_process');
         execSync('pm2 --version', { stdio: 'ignore' });
         return true;
     } catch (e) {
         return false;
     }
 }
 
 async function checkNodeWindows() {
     try {
         require.resolve('node-windows');
         return true;
     } catch (e) {
         return false;
     }
 }
 
 async function checkWinSW() {
     // WinSW es un ejecutable independiente, verificar si está disponible
     return fs.existsSync(path.join(__dirname, 'winsw.exe'));
 }
 
 async function installDependencies() {
     const { execSync } = require('child_process');
     
     console.log('📦 Instalando dependencias necesarias...\n');
     
     try {
         console.log('1. Instalando PM2...');
         execSync('npm install -g pm2', { stdio: 'inherit' });
         console.log('✅ PM2 instalado');
         
         console.log('\n2. Configurando PM2 para Windows...');
         execSync('npm install -g pm2-windows-startup', { stdio: 'inherit' });
         console.log('✅ PM2 Windows Startup instalado');
         
         console.log('\n3. Instalando node-windows...');
         execSync('npm install -g node-windows', { stdio: 'inherit' });
         console.log('✅ node-windows instalado');
         
         console.log('\n✅ Todas las dependencias instaladas correctamente');
         
     } catch (error) {
         console.error('❌ Error instalando dependencias:', error.message);
         console.log('\n🔧 Instalación manual:');
         console.log('   Abre PowerShell como Administrador y ejecuta:');
         console.log('   npm install -g pm2 pm2-windows-startup node-windows');
         throw error;
     }
 }
 
 async function promptInstallMethod(methods) {
     const readline = require('readline');
     const rl = readline.createInterface({
         input: process.stdin,
         output: process.stdout
     });
     
     return new Promise((resolve) => {
         console.log('\n🚀 Selecciona el método de instalación:');
         methods.forEach((method, index) => {
             console.log(`   ${index + 1}. ${method.name}`);
         });
         console.log(`   ${methods.length + 1}. Cancelar\n`);
         
         rl.question('Selecciona una opción: ', async (answer) => {
             rl.close();
             
             const selection = parseInt(answer.trim()) - 1;
             
             if (selection < 0 || selection > methods.length) {
                 console.log('❌ Opción inválida');
                 process.exit(1);
             }
             
             if (selection === methods.length) {
                 console.log('Instalación cancelada.');
                 process.exit(0);
             }
             
             const selectedMethod = methods[selection];
             
             try {
                 switch (selectedMethod.id) {
                     case 'pm2':
                         await installWithPM2();
                         break;
                     case 'nodewindows':
                         await installWithNodeWindows();
                         break;
                     case 'winsw':
                         await installWithWinSW();
                         break;
                     case 'manual':
                         showManualInstructions();
                         break;
                 }
             } catch (error) {
                 console.error(`❌ Error en instalación ${selectedMethod.id}:`, error.message);
                 process.exit(1);
             }
             
             resolve();
         });
     });
 }
 
 async function installWithPM2() {
     console.log('\n🚀 INSTALANDO CON PM2...\n');
     
     const { execSync } = require('child_process');
     
     try {
         // Crear archivo ecosystem.config.js mejorado
         createEcosystemConfig();
         
         console.log('🛑 Deteniendo instancias previas...');
         try {
             execSync(`pm2 delete ${APP_NAME}`, { stdio: 'ignore' });
         } catch (e) {
             // Ignorar si no existe
         }
         
         console.log('🚀 Iniciando con PM2...');
         execSync('pm2 start ecosystem.config.js', { stdio: 'inherit', cwd: __dirname });
         
         console.log('💾 Guardando configuración PM2...');
         execSync('pm2 save', { stdio: 'inherit' });
         
         console.log('🔧 Configurando inicio automático...');
         try {
             execSync('pm2-startup install', { stdio: 'inherit' });
         } catch (e) {
             console.log('⚠️  Error configurando startup automático, continuando...');
         }
         
         // Verificar que el servicio esté ejecutándose
         console.log('\n🔍 Verificando instalación...');
         const status = execSync('pm2 list', { encoding: 'utf8' });
         if (status.includes(APP_NAME)) {
             console.log('✅ Servicio verificado en PM2');
         }
         
         console.log('\n✅ SERVICIO INSTALADO EXITOSAMENTE CON PM2');
         showPM2Commands();
         
         // Mostrar estado actual
         setTimeout(() => {
             console.log('\n📊 Estado actual del servicio:');
             try {
                 execSync('pm2 status', { stdio: 'inherit' });
             } catch (e) {
                 console.log('❌ Error mostrando estado');
             }
         }, 2000);
         
     } catch (error) {
         console.error('❌ Error instalando con PM2:', error.message);
         throw error;
     }
 }
 
 async function installWithNodeWindows() {
     console.log('\n🚀 INSTALANDO CON NODE-WINDOWS...\n');
     
     try {
         const Service = require('node-windows').Service;
         
         // Crear el servicio con configuración mejorada
         const svc = new Service({
             name: SERVICE_NAME,
             description: 'Servicio de sincronización bidireccional entre ERP y WooCommerce',
             script: APP_PATH,
             nodeOptions: [
                 '--max_old_space_size=1024'
             ],
             env: [
                 {
                     name: "NODE_ENV",
                     value: process.env.NODE_ENV || "production"
                 },
                 {
                     name: "PORT",
                     value: process.env.PORT || "3001"
                 },
                 {
                     name: "PATH",
                     value: process.env.PATH
                 }
             ],
             workingDirectory: __dirname,
             allowServiceLogon: true,
             maxRestarts: 10,
             maxRestartSeconds: 60
         });
         
         return new Promise((resolve, reject) => {
             // Escuchar eventos
             svc.on('install', function() {
                 console.log('✅ Servicio instalado exitosamente');
                 console.log('🚀 Iniciando servicio...');
                 svc.start();
             });
             
             svc.on('start', function() {
                 console.log('\n✅ SERVICIO INICIADO EXITOSAMENTE');
                 showServiceInfo(svc);
                 resolve();
             });
             
             svc.on('error', function(err) {
                 console.error('❌ Error del servicio:', err);
                 reject(err);
             });
             
             // Verificar si ya existe
             if (svc.exists) {
                 console.log('⚠️  El servicio ya existe. Desinstalando primero...');
                 svc.uninstall();
                 
                 setTimeout(() => {
                     console.log('🔧 Reinstalando servicio...');
                     svc.install();
                 }, 3000);
             } else {
                 console.log('📦 Instalando servicio...');
                 svc.install();
             }
         });
         
     } catch (error) {
         console.error('❌ Error instalando con node-windows:', error.message);
         console.log('\n💡 Posibles soluciones:');
         console.log('   1. Ejecutar como Administrador');
         console.log('   2. Instalar: npm install -g node-windows');
         console.log('   3. Verificar permisos de Windows');
         throw error;
     }
 }
 
 async function installWithWinSW() {
     console.log('\n🚀 INSTALANDO CON WINSW...\n');
     
     // Descargar WinSW si no existe
     if (!fs.existsSync(path.join(__dirname, 'winsw.exe'))) {
         console.log('📦 Descargando WinSW...');
         await downloadWinSW();
     }
     
     // Crear archivo de configuración XML
     createWinSWConfig();
     
     try {
         const { execSync } = require('child_process');
         
         console.log('📦 Instalando servicio con WinSW...');
         execSync('winsw.exe install', { stdio: 'inherit', cwd: __dirname });
         
         console.log('🚀 Iniciando servicio...');
         execSync('winsw.exe start', { stdio: 'inherit', cwd: __dirname });
         
         console.log('\n✅ SERVICIO INSTALADO CON WINSW');
         showWinSWCommands();
         
     } catch (error) {
         console.error('❌ Error instalando con WinSW:', error.message);
         throw error;
     }
 }
 
 function createEcosystemConfig() {
     const config = {
         apps: [{
             name: APP_NAME,
             script: './app.js',
             cwd: __dirname,
             instances: 1,
             exec_mode: 'fork',
             watch: false,
             max_memory_restart: '1G',
             restart_delay: 5000,
             max_restarts: 10,
             min_uptime: '10s',
             env: {
                 NODE_ENV: 'production',
                 PORT: process.env.PORT || 3001
             },
             error_file: './logs/pm2-error.log',
             out_file: './logs/pm2-out.log',
             log_file: './logs/pm2-combined.log',
             time: true,
             log_date_format: 'YYYY-MM-DD HH:mm:ss',
             merge_logs: true,
             autorestart: true,
             kill_timeout: 5000
         }]
     };
     
     const configPath = path.join(__dirname, 'ecosystem.config.js');
     fs.writeFileSync(configPath, 
         `module.exports = ${JSON.stringify(config, null, 2)};`
     );
     
     console.log('✅ Archivo ecosystem.config.js creado');
 }
 
 function createWinSWConfig() {
     const xmlConfig = `<?xml version="1.0" encoding="UTF-8"?>
 <service>
     <id>${APP_NAME}</id>
     <name>${SERVICE_NAME}</name>
     <description>Servicio de sincronización bidireccional entre ERP y WooCommerce</description>
     <executable>${NODE_PATH}</executable>
     <arguments>${APP_PATH}</arguments>
     <workingdirectory>${__dirname}</workingdirectory>
     <logmode>roll</logmode>
     <onfailure action="restart" delay="10 sec"/>
     <onfailure action="restart" delay="20 sec"/>
     <onfailure action="none"/>
     <resetfailure>1 hour</resetfailure>
     <env name="NODE_ENV" value="production"/>
     <env name="PORT" value="3001"/>
 </service>`;
     
     fs.writeFileSync(path.join(__dirname, 'winsw.xml'), xmlConfig);
     console.log('✅ Configuración WinSW creada');
 }
 
 async function downloadWinSW() {
     // Implementar descarga de WinSW desde GitHub
     console.log('⚠️  WinSW no disponible. Descarga manual requerida.');
     console.log('📥 Descarga desde: https://github.com/winsw/winsw/releases');
 }
 
 function showPM2Commands() {
     console.log('\n📋 Comandos útiles para PM2:');
     console.log(`   pm2 status                     - Ver estado de todos los servicios`);
     console.log(`   pm2 logs ${APP_NAME}           - Ver logs en tiempo real`);
     console.log(`   pm2 restart ${APP_NAME}        - Reiniciar servicio`);
     console.log(`   pm2 stop ${APP_NAME}           - Detener servicio`);
     console.log(`   pm2 start ${APP_NAME}          - Iniciar servicio`);
     console.log(`   pm2 monit                      - Monitor en tiempo real`);
     console.log(`   pm2 delete ${APP_NAME}         - Eliminar servicio`);
     console.log('\n🌐 Dashboard web: http://localhost:3001');
 }
 
 function showServiceInfo(svc) {
     console.log('\n📋 Información del servicio:');
     console.log(`   Nombre: ${svc.name}`);
     console.log(`   Script: ${svc.script}`);
     console.log(`   Directorio: ${svc.root}`);
     console.log('\n🔧 Gestión del servicio:');
     console.log('   - Usar "Servicios" de Windows (services.msc)');
     console.log('   - O ejecutar: node uninstall-service.js');
     console.log('\n🌐 Dashboard web: http://localhost:3001');
 }
 
 function showWinSWCommands() {
     console.log('\n📋 Comandos útiles para WinSW:');
     console.log('   winsw.exe status    - Ver estado del servicio');
     console.log('   winsw.exe start     - Iniciar servicio');
     console.log('   winsw.exe stop      - Detener servicio');
     console.log('   winsw.exe restart   - Reiniciar servicio');
     console.log('   winsw.exe uninstall - Desinstalar servicio');
     console.log('\n🌐 Dashboard web: http://localhost:3001');
 }
 
 function showManualInstructions() {
     console.log('\n📋 INSTRUCCIONES DE CONFIGURACIÓN MANUAL\n');
     
     console.log('🔧 Opción 1: Usar Task Scheduler (Programador de tareas)');
     console.log('   1. Abrir "Programador de tareas" (taskschd.msc)');
     console.log('   2. Crear tarea básica');
     console.log('   3. Nombre: "Sincronizador ERP"');
     console.log('   4. Desencadenador: "Al iniciar el equipo"');
     console.log(`   5. Acción: Iniciar programa`);
     console.log(`      Programa: ${NODE_PATH}`);
     console.log(`      Argumentos: "${APP_PATH}"`);
     console.log(`      Directorio: ${__dirname}`);
     
     console.log('\n🔧 Opción 2: Crear archivo BAT de inicio');
     console.log('   1. Crear archivo start-sync.bat:');
     console.log(`      cd "${__dirname}"`);
     console.log(`      "${NODE_PATH}" "${APP_PATH}"`);
     console.log('   2. Agregar al inicio de Windows');
     
     console.log('\n🔧 Opción 3: Usar NSSM (Non-Sucking Service Manager)');
     console.log('   1. Descargar NSSM desde nssm.cc');
     console.log('   2. nssm install "Sincronizador ERP"');
     console.log(`   3. Configurar path: ${NODE_PATH}`);
     console.log(`   4. Configurar argumentos: "${APP_PATH}"`);
     
     console.log('\n🌐 Una vez configurado, el dashboard estará en: http://localhost:3001');
 }
 
 // Ejecutar script principal
 main().catch(error => {
     console.error('\n💥 Error crítico:', error.message);
     process.exit(1);
 });
=======
/**
 * install-service.js
 * Script para instalar el Sincronizador ERP como servicio de Windows
 */

const path = require('path');
const fs = require('fs');

console.log('🔧 INSTALADOR DE SERVICIO WINDOWS - Sincronizador ERP\n');

// Verificar sistema operativo
if (process.platform !== 'win32') {
    console.error('❌ Este script es solo para Windows');
    process.exit(1);
}

// Detectar método de instalación disponible
const hasNodeWindows = checkNodeWindows();
const hasPM2 = checkPM2();

console.log('📋 Métodos de instalación disponibles:');
console.log(`   node-windows: ${hasNodeWindows ? '✅ Disponible' : '❌ No instalado'}`);
console.log(`   PM2: ${hasPM2 ? '✅ Disponible' : '❌ No instalado'}`);
console.log('');

if (!hasNodeWindows && !hasPM2) {
    console.log('⚠️  No hay métodos de instalación disponibles.');
    console.log('📦 Instalando dependencias necesarias...\n');
    
    installDependencies();
} else {
    promptInstallMethod();
}

function checkNodeWindows() {
    try {
        require.resolve('node-windows');
        return true;
    } catch (e) {
        return false;
    }
}

function checkPM2() {
    try {
        const { execSync } = require('child_process');
        execSync('pm2 --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

function installDependencies() {
    const { execSync } = require('child_process');
    
    try {
        console.log('📦 Instalando node-windows...');
        execSync('npm install -g node-windows', { stdio: 'inherit' });
        
        console.log('📦 Instalando PM2...');
        execSync('npm install -g pm2', { stdio: 'inherit' });
        execSync('npm install -g pm2-windows-startup', { stdio: 'inherit' });
        
        console.log('\n✅ Dependencias instaladas correctamente\n');
        promptInstallMethod();
        
    } catch (error) {
        console.error('❌ Error instalando dependencias:', error.message);
        console.log('\n🔧 Instalación manual:');
        console.log('   npm install -g node-windows');
        console.log('   npm install -g pm2');
        console.log('   npm install -g pm2-windows-startup');
        process.exit(1);
    }
}

function promptInstallMethod() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('🚀 Selecciona el método de instalación:');
    console.log('   1. PM2 (Recomendado - Más fácil de gestionar)');
    console.log('   2. node-windows (Servicio nativo de Windows)');
    console.log('   3. Cancelar\n');
    
    rl.question('Selecciona una opción (1-3): ', (answer) => {
        rl.close();
        
        switch (answer.trim()) {
            case '1':
                installWithPM2();
                break;
            case '2':
                installWithNodeWindows();
                break;
            case '3':
                console.log('Instalación cancelada.');
                break;
            default:
                console.log('❌ Opción inválida');
                process.exit(1);
        }
    });
}

function installWithPM2() {
    console.log('\n🚀 INSTALANDO CON PM2...\n');
    
    const { execSync } = require('child_process');
    
    try {
        // Crear archivo ecosystem.config.js
        createEcosystemConfig();
        
        console.log('📝 Configurando PM2...');
        
        // Detener instancias previas
        try {
            execSync('pm2 delete sync-erp-woocommerce', { stdio: 'ignore' });
        } catch (e) {
            // Ignorar si no existe
        }
        
        // Iniciar con PM2
        execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
        
        // Guardar configuración
        execSync('pm2 save', { stdio: 'inherit' });
        
        // Configurar startup automático
        console.log('\n🔧 Configurando inicio automático...');
        execSync('pm2-startup install', { stdio: 'inherit' });
        
        console.log('\n✅ SERVICIO INSTALADO EXITOSAMENTE CON PM2');
        console.log('\n📋 Comandos útiles:');
        console.log('   pm2 status                    - Ver estado del servicio');
        console.log('   pm2 logs sync-erp-woocommerce - Ver logs en tiempo real');
        console.log('   pm2 restart sync-erp-woocommerce - Reiniciar servicio');
        console.log('   pm2 stop sync-erp-woocommerce - Detener servicio');
        console.log('   pm2 monit                     - Monitor en tiempo real');
        
        // Mostrar estado actual
        setTimeout(() => {
            console.log('\n📊 Estado actual del servicio:');
            try {
                execSync('pm2 status', { stdio: 'inherit' });
            } catch (e) {
                console.log('Error mostrando estado');
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error instalando con PM2:', error.message);
        process.exit(1);
    }
}

function installWithNodeWindows() {
    console.log('\n🚀 INSTALANDO CON NODE-WINDOWS...\n');
    
    try {
        const Service = require('node-windows').Service;
        
        // Crear el servicio
        const svc = new Service({
            name: 'Sincronizador ERP WooCommerce',
            description: 'Servicio de sincronización bidireccional entre ERP y WooCommerce',
            script: path.join(__dirname, 'app.js'),
            nodeOptions: [
                '--max_old_space_size=1024'
            ],
            env: [
                {
                    name: "NODE_ENV",
                    value: process.env.NODE_ENV || "production"
                },
                {
                    name: "PORT",
                    value: process.env.PORT || "3001"
                }
            ],
            workingDirectory: __dirname,
            allowServiceLogon: true
        });
        
        // Escuchar evento de instalación
        svc.on('install', function() {
            console.log('✅ Servicio instalado exitosamente');
            console.log('🚀 Iniciando servicio...');
            svc.start();
        });
        
        svc.on('start', function() {
            console.log('\n✅ SERVICIO INICIADO EXITOSAMENTE');
            console.log('\n📋 Información del servicio:');
            console.log(`   Nombre: ${svc.name}`);
            console.log(`   Script: ${svc.script}`);
            console.log(`   Directorio: ${svc.root}`);
            console.log('\n🔧 Gestión del servicio:');
            console.log('   - Usar "Servicios" de Windows (services.msc)');
            console.log('   - O ejecutar: node uninstall-service.js');
        });
        
        svc.on('error', function(err) {
            console.error('❌ Error del servicio:', err);
        });
        
        // Verificar si ya existe
        if (svc.exists) {
            console.log('⚠️  El servicio ya existe. Desinstalando primero...');
            svc.uninstall();
            
            setTimeout(() => {
                console.log('🔧 Reinstalando servicio...');
                svc.install();
            }, 3000);
        } else {
            console.log('📦 Instalando servicio...');
            svc.install();
        }
        
    } catch (error) {
        console.error('❌ Error instalando con node-windows:', error.message);
        console.log('\n💡 Intenta ejecutar como Administrador');
        process.exit(1);
    }
}

function createEcosystemConfig() {
    const config = {
        apps: [{
            name: 'sync-erp-woocommerce',
            script: './app.js',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '1G',
            restart_delay: 5000,
            max_restarts: 10,
            min_uptime: '10s',
            env: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 3001
            },
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_file: './logs/pm2-combined.log',
            time: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
            autorestart: true
        }]
    };
    
    fs.writeFileSync('ecosystem.config.js', 
        `module.exports = ${JSON.stringify(config, null, 2)};`
    );
    
    console.log('✅ Archivo ecosystem.config.js creado');
}

// Verificar prerrequisitos
function checkPrerequisites() {
    console.log('🔍 Verificando prerrequisitos...\n');
    
    // Verificar Node.js
    console.log(`✅ Node.js: ${process.version}`);
    
    // Verificar archivo principal
    if (!fs.existsSync(path.join(__dirname, 'app.js'))) {
        console.error('❌ No se encontró app.js en el directorio actual');
        process.exit(1);
    }
    console.log('✅ app.js encontrado');
    
    // Verificar .env
    if (!fs.existsSync(path.join(__dirname, '.env'))) {
        console.log('⚠️  No se encontró archivo .env');
        console.log('💡 Ejecuta: npm run setup');
    } else {
        console.log('✅ .env encontrado');
    }
    
    // Verificar package.json
    if (!fs.existsSync(path.join(__dirname, 'package.json'))) {
        console.error('❌ No se encontró package.json');
        process.exit(1);
    }
    console.log('✅ package.json encontrado');
    
    // Verificar node_modules
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
        console.log('⚠️  No se encontró node_modules');
        console.log('💡 Ejecuta: npm install');
    } else {
        console.log('✅ node_modules encontrado');
    }
    
    console.log('');
}

// Ejecutar verificación de prerrequisitos
checkPrerequisites();
>>>>>>> 8fbdc97d5e0f33d77da0227dca41ff6e07744a4a
