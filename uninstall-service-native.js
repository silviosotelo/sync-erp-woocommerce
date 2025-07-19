#!/usr/bin/env node

/**
 * uninstall-service-native.js
 * Desinstalación específica del servicio nativo de Windows
 */

 const path = require('path');
 const fs = require('fs');
 const { execSync } = require('child_process');
 
 console.log('🗑️  DESINSTALADOR DE SERVICIO NATIVO DE WINDOWS\n');
 
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
     console.log('   3. Ejecuta: node uninstall-service-native.js\n');
     process.exit(1);
 }
 
 async function main() {
     try {
         console.log('✅ Permisos de administrador confirmados\n');
         
         // Mostrar servicios actuales
         showCurrentServices();
         
         // Confirmar desinstalación
         await confirmUninstall();
         
         // Desinstalar servicio
         await uninstallWindowsService();
         
         // Limpiar archivos
         cleanupFiles();
         
         console.log('\n🎉 Desinstalación completada exitosamente!');
         
     } catch (error) {
         console.error('\n❌ Error durante la desinstalación:', error.message);
         console.log('\n🛠️  Desinstalación manual:');
         console.log('   1. Abrir services.msc');
         console.log('   2. Buscar "Sincronizador ERP WooCommerce"');
         console.log('   3. Click derecho > Detener');
         console.log('   4. Click derecho > Eliminar');
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
 
 function showCurrentServices() {
     console.log('🔍 Servicios de Windows relacionados:\n');
     
     const serviceNames = [
         'Sincronizador ERP WooCommerce',
         'PM2'
     ];
     
     let foundServices = [];
     
     serviceNames.forEach(serviceName => {
         try {
             const output = execSync(`sc query "${serviceName}"`, { 
                 encoding: 'utf8', 
                 stdio: 'pipe' 
             });
             
             const state = output.includes('RUNNING') ? 'EJECUTÁNDOSE' : 
                          output.includes('STOPPED') ? 'DETENIDO' : 'DESCONOCIDO';
             
             console.log(`✅ ${serviceName}: ${state}`);
             foundServices.push(serviceName);
             
         } catch (e) {
             console.log(`❌ ${serviceName}: No instalado`);
         }
     });
     
     if (foundServices.length === 0) {
         console.log('\n⚠️  No se encontraron servicios para desinstalar');
         process.exit(0);
     }
     
     return foundServices;
 }
 
 function confirmUninstall() {
     return new Promise((resolve) => {
         const readline = require('readline');
         const rl = readline.createInterface({
             input: process.stdin,
             output: process.stdout
         });
         
         rl.question('\n¿Confirmas que deseas desinstalar el servicio? (s/n): ', (answer) => {
             rl.close();
             
             if (answer.toLowerCase() === 's') {
                 resolve();
             } else {
                 console.log('Desinstalación cancelada.');
                 process.exit(0);
             }
         });
     });
 }
 
 async function uninstallWindowsService() {
     console.log('\n🗑️  Desinstalando servicio nativo de Windows...\n');
     
     try {
         // Verificar si node-windows está disponible
         const Service = require('node-windows').Service;
         
         // Configurar el servicio (misma configuración que en la instalación)
         const svc = new Service({
             name: 'Sincronizador ERP WooCommerce',
             script: path.join(__dirname, 'app.js')
         });
         
         return new Promise((resolve, reject) => {
             // Configurar eventos
             svc.on('uninstall', function() {
                 console.log('✅ Servicio desinstalado exitosamente');
                 console.log('🧹 El servicio ya no aparecerá en services.msc');
                 resolve();
             });
             
             svc.on('error', function(err) {
                 console.error('❌ Error durante la desinstalación:', err.message);
                 reject(err);
             });
             
             // Verificar si el servicio existe
             if (svc.exists) {
                 console.log('🛑 Deteniendo servicio...');
                 
                 // Intentar detener el servicio primero
                 try {
                     execSync('sc stop "Sincronizador ERP WooCommerce"', { stdio: 'pipe' });
                     console.log('✅ Servicio detenido');
                 } catch (e) {
                     console.log('⚠️  El servicio ya estaba detenido o no respondió');
                 }
                 
                 console.log('🗑️  Desinstalando servicio...');
                 svc.uninstall();
             } else {
                 console.log('⚠️  El servicio no está instalado');
                 resolve();
             }
             
             // Timeout de seguridad
             setTimeout(() => {
                 reject(new Error('Timeout: La desinstalación tardó demasiado'));
             }, 30000); // 30 segundos
         });
         
     } catch (e) {
         // Si node-windows no está disponible, intentar desinstalación manual
         console.log('⚠️  node-windows no disponible, intentando desinstalación manual...');
         
         try {
             // Detener servicio
             execSync('sc stop "Sincronizador ERP WooCommerce"', { stdio: 'pipe' });
             console.log('✅ Servicio detenido');
         } catch (stopError) {
             console.log('⚠️  Error deteniendo servicio (puede ya estar detenido)');
         }
         
         try {
             // Eliminar servicio
             execSync('sc delete "Sincronizador ERP WooCommerce"', { stdio: 'pipe' });
             console.log('✅ Servicio eliminado manualmente');
         } catch (deleteError) {
             throw new Error(`Error eliminando servicio: ${deleteError.message}`);
         }
     }
 }
 
 function cleanupFiles() {
     console.log('\n🧹 Limpiando archivos relacionados...\n');
     
     const filesToClean = [
         path.join(__dirname, 'daemon'),
         'ecosystem.config.js'
     ];
     
     filesToClean.forEach(item => {
         try {
             if (fs.existsSync(item)) {
                 const stats = fs.statSync(item);
                 
                 if (stats.isDirectory()) {
                     // Eliminar directorio recursivamente
                     fs.rmSync(item, { recursive: true, force: true });
                     console.log(`🗑️  Directorio eliminado: ${item}`);
                 } else {
                     // Eliminar archivo
                     fs.unlinkSync(item);
                     console.log(`🗑️  Archivo eliminado: ${item}`);
                 }
             }
         } catch (e) {
             console.log(`⚠️  No se pudo eliminar: ${item} (${e.message})`);
         }
     });
     
     // Verificar en ProgramData
     const programDataPath = path.join(
         process.env.ALLUSERSPROFILE || 'C:\\ProgramData',
         'Sincronizador ERP WooCommerce'
     );
     
     if (fs.existsSync(programDataPath)) {
         try {
             fs.rmSync(programDataPath, { recursive: true, force: true });
             console.log(`🗑️  Datos del programa eliminados: ${programDataPath}`);
         } catch (e) {
             console.log(`⚠️  No se pudieron eliminar datos del programa: ${e.message}`);
         }
     }
 }
 
 // Verificar estado actual antes de desinstalar
 console.log('🔍 Verificando servicios antes de desinstalar...');
 
 // Ejecutar desinstalación
 if (require.main === module) {
     main().catch(error => {
         console.error('💥 Error crítico durante la desinstalación:', error.message);
         
         console.log('\n📋 DESINSTALACIÓN MANUAL:');
         console.log('   1. Abrir "Servicios" (services.msc) como Administrador');
         console.log('   2. Buscar "Sincronizador ERP WooCommerce"');
         console.log('   3. Click derecho > Detener');
         console.log('   4. Click derecho > Propiedades > Detener > Aceptar');
         console.log('   5. Click derecho > Eliminar');
         console.log('   6. Reiniciar Windows para completar la limpieza');
         
         process.exit(1);
     });
 }
 
 module.exports = { main, checkAdminRights, uninstallWindowsService };