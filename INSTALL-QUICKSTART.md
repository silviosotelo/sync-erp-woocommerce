# Instalación Rápida en Producción

Guía rápida para poner en producción el sincronizador. Para detalles completos ver [DEPLOYMENT.md](DEPLOYMENT.md).

## Opciones de Instalación

### 1. Windows (Servicio)

```bash
# 1. Configurar .env
cp .env.example .env
notepad .env

# 2. Instalar dependencias
npm install --production

# 3. Instalar como servicio
npm run install:windows

# Listo! El servicio iniciará automáticamente con Windows
```

**Desinstalar:**
```bash
npm run uninstall:windows
```

---

### 2. Linux (systemd)

```bash
# 1. Configurar .env
cp .env.example .env
nano .env

# 2. Instalar dependencias
npm install --production

# 3. Instalar como servicio systemd
sudo npm run install:linux

# El servicio iniciará automáticamente con el sistema
```

**Comandos útiles:**
```bash
# Ver estado
sudo systemctl status farmatotal-sync

# Ver logs
sudo journalctl -u farmatotal-sync -f

# Reiniciar
sudo systemctl restart farmatotal-sync
```

**Desinstalar:**
```bash
sudo npm run uninstall:linux
```

---

### 3. PM2 (Windows, Linux, macOS)

```bash
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Configurar .env
cp .env.example .env
# Editar .env con tus credenciales

# 3. Instalar dependencias
npm install --production

# 4. Iniciar con PM2
npm run pm2:start

# 5. Guardar configuración
npm run pm2:save

# 6. Configurar inicio automático
pm2 startup
# Ejecutar el comando que te muestra PM2
```

**Comandos PM2:**
```bash
# Ver estado
npm run pm2:status

# Ver logs en tiempo real
npm run pm2:logs

# Reiniciar
npm run pm2:restart

# Detener
npm run pm2:stop

# Monitor con métricas
npm run pm2:monit
```

**Desinstalar:**
```bash
npm run pm2:delete
```

---

## Verificación

Después de instalar, verifica que todo funcione:

```bash
# Ejecutar script de verificación
npm run verify

# Verificar manualmente
curl http://localhost:3001/health

# Ver dashboard
http://localhost:3001
```

---

## Variables Críticas .env

Asegúrate de configurar estas variables:

```env
# API del ERP (OBLIGATORIO)
ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/

# MySQL WooCommerce (OBLIGATORIO)
MYSQL_HOST=tu_servidor_mysql.com
MYSQL_USER=tu_usuario
MYSQL_PASSWORD=tu_password
MYSQL_DATABASE=tu_base_datos
DB_PREFIX=wp_

# Puerto del servidor (opcional, default: 3001)
PORT=3001

# WhatsApp (opcional)
WHATSAPP_ENABLED=false
```

---

## Solución de Problemas Comunes

### No conecta a MySQL
```bash
# Verificar credenciales
mysql -h MYSQL_HOST -u MYSQL_USER -p

# Verificar firewall
# Linux: sudo ufw allow 3306
# Windows: Configurar en Firewall de Windows
```

### Puerto 3001 ocupado
```bash
# Cambiar puerto en .env
PORT=3002

# O matar proceso que usa el puerto
# Linux: kill -9 $(lsof -ti:3001)
# Windows: netstat -ano | findstr :3001 → taskkill /PID <PID> /F
```

### Servicio no inicia
```bash
# Ver logs de error
# Windows: type logs\YYYY-MM-DD.log
# Linux: tail -f logs/YYYY-MM-DD.log
# PM2: npm run pm2:logs

# Probar inicio manual
node server.js
```

---

## Dashboard y API

Una vez instalado, accede a:

- **Dashboard**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **API Docs**: Ver [DEPLOYMENT.md](DEPLOYMENT.md#comandos-útiles)

---

## Próximos Pasos

1. Configurar sincronización automática (cron ya está activo)
2. Configurar notificaciones WhatsApp (opcional)
3. Configurar respaldos automáticos
4. Monitorear logs: `logs/YYYY-MM-DD.log`

Para más detalles ver [DEPLOYMENT.md](DEPLOYMENT.md).
