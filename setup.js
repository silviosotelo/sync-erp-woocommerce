#!/usr/bin/env node

/**
 * setup.js
 * Script de configuración inicial para el Sincronizador ERP
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔄 CONFIGURACIÓN INICIAL - SINCRONIZADOR ERP → WOOCOMMERCE\n');

// Configuración por defecto
const config = {
  NODE_ENV: 'production',
  PORT: '3001',
  HOST: '0.0.0.0',
  DB_HOST: 'srv1313.hstgr.io',
  DB_USER: 'u377556581_vWMEZ',
  DB_PASSWORD: 'NJdPaC3A$j7DCzE&yU^P',
  DB_NAME: 'u377556581_OXkxK',
  DB_PREFIX: 'btw70',
  ERP_ENDPOINT: 'https://api.farmatotal.com.py/farma/next/ecommerce/',
  ERP_API_KEY: '',
  JWT_SECRET: '',
  LOG_LEVEL: 'INFO',
  SYNC_INTERVAL_MINUTES: '10',
  AUTO_SYNC_ENABLED: 'true',
  SMTP_ENABLED: 'false',
  SMS_ENABLED: 'false',
  TZ: 'America/Asuncion'
};

function question(prompt, defaultValue = '') {
  return new Promise(resolve => {
    const displayPrompt = defaultValue 
      ? `${prompt} (${defaultValue}): `
      : `${prompt}: `;
    
    rl.question(displayPrompt, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

async function setupConfiguration() {
  try {
    console.log('📋 CONFIGURACIÓN BÁSICA\n');
    
    // Configuración del servidor
    config.NODE_ENV = await question('Entorno (development/production)', config.NODE_ENV);
    config.PORT = await question('Puerto del servidor', config.PORT);
    
    console.log('\n💾 CONFIGURACIÓN DE BASE DE DATOS\n');
    
    // Configuración de base de datos
    config.DB_HOST = await question('Host de MySQL', config.DB_HOST);
    config.DB_USER = await question('Usuario de MySQL', config.DB_USER);
    config.DB_PASSWORD = await question('Password de MySQL', config.DB_PASSWORD);
    config.DB_NAME = await question('Nombre de la base de datos', config.DB_NAME);
    config.DB_PREFIX = await question('Prefijo de tablas WordPress', config.DB_PREFIX);
    
    console.log('\n🔌 CONFIGURACIÓN DE ERP\n');
    
    // Configuración del ERP
    config.ERP_ENDPOINT = await question('URL del API ERP', config.ERP_ENDPOINT);
    config.ERP_API_KEY = await question('API Key del ERP (opcional)', config.ERP_API_KEY);
    
    console.log('\n🔒 CONFIGURACIÓN DE SEGURIDAD\n');
    
    // Generar secretos automáticamente
    const generateSecrets = await question('¿Generar secretos de seguridad automáticamente? (s/n)', 's');
    
    if (generateSecrets.toLowerCase() === 's') {
      config.JWT_SECRET = generateSecret(32);
      console.log('✅ JWT Secret generado automáticamente');
    } else {
      config.JWT_SECRET = await question('JWT Secret (mínimo 32 caracteres)');
    }
    
    console.log('\n⚙️ CONFIGURACIÓN DE SINCRONIZACIÓN\n');
    
    config.SYNC_INTERVAL_MINUTES = await question('Intervalo de sincronización (minutos)', config.SYNC_INTERVAL_MINUTES);
    config.LOG_LEVEL = await question('Nivel de logs (DEBUG/INFO/WARN/ERROR)', config.LOG_LEVEL);
    
    console.log('\n📧 CONFIGURACIÓN DE NOTIFICACIONES (OPCIONAL)\n');
    
    const enableEmail = await question('¿Habilitar notificaciones por email? (s/n)', 'n');
    if (enableEmail.toLowerCase() === 's') {
      config.SMTP_ENABLED = 'true';
      config.SMTP_HOST = await question('Host SMTP', 'smtp.gmail.com');
      config.SMTP_PORT = await question('Puerto SMTP', '587');
      config.SMTP_USER = await question('Usuario SMTP (email)');
      config.SMTP_PASS = await question('Password SMTP');
      config.SMTP_FROM_EMAIL = await question('Email remitente', config.SMTP_USER);
    }
    
    const enableSMS = await question('¿Habilitar notificaciones por SMS? (s/n)', 'n');
    if (enableSMS.toLowerCase() === 's') {
      config.SMS_ENABLED = 'true';
      config.TWILIO_ACCOUNT_SID = await question('Twilio Account SID');
      config.TWILIO_AUTH_TOKEN = await question('Twilio Auth Token');
      config.TWILIO_PHONE_NUMBER = await question('Número de teléfono Twilio');
      config.SMS_RECIPIENT = await question('Número destinatario SMS');
    }
    
    // Crear archivo .env
    console.log('\n📝 Generando archivo .env...\n');
    
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const envHeader = `# ===================================================================
# ARCHIVO .env - Generado automáticamente
# Fecha: ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}
# ===================================================================

`;
    
    fs.writeFileSync('.env', envHeader + envContent);
    
    console.log('✅ Archivo .env creado exitosamente!\n');
    
    // Crear directorios necesarios
    console.log('📁 Creando directorios necesarios...\n');
    
    const dirs = ['logs', 'backups', 'tmp', 'dashboard'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Directorio ${dir}/ creado`);
      }
    });
    
    // Crear .gitignore si no existe
    if (!fs.existsSync('.gitignore')) {
      const gitignoreContent = `# Logs
logs/
*.log

# Environment variables
.env
.env.local
.env.*.local

# Dependencies
node_modules/

# Backups
backups/

# Temporary files
tmp/

# OS generated files
.DS_Store
Thumbs.db
`;
      
      fs.writeFileSync('.gitignore', gitignoreContent);
      console.log('✅ Archivo .gitignore creado');
    }
    
    console.log('\n🎉 CONFIGURACIÓN COMPLETADA!\n');
    console.log('📋 Siguiente pasos:');
    console.log('   1. Revisar y ajustar el archivo .env si es necesario');
    console.log('   2. Instalar dependencias: npm install');
    console.log('   3. Inicializar base de datos: node scripts/init-database.js');
    console.log('   4. Iniciar servidor: npm start');
    console.log('\n🚀 Dashboard estará disponible en: http://localhost:' + config.PORT);
    
  } catch (error) {
    console.error('\n❌ Error durante la configuración:', error.message);
  } finally {
    rl.close();
  }
}

// Verificar si ya existe .env
if (fs.existsSync('.env')) {
  console.log('⚠️  Ya existe un archivo .env');
  rl.question('¿Deseas sobrescribirlo? (s/n): ', (answer) => {
    if (answer.toLowerCase() === 's') {
      setupConfiguration();
    } else {
      console.log('Configuración cancelada.');
      rl.close();
    }
  });
} else {
  setupConfiguration();
}