# 🔄 Sincronizador ERP → WooCommerce - Instalación Backend

## 📋 Requisitos del Sistema

- **Node.js**: >= 16.0.0
- **NPM**: >= 8.0.0  
- **MySQL**: >= 5.7 o MariaDB >= 10.2
- **RAM**: Mínimo 1GB, recomendado 2GB+
- **Disco**: Mínimo 500MB para logs y backups
- **OS**: Linux, Windows, macOS

## 🚀 Instalación Rápida

### 1. Clonar/Descargar el Proyecto

```bash
# Si usas Git
git clone https://github.com/tu-usuario/sync-erp-woocommerce.git
cd sync-erp-woocommerce

# O descargar y extraer el ZIP
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Base de Datos
DB_HOST=srv1313.hstgr.io
DB_USER=u377556581_vWMEZ
DB_PASSWORD=NJdPaC3A$j7DCzE&yU^P
DB_NAME=u377556581_OXkxK
DB_PREFIX=btw70

# API ERP
ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/
ERP_API_KEY=tu_api_key_aqui

# Servidor
PORT=3001
NODE_ENV=production

# Logs
LOG_LEVEL=INFO
LOG_MAX_SIZE=10mb
LOG_MAX_FILES=30

# Notificaciones (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_password

# SMS Twilio (Opcional)
TWILIO_SID=tu_twilio_sid
TWILIO_TOKEN=tu_twilio_token
TWILIO_PHONE=+1234567890

# Seguridad
JWT_SECRET=tu_jwt_secret_muy_seguro
API_RATE_LIMIT=100
```

### 4. Crear Estructura de Directorios

```bash
mkdir -p logs backups tmp dashboard
```

### 5. Inicializar Base de Datos

```bash
# Ejecutar solo la primera vez
node scripts/init-database.js
```

### 6. Probar Configuración

```bash
# Verificar conexión a BD y ERP
npm run test
```

## 🔧 Configuración Avanzada

### Configurar como Servicio del Sistema

#### Linux (systemd)

```bash
# Crear archivo de servicio
sudo nano /etc/systemd/system/sync-erp.service
```

Contenido del archivo:

```ini
[Unit]
Description=Sincronizador ERP WooCommerce
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/sync-erp-woocommerce
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Activar servicio
sudo systemctl daemon-reload
sudo systemctl enable sync-erp
sudo systemctl start sync-erp

# Verificar estado
sudo systemctl status sync-erp
```

#### Windows (PM2)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Crear archivo ecosystem
```

Crear `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'sync-erp-woocommerce',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

```bash
# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔌 Configurar Proxy Reverso (Nginx)

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar con nodemon (auto-reload)

# Producción  
npm start               # Iniciar servidor
npm run sync            # Ejecutar sincronización única

# Mantenimiento
npm run backup          # Crear backup completo
npm run restore         # Restaurar desde backup
npm run lint            # Verificar código
npm test               # Ejecutar pruebas

# Servicio del sistema
npm run install-service   # Instalar como servicio
npm run uninstall-service # Desinstalar servicio
```

## 🔧 Configuración del Cron Job

El sincronizador ya incluye cron automático cada 10 minutos. Para configuración manual:

```bash
# Editar crontab
crontab -e

# Agregar línea para sincronización cada 5 minutos
*/5 * * * * cd /path/to/sync-erp-woocommerce && node sync-enhanced.js

# Para sincronización cada hora
0 * * * * cd /path/to/sync-erp-woocommerce && node sync-enhanced.js
```

## 🚦 Verificar Instalación

### 1. Verificar Servicios

```bash
# Verificar que el servidor esté ejecutándose
curl http://localhost:3001/health

# Verificar dashboard
curl http://localhost:3001/

# Verificar API
curl http://localhost:3001/api/stats
```

### 2. Verificar Logs

```bash
# Ver logs en tiempo real
tail -f logs/$(date +%Y-%m-%d).log

# Ver estadísticas
cat logs/$(date +%Y-%m-%d).log | grep "Sincronización completa"
```

### 3. Verificar Base de Datos

```sql
-- Verificar tablas creadas
SHOW TABLES LIKE 'sync_%';

-- Ver estadísticas recientes
SELECT * FROM sync_statistics ORDER BY created_at DESC LIMIT 5;

-- Ver productos sincronizados recientemente
SELECT 
    p.post_title,
    pm.meta_value as cod_interno,
    pm2.meta_value as fecha_sync
FROM btw70_posts p
INNER JOIN btw70_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = 'cod_interno'
INNER JOIN btw70_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'fecha_sincronizacion'
WHERE p.post_type = 'product'
ORDER BY pm2.meta_value DESC
LIMIT 10;
```

## 🔒 Seguridad

### 1. Configurar Firewall

```bash
# Permitir solo puerto necesario
sudo ufw allow 3001/tcp
sudo ufw enable
```

### 2. Configurar HTTPS

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com
```

### 3. Configurar Variables Sensibles

```bash
# No commitear archivo .env
echo ".env" >> .gitignore

# Usar variables de entorno del sistema en producción
export DB_PASSWORD="password_super_seguro"
export JWT_SECRET="jwt_secret_muy_largo_y_seguro"
```

## 📈 Monitoreo

### Dashboard Web
- URL: `http://localhost:3001`
- Características:
  - ✅ Estadísticas en tiempo real
  - ✅ Logs visuales
  - ✅ Gestión de productos eliminados
  - ✅ Control manual de sincronización
  - ✅ Estado del sistema

### APIs de Monitoreo

```bash
# Health check
GET /health

# Estadísticas
GET /api/stats

# Logs del sistema
GET /api/logs

# Estado del sistema
GET /api/system/status
```

## 🔧 Troubleshooting

### Problema: Error de conexión a BD

```bash
# Verificar conexión MySQL
mysql -h srv1313.hstgr.io -u u377556581_vWMEZ -p

# Verificar variables de entorno
node -e "console.log(process.env.DB_HOST)"
```

### Problema: Cron no ejecuta

```bash
# Verificar proceso
ps aux | grep node

# Verificar logs de cron
grep CRON /var/log/syslog

# Verificar permisos
ls -la sync-enhanced.js
```

### Problema: Puerto en uso

```bash
# Verificar qué usa el puerto
sudo lsof -i :3001

# Cambiar puerto en .env
echo "PORT=3002" >> .env
```

### Problema: Memoria insuficiente

```bash
# Monitorear uso de memoria
node -e "setInterval(() => console.log(process.memoryUsage()), 5000)"

# Configurar límite en PM2
pm2 start app.js --max-memory-restart 512M
```

## 📞 Soporte

- **Logs**: `./logs/YYYY-MM-DD.log`
- **Backups**: `./backups/`
- **Configuración**: `.env`
- **Dashboard**: `http://localhost:3001`

---

## 🎯 Siguiente Paso: Plugin WooCommerce

Una vez completada la instalación del backend, continuar con la instalación del **Plugin de WooCommerce** para completar la sincronización bidireccional.

**¿Todo funcionando?** ✅ Proceder a instalar el plugin de WooCommerce.