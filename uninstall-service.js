/**
 * uninstall-service.js
 * Script para desinstalar el Sincronizador ERP de Windows
 */

const path = require('path');
const fs = require('fs');

console.log('🗑️  DESINSTALADOR DE SERVICIO WINDOWS - Sincronizador ERP\n');

// Verificar sistema operativo
if (process.platform !== 'win32') {
    console.error('❌ Este script es solo para Windows');
    process.exit(1);
}

// Detectar servicios instalados
detectInstalledServices();

function detectInstalledServices() {
    console.log('🔍 Detectando servicios instalados...\n');
    
    const hasPM2Service = checkPM2Service();
    const hasNodeWindowsService = checkNodeWindowsService();
    
    console.log('📋 Servicios encontrados:');
    console.log(`   PM2: ${hasPM2Service ? '✅ Encontrado' : '❌ No encontrado'}`);
    console.log(`   node-windows: ${hasNodeWindowsService ? '✅ Encontrado' : '❌ No encontrado'}`);
    console.log('');
    
    if (!hasPM2Service && !hasNodeWindowsService) {
        console.log('ℹ️  No se encontraron servicios para desinstalar');
        process.exit(0);
    }
    
    promptUninstallMethod(hasPM2Service, hasNodeWindowsService);
}

function checkPM2Service() {
    try {
        const { execSync } = require('child_process');
        const output = execSync('pm2 list', { encoding: 'utf8', stdio: 'pipe' });
        return output.includes('sync-erp-woocommerce');
    } catch (e) {
        return false;
    }
}

function checkNodeWindowsService() {
    try {
        const { execSync } = require('child_process');
        const output = execSync('sc query "Sincronizador ERP WooCommerce"', { 
            encoding: 'utf8', 
            stdio: 'pipe' 
        });
        return !output.includes('FAILED');
    } catch (e) {
        return false;
    }
}

function promptUninstallMethod(hasPM2, hasNodeWindows) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('🗑️  ¿Qué servicios deseas desinstalar?');
    
    let options = [];
    let optionNumber = 1;
    
    if (hasPM2) {
        options.push({ number: optionNumber++, type: 'pm2', label: 'PM2 Service' });
        console.log(`   ${optionNumber - 1}. Desinstalar servicio PM2`);
    }
    
    if (hasNodeWindows) {
        options.push({ number: optionNumber++, type: 'nodewindows', label: 'node-windows Service' });
        console.log(`   ${optionNumber - 1}. Desinstalar servicio node-windows`);
    }
    
    if (hasPM2 && hasNodeWindows) {
        options.push({ number: optionNumber++, type: 'both', label: 'Ambos servicios' });
        console.log(`   ${optionNumber - 1}. Desinstalar ambos servicios`);
    }
    
    options.push({ number: optionNumber++, type: 'cancel', label: 'Cancelar' });
    console.log(`   ${optionNumber - 1}. Cancelar\n`);
    
    rl.question('Selecciona una opción: ', (answer) => {
        rl.close();
        
        const selectedOption = options.find(opt => opt.number == answer.trim());
        
        if (!selectedOption) {
            console.log('❌ Opción inválida');
            process.exit(1);
        }
        
        switch (selectedOption.type) {
            case 'pm2':
                uninstallPM2Service();
                break;
            case 'nodewindows':
                uninstallNodeWindowsService();
                break;
            case 'both':
                uninstallBothServices();
                break;
            case 'cancel':
                console.log('Desinstalación cancelada.');
                break;
        }
    });
}

function uninstallPM2Service() {
    console.log('\n🗑️  DESINSTALANDO SERVICIO PM2...\n');
    
    const { execSync } = require('child_process');
    
    try {
        console.log('🛑 Deteniendo servicio PM2...');
        execSync('pm2 stop sync-erp-woocommerce', { stdio: 'inherit' });
        
        console.log('🗑️  Eliminando del PM2...');
        execSync('pm2 delete sync-erp-woocommerce', { stdio: 'inherit' });
        
        console.log('💾 Guardando configuración PM2...');
        execSync('pm2 save', { stdio: 'inherit' });
        
        // Preguntar si desinstalar startup automático
        console.log('\n❓ ¿Deseas desinstalar el inicio automático de PM2?');
        console.log('   (Esto afectará TODOS los servicios PM2)');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('¿Desinstalar startup automático? (s/n): ', (answer) => {
            rl.close();
            
            if (answer.toLowerCase() === 's') {
                try {
                    console.log('🔧 Desinstalando startup automático...');
                    execSync('pm2-startup uninstall', { stdio: 'inherit' });
                } catch (e) {
                    console.log('⚠️  Error desinstalando startup automático');
                }
            }
            
            // Eliminar archivo ecosystem.config.js
            const ecosystemPath = path.join(__dirname, 'ecosystem.config.js');
            if (fs.existsSync(ecosystemPath)) {
                fs.unlinkSync(ecosystemPath);
                console.log('🗑️  ecosystem.config.js eliminado');
            }
            
            console.log('\n✅ SERVICIO PM2 DESINSTALADO EXITOSAMENTE');
            showFinalInstructions();
        });
        
    } catch (error) {
        console.error('❌ Error desinstalando servicio PM2:', error.message);
        process.exit(1);
    }
}

function uninstallNodeWindowsService() {
    console.log('\n🗑️  DESINSTALANDO SERVICIO NODE-WINDOWS...\n');
    
    try {
        const Service = require('node-windows').Service;
        
        // Crear referencia al servicio
        const svc = new Service({
            name: 'Sincronizador ERP WooCommerce',
            script: path.join(__dirname, 'app.js')
        });
        
        // Escuchar evento de desinstalación
        svc.on('uninstall', function() {
            console.log('✅ SERVICIO NODE-WINDOWS DESINSTALADO EXITOSAMENTE');
            showFinalInstructions();
        });
        
        svc.on('error', function(err) {
            console.error('❌ Error desinstalando servicio:', err);
        });
        
        // Verificar si existe y desinstalar
        if (svc.exists) {
            console.log('🛑 Deteniendo y desinstalando servicio...');
            svc.uninstall();
        } else {
            console.log('⚠️  El servicio no está instalado');
            showFinalInstructions();
        }
        
    } catch (error) {
        console.error('❌ Error desinstalando servicio node-windows:', error.message);
        console.log('\n💡 Intenta ejecutar como Administrador');
        
        // Intentar desinstalar manualmente
        console.log('\n🔧 Intentando desinstalar manualmente...');
        try {
            const { execSync } = require('child_process');
            execSync('sc stop "Sincronizador ERP WooCommerce"', { stdio: 'ignore' });
            execSync('sc delete "Sincronizador ERP WooCommerce"', { stdio: 'inherit' });
            console.log('✅ Servicio desinstalado manualmente');
        } catch (e) {
            console.error('❌ No se pudo desinstalar manualmente');
            console.log('\n📋 Desinstalación manual:');
            console.log('   1. Abrir "Servicios" (services.msc)');
            console.log('   2. Buscar "Sincronizador ERP WooCommerce"');
            console.log('   3. Detener y eliminar el servicio');
        }
        
        process.exit(1);
    }
}

function uninstallBothServices() {
    console.log('\n🗑️  DESINSTALANDO AMBOS SERVICIOS...\n');
    
    console.log('1️⃣ Desinstalando PM2...');
    try {
        const { execSync } = require('child_process');
        execSync('pm2 stop sync-erp-woocommerce', { stdio: 'ignore' });
        execSync('pm2 delete sync-erp-woocommerce', { stdio: 'ignore' });
        execSync('pm2 save', { stdio: 'ignore' });
        console.log('✅ Servicio PM2 desinstalado');
    } catch (e) {
        console.log('⚠️  Error desinstalando PM2 (puede no estar instalado)');
    }
    
    console.log('\n2️⃣ Desinstalando node-windows...');
    try {
        const Service = require('node-windows').Service;
        const svc = new Service({
            name: 'Sincronizador ERP WooCommerce',
            script: path.join(__dirname, 'app.js')
        });
        
        svc.on('uninstall', function() {
            console.log('✅ Servicio node-windows desinstalado');
            console.log('\n✅ AMBOS SERVICIOS DESINSTALADOS EXITOSAMENTE');
            showFinalInstructions();
        });
        
        if (svc.exists) {
            svc.uninstall();
        } else {
            console.log('⚠️  Servicio node-windows no estaba instalado');
            console.log('\n✅ DESINSTALACIÓN COMPLETADA');
            showFinalInstructions();
        }
        
    } catch (e) {
        console.log('⚠️  Error desinstalando node-windows');
        console.log('\n✅ DESINSTALACIÓN PM2 COMPLETADA');
        showFinalInstructions();
    }
    
    // Limpiar archivos
    cleanupFiles();
}

function cleanupFiles() {
    console.log('\n🧹 Limpiando archivos...');
    
    const filesToClean = [
        'ecosystem.config.js',
        'daemon/winsw.log',
        'daemon/winsw.err.log'
    ];
    
    filesToClean.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  ${file} eliminado`);
            } catch (e) {
                console.log(`⚠️  No se pudo eliminar ${file}`);
            }
        }
    });
    
    // Limpiar directorio daemon si existe y está vacío
    const daemonDir = path.join(__dirname, 'daemon');
    if (fs.existsSync(daemonDir)) {
        try {
            const files = fs.readdirSync(daemonDir);
            if (files.length === 0) {
                fs.rmdirSync(daemonDir);
                console.log('🗑️  Directorio daemon eliminado');
            }
        } catch (e) {
            console.log('⚠️  No se pudo eliminar directorio daemon');
        }
    }
}

function showFinalInstructions() {
    console.log('\n📋 DESINSTALACIÓN COMPLETADA\n');
    console.log('🔧 Pasos adicionales recomendados:');
    console.log('   1. El código fuente NO fue eliminado');
    console.log('   2. Los logs y backups permanecen intactos');
    console.log('   3. La configuración (.env) se conserva');
    console.log('\n💡 Para reinstalar el servicio:');
    console.log('   node install-service.js');
    console.log('\n💡 Para ejecutar manualmente:');
    console.log('   npm start');
    console.log('\n📞 Si tienes problemas:');
    console.log('   - Verifica en "Servicios" de Windows (services.msc)');
    console.log('   - Ejecuta como Administrador si es necesario');
    console.log('   - Revisa los logs en ./logs/');
}

// Verificar permisos de administrador
function checkAdminRights() {
    try {
        const { execSync } = require('child_process');
        execSync('net session', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// Advertencia si no es administrador
if (!checkAdminRights()) {
    console.log('⚠️  ADVERTENCIA: No se detectaron permisos de administrador');
    console.log('💡 Para mejores resultados, ejecuta como Administrador\n');
}