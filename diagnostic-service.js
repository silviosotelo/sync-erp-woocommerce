#!/usr/bin/env node

/**
 * diagnostic-service.js
 * Diagnóstico específico para servicios de Windows
 */

 const { execSync } = require('child_process');
 const fs = require('fs');
 const path = require('path');
 
 console.log('🔍 DIAGNÓSTICO DE SERVICIOS DE WINDOWS\n');
 
 async function main() {
     console.log('📋 Verificando estado actual de servicios...\n');
     
     // Verificar permisos de administrador
     const isAdmin = checkAdminRights();
     console.log(`👤 Permisos de administrador: ${isAdmin ? '✅ SÍ' : '❌ NO'}`);
     
     if (!isAdmin) {
         console.log('\n⚠️  ADVERTENCIA: Se necesitan permisos de administrador para instalar servicios');
         console.log('💡 Abre cmd como Administrador y ejecuta este script nuevamente\n');
     }
     
     // Verificar servicios existentes relacionados
     await checkExistingServices();
     
     // Verificar PM2
     await checkPM2Status();
     
     // Verificar node-windows
     await checkNodeWindows();
     
     // Verificar archivos de configuración
     await checkConfigFiles();
     
     // Mostrar opciones de instalación
     showInstallationOptions();
 }
 
 function checkAdminRights() {
     try {
         execSync('net session', { stdio: 'ignore' });
         return true;
     } catch (e) {
         return false;
     }
 }
 
 async function checkExistingServices() {
     console.log('\n🔍 Buscando servicios relacionados en Windows...\n');
     
     const serviceNames = [
         'Sincronizador ERP WooCommerce',
         'sync-erp-woocommerce',
         'SyncERP',
         'PM2'
     ];
     
     for (const serviceName of serviceNames) {
         try {
             const output = execSync(`sc query "${serviceName}"`, { 
                 encoding: 'utf8', 
                 stdio: 'pipe' 
             });
             
             if (output.includes('STATE')) {
                 console.log(`✅ Servicio encontrado: ${serviceName}`);
                 console.log(`   Estado: ${output.includes('RUNNING') ? 'EJECUTÁNDOSE' : 'DETENIDO'}`);
             }
         } catch (e) {
             console.log(`❌ No encontrado: ${serviceName}`);
         }
     }
 }
 
 async function checkPM2Status() {
     console.log('\n🔍 Verificando PM2...\n');
     
     try {
         // Verificar si PM2 está instalado
         const pm2Version = execSync('pm2 --version', { encoding: 'utf8', stdio: 'pipe' });
         console.log(`✅ PM2 instalado: v${pm2Version.trim()}`);
         
         // Verificar procesos PM2
         try {
             const pm2List = execSync('pm2 list', { encoding: 'utf8', stdio: 'pipe' });
             console.log('📋 Procesos PM2:');
             console.log(pm2List);
             
             if (pm2List.includes('sync-erp-woocommerce')) {
                 console.log('✅ Proceso sync-erp-woocommerce encontrado en PM2');
                 
                 // Verificar si PM2 está configurado para inicio automático
                 try {
                     const startupInfo = execSync('pm2 startup', { encoding: 'utf8', stdio: 'pipe' });
                     if (startupInfo.includes('already')) {
                         console.log('✅ PM2 startup ya configurado');
                     } else {
                         console.log('⚠️  PM2 startup no configurado');
                     }
                 } catch (e) {
                     console.log('⚠️  Error verificando PM2 startup');
                 }
             } else {
                 console.log('❌ Proceso sync-erp-woocommerce NO encontrado en PM2');
             }
             
         } catch (e) {
             console.log('❌ Error listando procesos PM2');
         }
         
     } catch (e) {
         console.log('❌ PM2 no está instalado globalmente');
     }
 }
 
 async function checkNodeWindows() {
     console.log('\n🔍 Verificando node-windows...\n');
     
     try {
         const nodeWindows = require('node-windows');
         console.log('✅ node-windows está disponible');
         
         // Verificar si hay archivos de servicio
         const serviceFiles = [
             path.join(__dirname, 'daemon'),
             path.join(process.env.ALLUSERSPROFILE || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'StartUp', 'Sincronizador ERP WooCommerce.lnk')
         ];
         
         serviceFiles.forEach(file => {
             if (fs.existsSync(file)) {
                 console.log(`✅ Archivo de servicio encontrado: ${file}`);
             } else {
                 console.log(`❌ No encontrado: ${file}`);
             }
         });
         
     } catch (e) {
         console.log('❌ node-windows no está instalado');
         console.log('💡 Instalar con: npm install -g node-windows');
     }
 }
 
 async function checkConfigFiles() {
     console.log('\n🔍 Verificando archivos de configuración...\n');
     
     const configFiles = [
         'ecosystem.config.js',
         'app.js',
         'sync-enhanced.js',
         '.env'
     ];
     
     configFiles.forEach(file => {
         if (fs.existsSync(file)) {
             console.log(`✅ ${file} existe`);
         } else {
             console.log(`❌ ${file} faltante`);
         }
     });
 }
 
 function showInstallationOptions() {
     console.log('\n🛠️  OPCIONES DE INSTALACIÓN RECOMENDADAS\n');
     
     console.log('📋 Basándose en el diagnóstico, aquí están tus opciones:\n');
     
     console.log('🏆 OPCIÓN 1: PM2 + pm2-windows-service (RECOMENDADO)');
     console.log('   Ventajas: Fácil gestión, logs integrados, reinicio automático');
     console.log('   Comandos:');
     console.log('   > npm install -g pm2 pm2-windows-service');
     console.log('   > pm2 start ecosystem.config.js');
     console.log('   > pm2 save');
     console.log('   > pm2-service-install');
     console.log('   > pm2-service-start\n');
     
     console.log('🔧 OPCIÓN 2: node-windows (Servicio nativo)');
     console.log('   Ventajas: Integración completa con Windows Services');
     console.log('   Comandos:');
     console.log('   > npm install -g node-windows');
     console.log('   > node install-service-native.js (script que voy a crear)\n');
     
     console.log('⚡ OPCIÓN 3: NSSM (Windows Service Wrapper)');
     console.log('   Ventajas: Más robusto, mejor control de servicios');
     console.log('   Pasos:');
     console.log('   1. Descargar NSSM desde nssm.cc');
     console.log('   2. nssm install "Sincronizador ERP"');
     console.log('   3. Configurar paths y parámetros\n');
     
     console.log('🎯 OPCIÓN 4: Programador de Tareas (Task Scheduler)');
     console.log('   Ventajas: No requiere software adicional');
     console.log('   Pasos: Usar taskschd.msc para crear tarea al inicio\n');
     
     console.log('❓ ¿Qué opción prefieres? Puedo ayudarte con cualquiera.');
 }
 
 // Ejecutar diagnóstico
 if (require.main === module) {
     main().catch(error => {
         console.error('❌ Error durante el diagnóstico:', error.message);
     });
 }