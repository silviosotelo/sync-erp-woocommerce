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