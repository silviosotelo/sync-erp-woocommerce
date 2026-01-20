# Farmatotal Sync ERP v2.0 - Guía de Producción

Sistema de sincronización bidireccional ERP ↔ WooCommerce con cola de reintentos, dashboard en tiempo real, notificaciones WhatsApp y reportes automáticos.

## Características v2.0

- **Cola SQLite con reintentos**: Sistema de cola persistente con 3 reintentos automáticos
- **Transacciones MySQL**: Integridad de datos garantizada
- **Dashboard en tiempo real**: Monitoreo con Socket.io y Chart.js
- **Validación robusta**: Pre-procesamiento de datos antes de sincronizar
- **Notificaciones WhatsApp**: Alertas automáticas por Baileys
- **Reportes diarios**: Generación automática con exportación CSV
- **API REST completa**: 10 endpoints documentados
- **Sistema de logs**: Winston con rotación diaria
- **Multi-plataforma**: Funciona en Windows, Linux y macOS

## Instalación Rápida

### Windows (Servicio)
```bash
npm install --production
cp .env.example .env
# Editar .env con tus credenciales
npm run install:windows
```

### Linux (systemd)
```bash
npm install --production
cp .env.example .env
# Editar .env con tus credenciales
sudo npm run install:linux
```

### PM2 (Cualquier plataforma)
```bash
npm install -g pm2
npm install --production
cp .env.example .env
# Editar .env con tus credenciales
npm run pm2:start
npm run pm2:save
```

Ver guía completa: [INSTALL-QUICKSTART.md](INSTALL-QUICKSTART.md)

## Arquitectura v2.0

```
┌─────────────────────────────────────────────────────────────┐
│                    API ERP (HTTPS)                          │
│            https://api.farmatotal.com.py/...                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ axios.get()
┌─────────────────────────────────────────────────────────────┐
│                  SyncService.js                             │
│  - fetchProductsFromERP()                                   │
│  - fetchStockFromERP()                                      │
│  - fetchDeletedProductsFromERP()                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ Validación
┌─────────────────────────────────────────────────────────────┐
│               QueueValidator.js                             │
│  - Valida estructura de datos                               │
│  - Detecta productos inválidos                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ Agregar a cola
┌─────────────────────────────────────────────────────────────┐
│                 SyncQueue.js (SQLite)                       │
│  Estados: pending → processing → completed/failed           │
│  - sync_queue (cola activa)                                 │
│  - sync_history (histórico)                                 │
│  - sync_errors (errores detallados)                         │
│  - sync_stats (estadísticas diarias)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ Procesar con reintentos
┌─────────────────────────────────────────────────────────────┐
│              QueueProcessor.js                              │
│  - Retry logic: 3 intentos con backoff exponencial          │
│  - MySQL transactions (BEGIN, COMMIT, ROLLBACK)             │
│  - Actualiza WooCommerce (productos, stock, precios)        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ Escribe en MySQL
┌─────────────────────────────────────────────────────────────┐
│            MySQL WooCommerce                                │
│  Tablas: wp_posts, wp_postmeta, wp_wc_product_meta_lookup  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Notificaciones                           │
│  - WhatsAppNotifier: Envía mensajes por Baileys             │
│  - DailyReportGenerator: Reportes automáticos a las 8 AM    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Web                            │
│  http://localhost:3001                                      │
│  - Socket.io para updates en tiempo real                    │
│  - Chart.js para gráficas de estadísticas                   │
│  - Visualización de cola, errores, progreso                 │
└─────────────────────────────────────────────────────────────┘
```

## Endpoints API

### Sincronización
- `POST /api/sync/start` - Iniciar sincronización manual
- `GET /api/sync/status` - Estado actual de sincronización
- `POST /api/sync/reindex` - Reindexar WooCommerce

### Cola
- `GET /api/queue/status` - Estado de la cola
- `GET /api/queue/pending` - Productos pendientes
- `GET /api/queue/failed` - Productos fallidos
- `POST /api/queue/retry/:artCodInt` - Reintentar producto

### Estadísticas
- `GET /api/stats` - Estadísticas generales
- `GET /api/stats/daily` - Estadísticas diarias
- `GET /api/stats/history/:days` - Histórico

### Errores
- `GET /api/errors/recent` - Errores recientes
- `GET /api/errors/breakdown` - Desglose por tipo

### Reportes
- `POST /api/reports/generate` - Generar reporte
- `GET /api/reports/list` - Listar reportes disponibles

### Salud
- `GET /health` - Health check

## Configuración

### Variables Críticas .env

```env
# ============ API DEL ERP ============
ERP_ENDPOINT=https://api.farmatotal.com.py/farma/next/ecommerce/
ERP_TIMEOUT=30000
ERP_RETRY_ATTEMPTS=3

# ============ MYSQL WOOCOMMERCE ============
MYSQL_HOST=srv1313.hstgr.io
MYSQL_PORT=3306
MYSQL_USER=tu_usuario
MYSQL_PASSWORD=tu_password_seguro
MYSQL_DATABASE=tu_base_datos
DB_PREFIX=wp_
MYSQL_CONNECT_TIMEOUT=60000
MYSQL_ACQUIRE_TIMEOUT=60000
MYSQL_TIMEOUT=60000

# ============ COLA Y REINTENTOS ============
MAX_RETRY_ATTEMPTS=3
PROCESSING_TIMEOUT_MS=30000
SQLITE_DB_PATH=./data/sync_queue.db

# ============ WHATSAPP (OPCIONAL) ============
WHATSAPP_ENABLED=false
WHATSAPP_RECIPIENT=+595981234567

# ============ REPORTES DIARIOS ============
DAILY_REPORT_ENABLED=true
DAILY_REPORT_TIME=08:00
REPORT_EMAIL=admin@farmatotal.com.py

# ============ SERVIDOR ============
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
```

## Comandos Útiles

### Desarrollo
```bash
npm start              # Iniciar en producción
npm run dev            # Iniciar con nodemon
npm run logs           # Ver logs en tiempo real
npm run logs:errors    # Ver errores en tiempo real
npm run status         # Health check
npm run dashboard      # Abrir dashboard
```

### PM2
```bash
npm run pm2:start      # Iniciar con PM2
npm run pm2:stop       # Detener
npm run pm2:restart    # Reiniciar
npm run pm2:reload     # Reload sin downtime
npm run pm2:logs       # Ver logs
npm run pm2:monit      # Monitor con métricas
npm run pm2:status     # Ver estado
npm run pm2:save       # Guardar configuración
```

### Servicios Windows/Linux
```bash
# Windows
npm run install:windows    # Instalar servicio
npm run uninstall:windows  # Desinstalar servicio

# Linux
npm run install:linux      # Instalar servicio systemd
npm run uninstall:linux    # Desinstalar servicio
```

### Mantenimiento
```bash
npm run verify         # Verificar sistema
npm run backup         # Crear backup
npm run restore        # Restaurar desde backup
npm run clean          # Limpiar archivos temporales
npm run clean:db       # Limpiar base de datos
npm run reset          # Reinstalar desde cero
```

## Monitoreo

### Logs
- **General**: `logs/YYYY-MM-DD.log`
- **Errores**: `logs/errors/YYYY-MM-DD-errors.log`
- **PM2**: `logs/pm2-*.log`
- **systemd**: `journalctl -u farmatotal-sync -f`

### Métricas Clave
- Uptime > 99.9%
- Memoria < 1.5 GB
- CPU promedio < 50%
- Productos en cola < 100
- Tasa de error < 1%
- Tiempo promedio de sincronización < 2s por producto

### Dashboard
```
http://localhost:3001
```

Muestra:
- Productos sincronizados hoy
- Tasa de éxito/error
- Cola en tiempo real
- Gráficos de los últimos 7 días
- Top errores
- Tiempo promedio de procesamiento

## Respaldos

### Automático
```bash
npm run backup
```

Respalda:
- Base de datos SQLite
- Archivo .env
- Logs recientes (últimos 7 días)
- Reportes (últimos 30 días)

Crea: `backups/sync-backup-YYYYMMDD-HHMMSS.tar.gz`

Limpieza: Elimina backups > 30 días automáticamente

### Restauración
```bash
npm run restore
```

Interactivo:
1. Selecciona backup de la lista
2. Confirma restauración
3. Crea backup de seguridad antes de restaurar
4. Reinicia servicio manualmente después

## Seguridad

- Credenciales en .env (nunca en código)
- .env con permisos 600
- API ERP sobre HTTPS
- Logs sin información sensible
- Transacciones MySQL para integridad
- Validación de entrada antes de procesar
- Rate limiting en API
- CORS configurado correctamente

## Performance

- Procesamiento paralelo de productos
- Conexiones MySQL con pool
- SQLite con modo WAL para concurrencia
- Índices en columnas críticas
- Compresión de respuestas HTTP
- Cache de configuración
- Timeouts configurables
- Retry logic con backoff exponencial

## Troubleshooting

### Servicio no inicia
1. Verificar logs: `npm run logs`
2. Probar inicio manual: `node server.js`
3. Verificar .env: `cat .env`
4. Verificar puertos: `netstat -tuln | grep 3001`

### Error de conexión MySQL
```bash
# Probar conexión
mysql -h MYSQL_HOST -u MYSQL_USER -p

# Verificar firewall
sudo ufw allow 3306
```

### Cola atascada
```bash
# Ver estado
curl http://localhost:3001/api/queue/status

# Resetear productos atascados (via dashboard)
# O manualmente en SQLite
sqlite3 data/sync_queue.db "UPDATE sync_queue SET status='pending' WHERE status='processing'"
```

### Memoria alta
- Verificar con `pm2 monit`
- Aumentar `max_memory_restart` en ecosystem.config.js
- Revisar logs de errores
- Considerar reducir `SYNC_BATCH_SIZE`

## Documentación Adicional

- [INSTALL-QUICKSTART.md](INSTALL-QUICKSTART.md) - Instalación rápida
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guía completa de despliegue
- [IMPORTANTE-LEER.md](IMPORTANTE-LEER.md) - Diferencias v1 vs v2
- [CHANGELOG-V2.md](CHANGELOG-V2.md) - Cambios en v2.0
- [PROYECTO-LIMPIO.md](PROYECTO-LIMPIO.md) - Limpieza realizada

## Soporte

- Email: admin@farmatotal.com.py
- Logs: `logs/errors/YYYY-MM-DD-errors.log`
- Dashboard: http://localhost:3001

## Licencia

MIT

---

**Versión**: 2.0.0
**Última actualización**: 2026-01-20
**Autor**: Farmatotal Team
