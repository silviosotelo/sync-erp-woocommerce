const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Farmatotal Sync ERP',
  description: 'Sincronizador bidireccional ERP <-> WooCommerce con cola de reintentos',
  script: path.join(__dirname, '..', 'server.js'),
  nodeOptions: [
    '--max_old_space_size=2048'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ],
  workingDirectory: path.join(__dirname, '..'),
  allowServiceLogon: true,
  grow: 0.5,
  maxRestarts: 10,
  abortOnError: false,
  wait: 2,
  maxRetries: 3
});

svc.on('install', () => {
  console.log('\n✅ Servicio instalado correctamente');
  console.log('📝 Nombre: Farmatotal Sync ERP');
  console.log('🚀 Iniciando servicio...\n');
  svc.start();
});

svc.on('start', () => {
  console.log('✅ Servicio iniciado correctamente');
  console.log('📊 Dashboard: http://localhost:3001');
  console.log('\n📋 Comandos útiles:');
  console.log('   - Ver servicios: services.msc');
  console.log('   - Logs: logs/2026-XX-XX.log');
  console.log('   - Errores: logs/errors/2026-XX-XX-errors.log');
  console.log('\n⚠️  Para desinstalar: npm run uninstall:windows\n');
});

svc.on('error', (err) => {
  console.error('❌ Error en el servicio:', err);
});

console.log('\n' + '='.repeat(60));
console.log('  INSTALANDO SERVICIO DE WINDOWS');
console.log('='.repeat(60) + '\n');

console.log('📦 Instalando "Farmatotal Sync ERP" como servicio...');
console.log('📁 Directorio de trabajo:', path.join(__dirname, '..'));
console.log('📄 Script principal: server.js\n');

svc.install();
