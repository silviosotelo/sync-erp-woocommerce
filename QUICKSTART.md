# Guía Rápida - Sincronizador v2.0

## Instalación en 5 Minutos

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar .env
Edita `.env` y configura como mínimo:
```env
# MySQL WooCommerce
MYSQL_HOST=tu_host
MYSQL_USER=tu_usuario
MYSQL_PASSWORD=tu_contraseña
MYSQL_DATABASE=tu_base_datos
DB_PREFIX=wp

# ERP (si es diferente)
ERP_HOST=tu_host_erp
ERP_DATABASE=tu_base_datos_erp

# WhatsApp (opcional pero recomendado)
WHATSAPP_ENABLED=true
WHATSAPP_NUMBER=+595981234567
```

### 3. Iniciar Servidor
```bash
npm run start:v2
```

### 4. Abrir Dashboard
http://localhost:3001

¡Listo! El sistema está funcionando.

## Uso Diario

### Iniciar Sincronización Manual
1. Abre el dashboard: http://localhost:3001
2. Clic en botón "Iniciar Sync"
3. Observa el progreso en tiempo real

### Reintentar Productos Fallidos
1. En el dashboard, ve a la sección "Cola de Sincronización"
2. Filtra por estado "Fallidos"
3. Clic en "Reintentar Fallidos"

### Ver Estadísticas
- Tarjetas superiores muestran totales en tiempo real
- Gráfico de líneas: últimos 7 días
- Gráfico de dona: distribución actual

### Revisar Errores
- Sección "Errores Recientes (24h)" al final
- Muestra tipo, mensaje y fecha
- Clic en "Resolver" para marcar como solucionado

## Comandos Útiles

```bash
# Iniciar servidor v2
npm run start:v2

# Modo desarrollo (auto-reload)
npm run dev:v2

# Ver estado
npm run status

# Ver logs
npm run logs

# Limpiar datos antiguos
curl -X DELETE http://localhost:3001/api/queue/completed?days=7
```

## Endpoints API Importantes

### Ver estadísticas
```bash
curl http://localhost:3001/api/queue/stats
```

### Iniciar sync
```bash
curl -X POST http://localhost:3001/api/sync/start
```

### Reintentar fallidos
```bash
curl -X POST http://localhost:3001/api/queue/retry-failed
```

### Ver errores recientes
```bash
curl http://localhost:3001/api/errors/recent
```

## Notificaciones WhatsApp

### Primera Vez
1. Asegúrate que `WHATSAPP_ENABLED=true` en `.env`
2. Inicia el servidor: `npm run start:v2`
3. Escanea el QR code que aparece en la terminal
4. ¡Listo! Recibirás notificaciones

### Mensajes que Recibirás
- Inicio de sincronización
- Sincronización completada (con stats)
- Errores críticos (> 10% fallos)
- Cola bloqueada (productos atascados)
- Reporte diario (8 AM)

## Problemas Comunes

### "Cannot find module 'better-sqlite3'"
```bash
npm install
```

### "SQLITE_CANTOPEN"
```bash
mkdir -p data
npm run start:v2
```

### Dashboard no carga
Verifica que el puerto 3001 esté libre:
```bash
lsof -i :3001
```

### WhatsApp no conecta
1. Elimina carpeta `auth_info_baileys`
2. Reinicia servidor
3. Escanea QR nuevamente

## Reporte Diario

### Configuración
En `.env`:
```env
DAILY_REPORT_ENABLED=true
DAILY_REPORT_TIME=08:00  # 8 AM
```

### Generar Reporte Manual
```bash
curl -X POST http://localhost:3001/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{"format": "csv"}'
```

### Ver Reporte de Ayer
```bash
curl http://localhost:3001/api/reports/daily/2026-01-18
```

## Monitoreo

### Health Check
```bash
curl http://localhost:3001/health
```

Respuesta:
```json
{
  "status": "ok",
  "timestamp": "2026-01-19T10:30:00.000Z",
  "queue_stats": {
    "pending": 25,
    "processing": 2,
    "completed": 1450,
    "failed": 15
  }
}
```

### Ver Logs en Tiempo Real
```bash
tail -f logs/$(date +%Y-%m-%d).log
```

### Ver Solo Errores
```bash
tail -f logs/errors/$(date +%Y-%m-%d)-errors.log
```

## Mejores Prácticas

### 1. Revisa el Dashboard Diariamente
- Verifica tasa de éxito (debería ser > 95%)
- Revisa productos fallidos
- Reintenta los que tengan errores temporales

### 2. Limpia la Cola Semanalmente
```bash
curl -X DELETE http://localhost:3001/api/queue/completed?days=7
```

### 3. Monitorea Errores Críticos
Si ves muchos errores del mismo tipo:
1. Revisa logs detallados
2. Verifica conexión a MySQL
3. Revisa formato de datos del ERP

### 4. Backups de SQLite
```bash
cp data/sync_queue.db data/sync_queue.db.backup
```

### 5. Actualiza Regularmente
```bash
git pull
npm install
npm run start:v2
```

## Configuración Producción

### Variables Importantes
```env
NODE_ENV=production
LOG_LEVEL=INFO
MAX_RETRY_ATTEMPTS=3
PROCESSING_TIMEOUT_MS=30000
DAILY_REPORT_ENABLED=true
ERROR_THRESHOLD_PERCENT=10
```

### Usar PM2 (Recomendado)
```bash
npm install -g pm2
pm2 start server-v2.js --name "sync-v2"
pm2 save
pm2 startup
```

### Logs con PM2
```bash
pm2 logs sync-v2
pm2 logs sync-v2 --err  # Solo errores
```

## Siguiente Nivel

### Integrar con CI/CD
```yaml
# .github/workflows/deploy.yml
- name: Deploy Sync v2
  run: |
    npm install
    npm run start:v2
```

### Monitoreo Externo
- Usar endpoint `/health` para checks
- Configurar alertas si health != "ok"
- Monitorear tasa de fallos

### Optimización
- Ajusta `SYNC_BATCH_SIZE` según volumen
- Reduce `MAX_RETRY_ATTEMPTS` si productos fallan consistentemente
- Aumenta `PROCESSING_TIMEOUT_MS` si hay muchos timeouts

## Soporte

- Dashboard: http://localhost:3001
- Logs: logs/YYYY-MM-DD.log
- Errores: logs/errors/YYYY-MM-DD-errors.log
- Email: admin@farmatotal.com.py

## Comandos de Referencia Rápida

```bash
# Instalación
npm install

# Iniciar
npm run start:v2

# Dashboard
open http://localhost:3001

# Stats
curl http://localhost:3001/api/queue/stats | jq

# Sync manual
curl -X POST http://localhost:3001/api/sync/start

# Reintentar fallidos
curl -X POST http://localhost:3001/api/queue/retry-failed

# Ver errores
curl http://localhost:3001/api/errors/recent | jq

# Limpiar completados
curl -X DELETE http://localhost:3001/api/queue/completed?days=7

# Logs
tail -f logs/$(date +%Y-%m-%d).log

# Health
curl http://localhost:3001/health | jq
```

¡Éxito con tu sincronizador v2! 🚀
