const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Farmatotal Sync ERP',
  script: path.join(__dirname, '..', 'server.js')
});

svc.on('uninstall', () => {
  console.log('\n✅ Servicio desinstalado correctamente');
  console.log('📝 El servicio "Farmatotal Sync ERP" ha sido eliminado\n');
  console.log('💡 Los logs y datos no han sido eliminados');
  console.log('   Para limpiar completamente ejecuta: npm run clean\n');
});

svc.on('error', (err) => {
  console.error('❌ Error al desinstalar:', err);
});

svc.on('alreadyuninstalled', () => {
  console.log('\n⚠️  El servicio no está instalado o ya fue desinstalado\n');
});

console.log('\n' + '='.repeat(60));
console.log('  DESINSTALANDO SERVICIO DE WINDOWS');
console.log('='.repeat(60) + '\n');

console.log('🗑️  Desinstalando "Farmatotal Sync ERP"...\n');

svc.uninstall();
