# Guía de Despliegue en Producción - Farmatotal Sync v2.0

Esta guía explica cómo instalar y configurar el sincronizador ERP en producción para Windows, Linux y usando PM2.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración Inicial](#configuración-inicial)
3. [Instalación en Windows (Servicio)](#instalación-en-windows-servicio)
4. [Instalación en Linux (systemd)](#instalación-en-linux-systemd)
5. [Instalación con PM2](#instalación-con-pm2)
6. [Verificación del Sistema](#verificación-del-sistema)
7. [Comandos Útiles](#comandos-útiles)
8. [Troubleshooting](#troubleshooting)
9. [Respaldos y Mantenimiento](#respaldos-y-mantenimiento)

---

## Requisitos Previos

### Sistema Operativo
- **Windows**: Windows Server 2016+ o Windows 10+
- **Linux**: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+

### Software Requerido
- **Node.js**: v16.0.0 o superior (recomendado v18 LTS)
- **npm**: v8.0.0 o superior
- **MySQL**: 5.7+ o MariaDB 10.3+ (acceso remoto)
- **Git**: Para clonar el repositorio (opcional)

### Recursos del Servidor
- **RAM mínima**: 2 GB (recomendado 4 GB)
- **Disco**: 10 GB libres (para logs, respaldos, base de datos SQLite)
- **CPU**: 2 cores mínimo
- **Red**: Conexión estable a Internet y acceso a MySQL

### Puertos
- **3001**: Dashboard y API REST (configurable en .env)
- **3306**: MySQL (o el puerto configurado)

---

## Configuración Inicial

### 1. Clonar o Descargar el Proyecto

```bash
# Opción A: Clonar con Git
git clone https://github.com/tu-usuario/sync-erp-woocommerce.git
cd sync-erp-woocommerce

# Opción B: Descargar ZIP y extraer
# Luego navegar al directorio
cd sync-erp-woocommerce
```

### 2. Instalar Dependencias

```bash
npm install --production
```

### 3. Configurar Variables de Entorno

```bash
# Copiar el ejemplo
cp .env.example .env

# Editar con tu editor favorito
nano .env    # Linux
notepad .env # Windows
```

**Variables críticas a configurar:**

```env
# API del ERP
ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/

# MySQL WooCommerce
MYSQL_HOST=tu_servidor_mysql.com
MYSQL_USER=tu_usuario
MYSQL_PASSWORD=tu_password_seguro
MYSQL_DATABASE=tu_base_datos
DB_PREFIX=wp_

# WhatsApp (opcional)
WHATSAPP_ENABLED=false
WHATSAPP_RECIPIENT=+595981234567
```

### 4. Verificar Conectividad

```bash
# Probar conexión MySQL
mysql -h MYSQL_HOST -u MYSQL_USER -pMYSQL_PASSWORD -e "SELECT 1"

# Probar endpoint ERP (con curl)
curl https://api.farmatotal.com.py/farma/next/ecommerce/producto
```

### 5. Crear Directorios Necesarios

```bash
npm run prepare
# O manualmente:
mkdir -p logs/errors data backups reports/csv reports/daily
```

---

## Instalación en Windows (Servicio)

### Opción 1: Instalación Automática

```bash
npm run install:windows
```

Este script:
- Instala el servicio de Windows "Farmatotal Sync ERP"
- Lo configura para inicio automático
- Inicia el servicio inmediatamente

### Opción 2: Instalación Manual

```bash
# 1. Instalar dependencias de Windows
npm install node-windows --save-optional

# 2. Ejecutar script de instalación
node scripts/install-service-windows.js
```

### Verificar Instalación

1. Abrir **Administrador de Servicios** (`services.msc`)
2. Buscar "Farmatotal Sync ERP"
3. Verificar que el estado sea "En ejecución"
4. Configurar inicio automático (si no lo está)

### Desinstalar Servicio Windows

```bash
npm run uninstall:windows
# O manualmente:
node scripts/uninstall-service-windows.js
```

### Logs del Servicio Windows

```bash
# Ver logs de aplicación
type logs\2026-XX-XX.log

# Ver errores
type logs\errors\2026-XX-XX-errors.log
```

---

## Instalación en Linux (systemd)

### Opción 1: Instalación Automática

```bash
# Dar permisos de ejecución
chmod +x scripts/install-service-linux.sh

# Instalar (requiere sudo)
sudo bash scripts/install-service-linux.sh
```

El script te preguntará:
- Directorio de instalación (default: `/opt/sync-erp-woocommerce`)
- Confirmación antes de copiar archivos

### Opción 2: Instalación Manual

```bash
# 1. Copiar archivos al directorio de producción
sudo mkdir -p /opt/sync-erp-woocommerce
sudo cp -r . /opt/sync-erp-woocommerce/
cd /opt/sync-erp-woocommerce

# 2. Instalar dependencias
sudo npm install --production

# 3. Crear directorios
sudo mkdir -p logs/errors data backups reports/csv reports/daily

# 4. Configurar permisos
sudo chown -R www-data:www-data /opt/sync-erp-woocommerce
sudo chmod 600 /opt/sync-erp-woocommerce/.env

# 5. Copiar archivo de servicio systemd
sudo cp scripts/farmatotal-sync.service /etc/systemd/system/

# 6. Editar rutas en el archivo (si es diferente a /opt)
sudo nano /etc/systemd/system/farmatotal-sync.service

# 7. Recargar systemd
sudo systemctl daemon-reload

# 8. Habilitar servicio
sudo systemctl enable farmatotal-sync.service

# 9. Iniciar servicio
sudo systemctl start farmatotal-sync.service
```

### Comandos systemd

```bash
# Ver estado
sudo systemctl status farmatotal-sync

# Iniciar
sudo systemctl start farmatotal-sync

# Detener
sudo systemctl stop farmatotal-sync

# Reiniciar
sudo systemctl restart farmatotal-sync

# Ver logs en tiempo real
sudo journalctl -u farmatotal-sync -f

# Ver últimas 100 líneas
sudo journalctl -u farmatotal-sync -n 100

# Ver logs desde hoy
sudo journalctl -u farmatotal-sync --since today
```

### Desinstalar Servicio Linux

```bash
# Dar permisos de ejecución
chmod +x scripts/uninstall-service-linux.sh

# Desinstalar
sudo bash scripts/uninstall-service-linux.sh
```

---

## Instalación con PM2

PM2 es la opción más flexible y funciona en Windows, Linux y macOS.

### Instalación de PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Verificar instalación
pm2 --version
```

### Opción 1: Usar Comandos npm

```bash
# Iniciar
npm run pm2:start

# Detener
npm run pm2:stop

# Reiniciar
npm run pm2:restart

# Ver logs
npm run pm2:logs

# Ver estado
pm2 status
```

### Opción 2: Comandos PM2 Directos

```bash
# Iniciar con archivo de configuración
pm2 start ecosystem.config.js

# Iniciar solo en producción
pm2 start ecosystem.config.js --env production

# Ver lista de procesos
pm2 list

# Ver logs en tiempo real
pm2 logs farmatotal-sync

# Ver logs de errores
pm2 logs farmatotal-sync --err

# Ver dashboard con métricas
pm2 monit

# Reiniciar
pm2 restart farmatotal-sync

# Detener
pm2 stop farmatotal-sync

# Eliminar proceso
pm2 delete farmatotal-sync

# Ver información detallada
pm2 show farmatotal-sync
```

### Configurar Inicio Automático con PM2

#### Windows

```bash
# Instalar PM2 como servicio de Windows
npm install -g pm2-windows-service
pm2-service-install

# Configurar nombre del servicio
pm2-service-install -n "PM2 Farmatotal"

# Guardar lista de procesos actual
pm2 save

# El servicio se inicia automáticamente con Windows
```

#### Linux

```bash
# Guardar lista de procesos
pm2 save

# Generar script de inicio
pm2 startup

# Ejecutar el comando que te muestra PM2 (algo como):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u usuario --hp /home/usuario

# Para desactivar:
pm2 unstartup systemd
```

### Actualizar Aplicación con PM2

```bash
# 1. Detener aplicación
pm2 stop farmatotal-sync

# 2. Hacer pull de cambios (si usas Git)
git pull origin main

# 3. Instalar dependencias
npm install --production

# 4. Reiniciar sin downtime
pm2 reload farmatotal-sync

# O con restart normal
pm2 restart farmatotal-sync
```

---

## Verificación del Sistema

### Script de Verificación Automática

```bash
# Dar permisos (Linux/macOS)
chmod +x scripts/verify-production.sh

# Ejecutar verificación
bash scripts/verify-production.sh
```

Este script verifica:
- Node.js y npm instalados
- Archivo .env configurado
- Dependencias instaladas
- Directorios creados
- Permisos de escritura
- Conectividad MySQL
- Servicio corriendo
- Endpoint HTTP respondiendo
- Logs recientes

### Verificación Manual

```bash
# 1. Verificar proceso corriendo
# Windows
tasklist | findstr node

# Linux
ps aux | grep node

# 2. Verificar puerto
# Windows
netstat -ano | findstr :3001

# Linux
netstat -tuln | grep 3001
# O con lsof
lsof -i :3001

# 3. Probar endpoint
curl http://localhost:3001/health

# 4. Ver logs recientes
# Linux
tail -f logs/$(date +%Y-%m-%d).log

# Windows
powershell Get-Content logs\$(Get-Date -Format yyyy-MM-dd).log -Tail 50 -Wait
```

---

## Comandos Útiles

### Ver Dashboard

```
http://localhost:3001
http://tu-servidor.com:3001
```

### Sincronización Manual

```bash
# Via curl
curl -X POST http://localhost:3001/api/sync/start

# Via navegador
# Ir al dashboard y hacer clic en "Iniciar Sincronización"
```

### Ver Estadísticas

```bash
curl http://localhost:3001/api/stats
```

### Ver Cola

```bash
curl http://localhost:3001/api/queue/status
```

### Ver Errores

```bash
curl http://localhost:3001/api/errors/recent
```

---

## Troubleshooting

### El servicio no inicia

1. **Verificar logs:**
   ```bash
   # Windows
   type logs\2026-XX-XX.log

   # Linux
   sudo journalctl -u farmatotal-sync -n 50
   ```

2. **Verificar .env:**
   ```bash
   cat .env | grep -v "^#" | grep -v "^$"
   ```

3. **Probar inicio manual:**
   ```bash
   NODE_ENV=production node server.js
   ```

### Error de conexión MySQL

```bash
# Verificar credenciales
mysql -h MYSQL_HOST -u MYSQL_USER -p

# Verificar firewall (Linux)
sudo ufw status
sudo ufw allow from IP_SERVIDOR to any port 3306

# Ver logs de MySQL
sudo tail -f /var/log/mysql/error.log
```

### Puerto 3001 ya en uso

```bash
# Windows - Ver qué proceso usa el puerto
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux - Ver y matar proceso
lsof -ti:3001
kill -9 $(lsof -ti:3001)

# O cambiar puerto en .env
PORT=3002
```

### Permisos insuficientes (Linux)

```bash
# Dar permisos correctos
sudo chown -R www-data:www-data /opt/sync-erp-woocommerce
sudo chmod -R 755 /opt/sync-erp-woocommerce
sudo chmod 600 /opt/sync-erp-woocommerce/.env
```

### Servicio se reinicia constantemente

1. Ver logs de errores
2. Verificar memoria disponible: `free -h`
3. Verificar espacio en disco: `df -h`
4. Aumentar `max_memory_restart` en ecosystem.config.js
5. Verificar conectividad a MySQL y API ERP

---

## Respaldos y Mantenimiento

### Respaldos Automáticos

El sistema genera respaldos automáticos en:
- `backups/` - Respaldos de base de datos SQLite
- `reports/` - Reportes diarios en CSV

### Respaldo Manual

```bash
# Respaldar todo
npm run backup

# O manualmente
cp -r data/ backups/data-$(date +%Y%m%d-%H%M%S)/
cp -r logs/ backups/logs-$(date +%Y%m%d-%H%M%S)/
```

### Limpieza de Logs Antiguos

```bash
# Automático (ejecuta cron de limpieza)
npm run clean

# Manual - eliminar logs mayores a 30 días
find logs/ -name "*.log" -mtime +30 -delete
```

### Rotación de Logs

Winston ya configura rotación automática de logs:
- Logs diarios: `logs/YYYY-MM-DD.log`
- Errores: `logs/errors/YYYY-MM-DD-errors.log`
- Se mantienen últimos 14 días por defecto

### Actualización de la Aplicación

```bash
# 1. Detener servicio
# Windows (servicio)
sc stop "Farmatotal Sync ERP"

# Linux (systemd)
sudo systemctl stop farmatotal-sync

# PM2
pm2 stop farmatotal-sync

# 2. Respaldar
cp -r . ../backup-sync-$(date +%Y%m%d)

# 3. Actualizar código
git pull origin main
# O descargar nueva versión

# 4. Instalar dependencias
npm install --production

# 5. Verificar .env (si hay nuevas variables)
diff .env .env.example

# 6. Reiniciar servicio
# Windows
sc start "Farmatotal Sync ERP"

# Linux
sudo systemctl start farmatotal-sync

# PM2
pm2 restart farmatotal-sync
```

---

## Monitoreo de Producción

### Métricas Clave

1. **Uptime**: El servicio debe estar corriendo 24/7
2. **Memoria**: No exceder 1.5 GB (si excede, hay memory leak)
3. **CPU**: Promedio < 50% (picos durante sincronización son normales)
4. **Logs de Error**: Revisar diariamente `logs/errors/`
5. **Queue**: No debe haber productos atascados en "processing"
6. **Sincronizaciones**: Verificar que completen exitosamente

### Alertas Recomendadas

- Servicio caído por más de 5 minutos
- Más de 10 errores en una hora
- Cola con más de 100 productos pendientes por más de 30 minutos
- Uso de memoria > 1.8 GB
- Sincronización fallida 3 veces consecutivas

### Health Check Endpoint

```bash
# Verificar salud del servicio
curl http://localhost:3001/health

# Respuesta esperada:
# {"status":"ok","timestamp":"2026-01-20T00:00:00.000Z"}
```

---

## Contacto y Soporte

Para problemas o consultas:
- Email: admin@farmatotal.com.py
- Logs: `logs/errors/YYYY-MM-DD-errors.log`
- Dashboard: `http://localhost:3001`

---

**Versión**: 2.0.0
**Última actualización**: 2026-01-20
