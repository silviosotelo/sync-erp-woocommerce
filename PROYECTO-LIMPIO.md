# Proyecto Limpio - Solo v2.0

## Estructura Final

```
sync-erp-woocommerce/
├── server.js                    # Servidor principal v2
├── package.json                 # Dependencias y scripts
├── ecosystem.config.js          # Configuración PM2
├── .env                         # Configuración (no en Git)
├── .env.example                 # Template de configuración
│
├── src/                         # Código fuente modular
│   ├── database/
│   │   ├── sqlite.js           # SQLite para colas
│   │   └── mysql-connection.js # Conexión MySQL mejorada
│   ├── queue/
│   │   ├── SyncQueue.js        # Sistema de colas
│   │   ├── QueueProcessor.js   # Retry logic + transacciones
│   │   └── QueueValidator.js   # Validación
│   ├── sync/
│   │   └── SyncService.js      # Servicio principal
│   ├── notifications/
│   │   ├── WhatsAppNotifier.js
│   │   └── templates/
│   ├── reports/
│   │   ├── DailyReportGenerator.js
│   │   └── CSVExporter.js
│   ├── api/
│   │   ├── routes/
│   │   └── controllers/
│   └── utils/
│       └── Logger.js
│
├── public/                      # Frontend
│   ├── dashboard-v2.html       # Dashboard principal
│   └── js/
│       └── dashboard-v2.js     # Lógica cliente
│
├── scripts/                     # Scripts utilitarios
│   ├── backup.js
│   ├── restore.js
│   ├── health-check.js
│   └── init-database.js
│
├── plugin/                      # Plugin WordPress
│   ├── sync-erp-woocommerce.php
│   ├── includes/
│   └── assets/
│
├── data/                        # Base de datos local
│   └── sync_queue.db           # SQLite (auto-generado)
│
├── logs/                        # Logs rotativos
│   ├── YYYY-MM-DD.log
│   └── errors/
│       └── YYYY-MM-DD-errors.log
│
├── reports/                     # Reportes generados
│   ├── csv/
│   └── daily/
│
├── README.md                    # Documentación principal
├── QUICKSTART.md               # Guía rápida
├── IMPORTANTE-LEER.md          # Notas importantes
└── CHANGELOG-V2.md             # Historial de cambios
```

## Archivos Eliminados (v1)

Todo el código del sistema antiguo fue eliminado:
- ❌ app.js
- ❌ sync-enhanced.js
- ❌ start.js
- ❌ dashboard-server.js
- ❌ api-endpoints.js
- ❌ modules/
- ❌ dashboard/
- ❌ setup*.js
- ❌ install-service*.js
- ❌ troubleshoot.js
- ❌ test-sync.js

## Scripts Simplificados

Solo los esenciales:

```json
{
  "start": "node server.js",
  "dev": "nodemon server.js",
  "logs": "tail -f logs/$(date +%Y-%m-%d).log",
  "logs:errors": "tail -f logs/errors/$(date +%Y-%m-%d)-errors.log",
  "status": "curl -s http://localhost:3001/health",
  "dashboard": "open http://localhost:3001",
  "clean": "rm -rf logs/* backups/* tmp/* data/*.db",
  "pm2:start": "pm2 start server.js --name sync-erp",
  "pm2:logs": "pm2 logs sync-erp",
  "pm2:stop": "pm2 stop sync-erp"
}
```

## Configuración (.env)

Solo variables esenciales:

```env
# MySQL WooCommerce
MYSQL_HOST=tu_servidor.com
MYSQL_USER=tu_usuario
MYSQL_PASSWORD=tu_password
MYSQL_DATABASE=tu_bd

# ERP Database
ERP_HOST=tu_servidor_erp.com
ERP_DATABASE=tu_bd_erp

# Sistema v2
MAX_RETRY_ATTEMPTS=3
SQLITE_DB_PATH=./data/sync_queue.db

# WhatsApp
WHATSAPP_ENABLED=true
WHATSAPP_NUMBER=+595981234567

# Reportes
DAILY_REPORT_ENABLED=true
DAILY_REPORT_TIME=08:00
```

## Comandos Principales

```bash
# Desarrollo
npm start                # Iniciar servidor
npm run dev             # Con auto-reload
npm run logs            # Ver logs en tiempo real

# Monitoreo
npm run status          # Estado del servidor
npm run dashboard       # Abrir dashboard

# PM2 (Producción)
npm run pm2:start       # Iniciar con PM2
npm run pm2:logs        # Ver logs
npm run pm2:stop        # Detener

# Limpieza
npm run clean           # Limpiar logs/cache
npm run clean:db        # Limpiar base de datos SQLite
```

## Características v2

### 1. Sistema de Colas
- SQLite local
- 4 tablas: queue, history, errors, stats
- Tracking completo

### 2. Retry Logic
- 3 reintentos automáticos
- Backoff exponencial (1s, 2s, 4s)
- Transacciones MySQL

### 3. Dashboard
- Tiempo real con Socket.io
- Gráficos Chart.js
- Filtros y búsqueda
- Estadísticas detalladas

### 4. Notificaciones
- WhatsApp con templates
- Mensajes estructurados
- Reportes diarios

### 5. API REST
- 10 endpoints
- WebSocket
- JSON responses

## Dependencias Principales

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.6.1",
  "mysql": "^2.18.1",
  "mysql2": "^3.6.5",
  "better-sqlite3": "^9.2.2",
  "winston": "^3.11.0",
  "winston-daily-rotate-file": "^4.7.1",
  "node-cron": "^3.0.3",
  "@whiskeysockets/baileys": "^6.7.18",
  "uuid": "^9.0.1"
}
```

## Sin Código Basura

Proyecto limpio sin:
- ❌ Archivos obsoletos
- ❌ Código duplicado
- ❌ Scripts no utilizados
- ❌ Documentación desactualizada
- ❌ Dependencias innecesarias

Solo código v2 en producción.

## Siguiente Paso

Mejorar plugin de WordPress (próxima fase).

---

**Estado:** ✅ Limpio y funcional
**Versión:** 2.0.0
**Última actualización:** 2026-01-19
