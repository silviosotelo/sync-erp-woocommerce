/**
 * ecosystem.config.js
 * Configuración de PM2 para el Sincronizador ERP
 */

module.exports = {
    apps: [{
      // Información básica de la aplicación
      name: 'sync-erp-woocommerce',
      script: './app.js',
      
      // Configuración de ejecución
      instances: 1,
      exec_mode: 'fork',
      
      // Configuración de memoria y reinicio
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Configuración de monitoreo
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'backups',
        'tmp',
        '.git'
      ],
      
      // Variables de entorno
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        TZ: 'America/Asuncion'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        LOG_LEVEL: 'DEBUG'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001
      },
      
      // Configuración de logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Configuración de reinicio automático
      autorestart: true,
      
      // Configuración de cron (opcional)
      cron_restart: '0 2 * * *', // Reiniciar cada día a las 2 AM
      
      // Configuración adicional
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Scripts de lifecycle
      post_update: ['npm install', 'echo "Aplicación actualizada"'],
      
      // Configuración de cluster (si se necesita en el futuro)
      instance_var: 'INSTANCE_ID',
      
      // Source map support
      source_map_support: true,
      
      // Configuración de interpretador
      interpreter: 'node',
      interpreter_args: '--max_old_space_size=1024'
    }],
    
    // Configuración de deployment (opcional)
    deploy: {
      production: {
        user: 'administrador',
        host: 'localhost',
        ref: 'origin/main',
        repo: 'https://github.com/tu-usuario/sync-erp-woocommerce.git',
        path: '/var/www/sync-erp',
        'pre-deploy-local': '',
        'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
        'pre-setup': ''
      },
      
      development: {
        user: 'dev',
        host: 'localhost',
        ref: 'origin/develop',
        repo: 'https://github.com/tu-usuario/sync-erp-woocommerce.git',
        path: '/var/www/sync-erp-dev',
        'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development'
      }
    }
  };