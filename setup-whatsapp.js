#!/usr/bin/env node

/**
 * setup-whatsapp.js
 * Script para configurar WhatsApp en el sincronizador
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📱 CONFIGURADOR DE WHATSAPP - Sincronizador ERP\n');

async function main() {
    try {
        console.log('📋 Verificando configuración actual...\n');
        
        // Verificar si ya está habilitado
        require('dotenv').config();
        const isEnabled = process.env.WHATSAPP_ENABLED === 'true';
        
        if (isEnabled) {
            console.log('✅ WhatsApp ya está habilitado en .env');
        } else {
            console.log('⚠️  WhatsApp no está habilitado, activando...');
            await enableWhatsAppInEnv();
        }
        
        // Verificar dependencias
        console.log('\n📦 Verificando dependencias de WhatsApp...\n');
        await checkAndInstallDependencies();
        
        // Crear directorio de autenticación
        console.log('\n📁 Preparando directorios...\n');
        await setupDirectories();
        
        // Verificar configuración
        console.log('\n🔍 Verificando configuración...\n');
        await verifyConfiguration();
        
        console.log('\n🎉 CONFIGURACIÓN DE WHATSAPP COMPLETADA!\n');
        console.log('📋 Siguiente pasos:');
        console.log('   1. Iniciar el servidor: npm start');
        console.log('   2. Abrir dashboard: http://localhost:3001');
        console.log('   3. Ir a "Configurar WhatsApp" en el dashboard');
        console.log('   4. Escanear el código QR con tu teléfono');
        console.log('\n💡 Una vez conectado, recibirás notificaciones automáticas!');
        
    } catch (error) {
        console.error('\n❌ Error configurando WhatsApp:', error.message);
        console.log('\n🛠️ Soluciones:');
        console.log('   1. Ejecutar como administrador (Windows) o con sudo (Linux)');
        console.log('   2. Verificar conexión a internet');
        console.log('   3. Reinstalar dependencias: npm install');
        process.exit(1);
    }
}

async function enableWhatsAppInEnv() {
    try {
        const envPath = '.env';
        
        if (!fs.existsSync(envPath)) {
            console.log('❌ Archivo .env no encontrado');
            console.log('💡 Ejecuta primero: npm run setup');
            throw new Error('Archivo .env no encontrado');
        }
        
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Habilitar WhatsApp
        if (envContent.includes('WHATSAPP_ENABLED=false')) {
            envContent = envContent.replace('WHATSAPP_ENABLED=false', 'WHATSAPP_ENABLED=true');
            fs.writeFileSync(envPath, envContent);
            console.log('✅ WhatsApp habilitado en .env');
        }
        
        // Verificar que tenga número destinatario
        if (!envContent.includes('WHATSAPP_RECIPIENT=') || envContent.includes('WHATSAPP_RECIPIENT=595994116214')) {
            console.log('⚠️  IMPORTANTE: Configura tu número en WHATSAPP_RECIPIENT en el .env');
            console.log('   Formato: WHATSAPP_RECIPIENT=595981234567 (con código de país)');
        }
        
    } catch (error) {
        throw new Error(`Error actualizando .env: ${error.message}`);
    }
}

async function checkAndInstallDependencies() {
    const requiredDeps = [
        '@whiskeysockets/baileys',
        '@hapi/boom',
        'qrcode-terminal'
    ];
    
    console.log('🔍 Verificando dependencias requeridas...');
    
    for (const dep of requiredDeps) {
        try {
            require.resolve(dep);
            console.log(`✅ ${dep} - Instalado`);
        } catch (e) {
            console.log(`❌ ${dep} - Faltante, instalando...`);
            
            try {
                console.log(`📦 Instalando ${dep}...`);
                execSync(`npm install ${dep}`, { stdio: 'inherit' });
                console.log(`✅ ${dep} instalado exitosamente`);
            } catch (installError) {
                throw new Error(`Error instalando ${dep}: ${installError.message}`);
            }
        }
    }
}

async function setupDirectories() {
    const dirs = [
        'tmp',
        'tmp/whatsapp-auth',
        'modules'
    ];
    
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Directorio creado: ${dir}/`);
        } else {
            console.log(`✅ Directorio existe: ${dir}/`);
        }
    });
}

async function verifyConfiguration() {
    // Verificar que el módulo de WhatsApp existe
    const whatsappModulePath = path.join(__dirname, 'modules', 'whatsapp-notifier.js');
    
    if (!fs.existsSync(whatsappModulePath)) {
        console.log('❌ Módulo whatsapp-notifier.js no encontrado');
        console.log('💡 Asegúrate de tener el archivo modules/whatsapp-notifier.js');
        throw new Error('Módulo WhatsApp no encontrado');
    } else {
        console.log('✅ Módulo whatsapp-notifier.js encontrado');
    }
    
    // Verificar configuración en .env
    require('dotenv').config();
    
    const requiredVars = ['WHATSAPP_ENABLED', 'WHATSAPP_RECIPIENT'];
    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.log(`⚠️  Variables faltantes en .env: ${missing.join(', ')}`);
    } else {
        console.log('✅ Variables de entorno configuradas');
    }
    
    // Probar importación del módulo
    try {
        const WhatsAppNotifier = require('./modules/whatsapp-notifier');
        console.log('✅ Módulo WhatsApp se puede importar correctamente');
    } catch (error) {
        console.log('❌ Error importando módulo WhatsApp:', error.message);
        throw error;
    }
}

function showHelp() {
    console.log(`
📱 Configurador de WhatsApp para Sincronizador ERP

Uso:
  node setup-whatsapp.js [opciones]

Opciones:
  --help, -h     Mostrar esta ayuda
  --check        Solo verificar configuración actual
  --force        Forzar reinstalación de dependencias

Ejemplos:
  node setup-whatsapp.js           # Configuración completa
  node setup-whatsapp.js --check   # Solo verificar estado
  node setup-whatsapp.js --force   # Reinstalar todo

Nota: Este script configura WhatsApp para el sincronizador.
Después de ejecutarlo, inicia el servidor y escanea el QR code.
`);
}

// Procesamiento de argumentos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}

if (args.includes('--check')) {
    console.log('🔍 VERIFICACIÓN DE WHATSAPP\n');
    verifyConfiguration().then(() => {
        console.log('\n✅ Verificación completada');
    }).catch(error => {
        console.error('\n❌ Verificación falló:', error.message);
        process.exit(1);
    });
} else {
    // Ejecutar configuración completa
    main().catch(error => {
        console.error('\n💥 Error durante la configuración:', error.message);
        process.exit(1);
    });
}