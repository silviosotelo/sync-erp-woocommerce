#!/usr/bin/env node

/**
 * install-pm2-service.js
 * Instalación de PM2 como servicio de Windows
 * Este método ES MÁS CONFIABLE y también aparece en services.msc
 */

 const { execSync } = require('child_process');
 const fs = require('fs');
 const path = require('path');
 
 console.log('🚀 INSTALADOR PM2 COMO SERVICIO DE WINDOWS\n');
 console.log('✅ Este método SÍ aparecerá en services.msc como "PM2"\n');
 
 // Verificar sistema operativo
 if (process.platform !== 'win32') {
     console.error('❌ Este script es solo para Windows');
     process.exit(1);
 }
 
 async function main() {
     try {
         console.log('📋 Iniciando instalación de PM2 como servicio...\n');
         
         // Paso 1: Verificar/instalar PM2
         await ensurePM2();
         
         // Paso 2: Crear configuración
         await createEcosystemConfig();
         
         // Paso 3: Configurar aplicación en PM2
         await setupPM2App();
         
         // Paso 4: Instalar PM2 como servicio de Windows
         await installPM2Service();
         
         // Paso 5: Verificar instalación
         await verifyInstallation();
         
         showSuccessInfo();
         
     } catch (error) {
         console.error('\n❌ Error durante la instalación:', error.message);
         showTroubleshootingInfo();
         process.exit(1);
     }
 }
 
 async function ensurePM2() {
     console.log('🔍 Verificando PM2...\n');
     
     try {
         const version = execSync('pm2 --version', { encoding: 'utf8', stdio: 'pipe' });
         console.log(`✅ PM2 ya está instalado: v${version.trim()}`);
     } catch (e) {
         console.log('📦 PM2 no encontrado, instalando globalmente...');
         
         try {
             execSync('npm install -g pm2', { stdio: 'inherit' });
             console.log('✅ PM2 instalado exitosamente');
         } catch (installError) {
             throw new Error(`Error instalando PM2: ${installError.message}`);
         }
     }
     
     // Verificar pm2-windows-service
     try {
         execSync('pm2-service-install --help', { stdio: 'ignore' });
         console.log('✅ pm2-windows-service ya está disponible');
     } catch (e) {
         console.log('📦 Instalando pm2-windows-service...');
         
         try {
             execSync('npm install -g pm2-windows-service', { stdio: 'inherit' });
             console.log('✅ pm2-windows-service instalado');
         } catch (installError) {
             throw new Error(`Error instalando pm2-windows-service: ${installError.message}`);
         }
     }
 }
 
 async function createEcosystemConfig() {
     console.log('\n⚙️  Creando configuración de PM2...\n');
     
     const config = {
         apps: [{
             name: 'sync-erp-woocommerce',
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
     const configContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
     
     fs.writeFileSync(configPath, configContent);
     console.log('✅ ecosystem.config.js creado');
     
     // Verificar que app.js existe
     if (!fs.existsSync('./app.js')) {
         throw new Error('app.js no encontrado en el directorio actual');
     }
     
     // Crear directorio de logs si no existe
     if (!fs.existsSync('./logs')) {
         fs.mkdirSync('./logs', { recursive: true });
         console.log('✅ Directorio logs/ creado');
     }
 }
 
 async function setupPM2App() {
     console.log('\n🚀 Configurando aplicación en PM2...\n');
     
     try {
         // Detener instancias previas si existen
         try {
             execSync('pm2 delete sync-erp-woocommerce', { stdio: 'pipe' });
             console.log('🛑 Instancia previa detenida');
         } catch (e) {
             // No hay problema si no existía
         }
         
         // Iniciar con PM2
         console.log('🚀 Iniciando aplicación...');
         execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
         
         // Guardar configuración
         console.log('💾 Guardando configuración...');
         execSync('pm2 save', { stdio: 'inherit' });
         
         // Verificar que esté ejecutándose
         const list = execSync('pm2 list', { encoding: 'utf8' });
         if (list.includes('sync-erp-woocommerce') && list.includes('online')) {
             console.log('✅ Aplicación ejecutándose correctamente en PM2');
         } else {
             throw new Error('La aplicación no se inició correctamente en PM2');
         }
         
     } catch (error) {
         throw new Error(`Error configurando PM2: ${error.message}`);
     }
 }
 
 async function installPM2Service() {
     console.log('\n🔧 Instalando PM2 como servicio de Windows...\n');
     
     try {
         // Verificar si ya está instalado
         try {
             const serviceStatus = execSync('sc query PM2', { encoding: 'utf8', stdio: 'pipe' });
             if (serviceStatus.includes('STATE')) {
                 console.log('⚠️  Servicio PM2 ya existe, reinstalando...');
                 
                 try {
                     execSync('pm2-service-uninstall', { stdio: 'inherit' });
                     console.log('🗑️  Servicio anterior desinstalado');
                 } catch (e) {
                     console.log('⚠️  No se pudo desinstalar el servicio anterior');
                 }
             }
         } catch (e) {
             // El servicio no existe, perfecto
         }
         
         // Instalar servicio
         console.log('📦 Instalando PM2 como servicio de Windows...');
         execSync('pm2-service-install', { stdio: 'inherit' });
         
         // Iniciar servicio
         console.log('🚀 Iniciando servicio PM2...');
         execSync('pm2-service-start', { stdio: 'inherit' });
         
         console.log('✅ PM2 instalado como servicio de Windows');
         
     } catch (error) {
         throw new Error(`Error instalando servicio PM2: ${error.message}`);
     }
 }
 
 async function verifyInstallation() {
     console.log('\n🔍 Verificando instalación...\n');
     
     try {
         // Verificar servicio de Windows
         const serviceStatus = execSync('sc query PM2', { encoding: 'utf8' });
         if (serviceStatus.includes('RUNNING')) {
             console.log('✅ Servicio PM2 está EJECUTÁNDOSE en Windows');
         } else if (serviceStatus.includes('STOPPED')) {
             console.log('⚠️  Servicio PM2 está DETENIDO, iniciando...');
             execSync('sc start PM2', { stdio: 'inherit' });
         }
         
         // Verificar aplicación en PM2
         const pm2Status = execSync('pm2 list', { encoding: 'utf8' });
         if (pm2Status.includes('sync-erp-woocommerce') && pm2Status.includes('online')) {
             console.log('✅ Aplicación sync-erp-woocommerce está ONLINE en PM2');
         } else {
             throw new Error('La aplicación no está ejecutándose en PM2');
         }
         
         // Verificar que responda
         console.log('🌐 Verificando conectividad...');
         setTimeout(async () => {
             try {
                 const axios = require('axios');
                 const response = await axios.get('http://localhost:3001/health', { timeout: 5000 });
                 if (response.status === 200) {
                     console.log('✅ Dashboard respondiendo correctamente');
                 }
             } catch (e) {
                 console.log('⚠️  Dashboard aún no responde (puede tomar unos segundos)');
             }
         }, 5000);
         
     } catch (error) {
         throw new Error(`Error verificando instalación: ${error.message}`);
     }
 }
 
 function showSuccessInfo() {
     console.log('\n🎉 ¡INSTALACIÓN EXITOSA!\n');
     
     console.log('📋 Información del servicio:');
     console.log('   • Nombre del servicio: PM2');
     console.log('   • Aplicación: sync-erp-woocommerce');
     console.log('   • Estado: EJECUTÁNDOSE');
     console.log('   • Inicio automático: SÍ');
     console.log('');
     
     console.log('🔧 Gestión del servicio:');
     console.log('   • Abrir "Servicios" (services.msc)');
     console.log('   • Buscar "PM2" en la lista');
     console.log('   • Click derecho para gestionar el servicio');
     console.log('');
     
     console.log('⚙️  Gestión de la aplicación:');
     console.log('   • pm2 status                    - Ver estado');
     console.log('   • pm2 logs sync-erp-woocommerce - Ver logs');
     console.log('   • pm2 restart sync-erp-woocommerce - Reiniciar');
     console.log('   • pm2 stop sync-erp-woocommerce - Detener');
     console.log('   • pm2 start sync-erp-woocommerce - Iniciar');
     console.log('   • pm2 monit                     - Monitor');
     console.log('');
     
     console.log('🌐 Acceso:');
     console.log('   • Dashboard: http://localhost:3001');
     console.log('   • Health check: http://localhost:3001/health');
     console.log('   • API status: http://localhost:3001/api/system/status');
     console.log('');
     
     console.log('🗑️  Para desinstalar:');
     console.log('   • pm2-service-stop');
     console.log('   • pm2-service-uninstall');
     console.log('   • pm2 delete sync-erp-woocommerce');
     console.log('');
     
     console.log('🔄 El servicio se iniciará automáticamente con Windows');
     console.log('📊 Verifica el dashboard en unos segundos');
 }
 
 function showTroubleshootingInfo() {
     console.log('\n🛠️  SOLUCIÓN DE PROBLEMAS:\n');
     
     console.log('❌ Si la instalación falló:');
     console.log('   1. Ejecutar como Administrador');
     console.log('   2. Verificar que Node.js esté en PATH');
     console.log('   3. npm install -g pm2 pm2-windows-service');
     console.log('');
     
     console.log('🔧 Instalación manual alternativa:');
     console.log('   1. npm install -g pm2');
     console.log('   2. pm2 start ecosystem.config.js');
     console.log('   3. pm2 save');
     console.log('   4. pm2-service-install');
     console.log('   5. pm2-service-start');
     console.log('');
     
     console.log('📞 Si necesitas ayuda:');
     console.log('   • Ejecutar: npm run troubleshoot');
     console.log('   • Ver logs: pm2 logs');
     console.log('   • Estado: pm2 status');
 }
 
 // Verificar prerrequisitos básicos
 function checkPrerequisites() {
     console.log('🔍 Verificando prerrequisitos...\n');
     
     // Verificar Node.js
     console.log(`✅ Node.js: ${process.version}`);
     
     // Verificar archivos
     if (!fs.existsSync('app.js')) {
         throw new Error('app.js no encontrado');
     }
     console.log('✅ app.js encontrado');
     
     if (!fs.existsSync('package.json')) {
         throw new Error('package.json no encontrado');
     }
     console.log('✅ package.json encontrado');
     
     // Verificar .env
     if (!fs.existsSync('.env')) {
         console.log('⚠️  .env no encontrado, se requerirá configuración');
     } else {
         console.log('✅ .env encontrado');
     }
     
     console.log('');
 }
 
 // Ejecutar instalación
 if (require.main === module) {
     checkPrerequisites();
     
     const readline = require('readline');
     const rl = readline.createInterface({
         input: process.stdin,
         output: process.stdout
     });
     
     rl.question('¿Continuar con la instalación de PM2 como servicio? (s/n): ', (answer) => {
         rl.close();
         
         if (answer.toLowerCase() === 's') {
             main();
         } else {
             console.log('Instalación cancelada.');
             process.exit(0);
         }
     });
 }
 
 module.exports = { main, ensurePM2, installPM2Service };