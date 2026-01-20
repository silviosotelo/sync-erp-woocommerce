# Sincronizador ERP-WooCommerce v2.0

Sistema de sincronización profesional con:
- Sistema de colas SQLite
- Retry logic inteligente con transacciones
- Dashboard en tiempo real con gráficos
- Notificaciones WhatsApp estructuradas
- Reportes automáticos diarios
- API REST completa

## Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env
cp .env.example .env
# Edita .env con tus credenciales MySQL

# 3. Iniciar servidor
npm start

# 4. Abrir dashboard
open http://localhost:3001
```

---

## Nuevas Funcionalidades v2.0

### 1. Sistema de Colas con SQLite
- Base de datos SQLite local para tracking completo de sincronizaciones
- Estados: pending, processing, completed, failed
- Historial completo de batches y errores
- Estadísticas por día

### 2. Retry Logic Inteligente
- Reintentos automáticos con backoff exponencial (1s, 2s, 4s)
- Transacciones MySQL para garantizar integridad
- Máximo 3 intentos configurables
- Rollback automático en caso de error

### 3. Validación Robusta
- Validación pre-procesamiento de todos los productos
- Verificación de campos requeridos
- Validación de tipos de datos
- Detección de productos duplicados

### 4. Dashboard Avanzado
- Estadísticas en tiempo real con Socket.io
- Gráficos de sincronizaciones últimos 7 días
- Gráfico de distribución de estados
- Tabla de cola con filtros y paginación
- Lista de errores recientes
- Estimación de tiempo restante (ETA)

### 5. Notificaciones WhatsApp Mejoradas
- Mensajes estructurados y formateados
- Notificación de inicio de sync
- Notificación de sync completado con estadísticas
- Alertas de errores críticos
- Alerta de cola bloqueada
- Reporte diario automático

### 6. Reportes Automáticos
- Reporte diario a las 8 AM (configurable)
- Exportación a CSV
- Envío por WhatsApp
- Comparativa semanal
- Top 5 errores del día

### 7. API REST Completa
- 10 endpoints documentados
- WebSocket para updates en tiempo real
- Autenticación por API key (opcional)
- Respuestas JSON consistentes

## Instalación

1. Instalar dependencias nuevas:
```bash
npm install
```

Las nuevas dependencias incluyen:
- better-sqlite3: Base de datos SQLite
- socket.io: WebSocket para tiempo real
- winston-daily-rotate-file: Logs rotativos
- uuid: Generación de IDs únicos
- mysql2: Cliente MySQL mejorado

2. Crear directorios necesarios:
```bash
npm run prepare
```

Esto crea:
- data/ (SQLite database)
- reports/csv/
- reports/daily/
- logs/errors/

3. Configurar variables de entorno en `.env`:
```env
# Sistema v2
MAX_RETRY_ATTEMPTS=3
PROCESSING_TIMEOUT_MS=30000
SQLITE_DB_PATH=./data/sync_queue.db

# Notificaciones
NOTIFY_ON_START=true
NOTIFY_ON_COMPLETE=true
NOTIFY_ON_ERROR=true
ERROR_THRESHOLD_PERCENT=10

# Reportes
DAILY_REPORT_ENABLED=true
DAILY_REPORT_TIME=08:00

# Dashboard
DASHBOARD_URL=http://localhost:3001
REALTIME_UPDATES=true
```

## Uso

### Iniciar el servidor v2:
```bash
npm run start:v2
```

### Modo desarrollo con auto-reload:
```bash
npm run dev:v2
```

### Acceder al dashboard:
Abre en tu navegador: http://localhost:3001

## Estructura del Proyecto v2

```
sync-erp-woocommerce/
├── server-v2.js              # Servidor principal mejorado
├── src/
│   ├── database/
│   │   └── sqlite.js         # Conexión SQLite
│   ├── queue/
│   │   ├── SyncQueue.js      # Clase principal de cola
│   │   ├── QueueProcessor.js # Procesamiento con retry
│   │   └── QueueValidator.js # Validación de productos
│   ├── sync/
│   │   └── SyncService.js    # Servicio de sincronización
│   ├── notifications/
│   │   ├── WhatsAppNotifier.js
│   │   └── templates/        # Templates de mensajes
│   ├── reports/
│   │   ├── DailyReportGenerator.js
│   │   └── CSVExporter.js
│   ├── api/
│   │   ├── routes/           # Rutas de la API
│   │   └── controllers/      # Controladores
│   └── utils/
│       └── Logger.js         # Logger mejorado
├── public/
│   ├── dashboard-v2.html     # Dashboard mejorado
│   └── js/
│       └── dashboard-v2.js   # Lógica del dashboard
├── data/
│   └── sync_queue.db         # Base de datos SQLite
└── reports/
    ├── csv/                  # Reportes CSV
    └── daily/                # Reportes diarios
```

## API REST

### Endpoints de Sincronización
```
POST   /api/sync/start        # Iniciar sincronización
POST   /api/sync/reindex      # Reindexar productos
GET    /api/sync/status       # Estado actual
```

### Endpoints de Cola
```
GET    /api/queue/stats       # Estadísticas de cola
GET    /api/queue             # Lista de productos (paginado)
POST   /api/queue/retry-failed # Reintentar fallidos
POST   /api/queue/:sku/retry  # Reintentar uno
DELETE /api/queue/completed   # Limpiar completados
```

### Endpoints de Estadísticas
```
GET    /api/stats/today       # Estadísticas del día
GET    /api/stats/last-7-days # Últimos 7 días
GET    /api/stats/history     # Historial de batches
```

### Endpoints de Errores
```
GET    /api/errors/recent     # Errores recientes (24h)
POST   /api/errors/:id/resolve # Marcar como resuelto
```

### Endpoints de Reportes
```
POST   /api/reports/generate  # Generar reporte
GET    /api/reports/daily/:date # Obtener reporte
```

## Dashboard

### Características

1. **Tarjetas de Estadísticas**
   - En Cola (pending)
   - Procesando (processing)
   - Completados Hoy
   - Fallidos Hoy

2. **Gráficos**
   - Líneas: Sincronizaciones últimos 7 días
   - Dona: Distribución de estados

3. **Tabla de Cola**
   - Filtros por estado
   - Búsqueda por SKU
   - Paginación (20 items)
   - Acciones (Reintentar)

4. **Errores Recientes**
   - Últimas 24 horas
   - Tipo de error
   - Mensaje detallado
   - Acción "Resolver"

5. **Actualizaciones en Tiempo Real**
   - WebSocket (Socket.io)
   - Progreso de sincronización
   - ETA dinámico
   - Notificaciones visuales

## Notificaciones WhatsApp

### Mensajes Enviados

1. **Inicio de Sincronización**
```
🔄 SINCRONIZACIÓN INICIADA
━━━━━━━━━━━━━━━━━━━━
📦 Batch: #20260119-001
🕐 Inicio: 10:30:15
📊 Total productos: 500
```

2. **Sincronización Completada**
```
✅ SINCRONIZACIÓN COMPLETADA
━━━━━━━━━━━━━━━━━━━━
📦 Batch: #20260119-001
🕐 Inicio: 10:30:15
🕑 Fin: 10:32:47
⏱️ Duración: 2m 32s

📊 RESULTADOS:
✅ Exitosos: 485/500 (97%)
❌ Fallidos: 15/500 (3%)

🎯 PROMEDIO:
⚡ 305ms por producto

❌ ERRORES:
- Timeout MySQL: 8
- SKU inválido: 5
```

3. **Reporte Diario (8 AM)**
```
📊 REPORTE DIARIO - FARMATOTAL SYNC
Fecha: 19/01/2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 SINCRONIZACIONES DEL DÍA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total de batches: 12
Total productos procesados: 2,847
✅ Exitosos: 2,791 (98.03%)
❌ Fallidos: 56 (1.97%)
```

## Tareas Programadas

### Verificación de Cola Bloqueada
- Cada 10 minutos
- Detecta productos atascados en "processing"
- Resetea después de 10 minutos
- Envía alerta por WhatsApp

### Limpieza Automática
- Cada día a las 2 AM
- Elimina productos completados > 7 días
- Mantiene base de datos limpia

### Reporte Diario
- Configurable (default: 8 AM)
- Genera reporte del día anterior
- Envía por WhatsApp
- Guarda CSV en reports/daily/

## Solución de Problemas

### Error: "SQLITE_CANTOPEN: unable to open database file"
Solución: Crear directorio data/
```bash
mkdir -p data
```

### Error: "Cannot find module 'better-sqlite3'"
Solución: Reinstalar dependencias
```bash
npm install
```

### Dashboard no actualiza en tiempo real
Verificar:
1. Puerto 3001 abierto
2. WebSocket habilitado en firewall
3. Navegador soporta WebSocket

### Productos no se reintentan automáticamente
Verificar:
1. MAX_RETRY_ATTEMPTS en .env
2. Estado en base de datos SQLite
3. Logs en logs/errors/

## Migraciones desde v1

Si vienes de la versión anterior:

1. Instalar nuevas dependencias:
```bash
npm install
```

2. Crear directorios nuevos:
```bash
npm run prepare
```

3. Actualizar .env con variables v2

4. Iniciar servidor v2:
```bash
npm run start:v2
```

5. Importar datos existentes (opcional):
```bash
# Ejecutar script de migración (si existe)
node scripts/migrate-to-v2.js
```

## Configuración Avanzada

### Ajustar Retry Logic
```env
MAX_RETRY_ATTEMPTS=5          # Más reintentos
PROCESSING_TIMEOUT_MS=60000   # Más tiempo por producto
```

### Desactivar Notificaciones
```env
NOTIFY_ON_START=false
NOTIFY_ON_COMPLETE=false
NOTIFY_ON_ERROR=true          # Solo errores
```

### Cambiar Horario de Reporte
```env
DAILY_REPORT_TIME=07:00       # 7 AM
```

### Ajustar Umbral de Errores
```env
ERROR_THRESHOLD_PERCENT=5     # Alerta si > 5% fallan
```

## Performance

### Optimizaciones Implementadas

1. **Transacciones MySQL**
   - Operaciones atómicas
   - Rollback automático en errores
   - Integridad garantizada

2. **Pool de Conexiones**
   - 10 conexiones simultáneas
   - Reutilización eficiente
   - Timeout configurable

3. **SQLite WAL Mode**
   - Write-Ahead Logging
   - Lecturas concurrentes
   - Mejor performance

4. **Batching Inteligente**
   - Inserts por lotes
   - Reducción de queries
   - Menor latencia

## Seguridad

### Implementado

1. Validación de entrada
2. Queries parametrizadas
3. Transacciones ACID
4. Logging de errores
5. Sanitización de datos

### Recomendaciones

1. Cambiar credenciales default
2. Usar HTTPS en producción
3. Configurar firewall
4. Backups regulares
5. Monitorear logs de errores

## Soporte

Para problemas o preguntas:
- Email: admin@farmatotal.com.py
- Logs: logs/errors/YYYY-MM-DD-errors.log
- Dashboard: http://localhost:3001

## Changelog

### v2.0.0 (2026-01-19)
- Sistema de colas con SQLite
- Retry logic con backoff exponencial
- Transacciones MySQL
- Validación robusta
- Dashboard avanzado con gráficos
- Socket.io para tiempo real
- Notificaciones WhatsApp mejoradas
- Reportes automáticos diarios
- API REST completa
- Logs rotativos por fecha
- Tareas programadas
- Estimación de tiempo (ETA)

### v1.0.0
- Sincronización básica
- Dashboard simple
- Notificaciones básicas

## Licencia

MIT
