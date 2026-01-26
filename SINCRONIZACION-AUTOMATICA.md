# Sincronización Automática - Documentación

## Cambios Implementados

### 1. Cron Job de Sincronización Automática

Se agregó un cron job que ejecuta la sincronización automáticamente según la configuración en `.env`.

**Ubicación:** `server.js` líneas 218-260

**Configuración:**
```env
AUTO_SYNC_ENABLED=true          # Habilita/deshabilita sincronización automática
SYNC_INTERVAL_MINUTES=10        # Intervalo en minutos (por defecto: 10)
```

**Funcionamiento:**
- Si `AUTO_SYNC_ENABLED=true`, el sistema sincroniza automáticamente cada X minutos
- Los resultados se envían en tiempo real al dashboard vía Socket.IO
- Los logs se guardan automáticamente
- No requiere interacción manual

**Ejemplo de log:**
```
[INFO] Iniciando sincronización automática (cada 10 minutos)...
[INFO] Sincronización automática completada
       productos: 150, exitosos: 148, fallidos: 2, duración: 45s
```

---

### 2. Dashboard Mejorado

El dashboard ahora muestra información completa del sistema en tiempo real.

**Nuevas secciones:**

#### A. Estado de Conexiones
- **MySQL WooCommerce:** Muestra si la conexión está activa o en modo solo lectura
- **API ERP:** Verifica que el endpoint sea accesible
- **Sincronización Automática:** Indica si está habilitada y cuándo será la próxima ejecución

#### B. Panel de Configuración
Muestra toda la configuración actual del sistema:
- Estado de sincronización automática (HABILITADA/DESHABILITADA)
- Intervalo de sincronización
- Tamaño de lote
- Número de reintentos
- Timeout
- Características habilitadas (Multi-Inventario, Stock Sync, Reportes, etc.)

#### C. Logs en Tiempo Real
- Muestra eventos del sistema en tiempo real
- Últimos 100 eventos
- Código de colores (verde=éxito, rojo=error, amarillo=advertencia, azul=info)
- Incluye timestamp de cada evento
- Botón para limpiar logs

#### D. Estadísticas Actualizadas
Las estadísticas se actualizan automáticamente cada 5 segundos:
- En Cola
- Procesando
- Completados
- Con Errores

---

### 3. Nuevos Endpoints API

#### `/api/system/config`
Retorna la configuración completa del sistema.

**Respuesta:**
```json
{
  "version": "2.0.0",
  "environment": "production",
  "sync": {
    "autoSyncEnabled": true,
    "intervalMinutes": 10,
    "batchSize": 100,
    "maxRetries": 3,
    "timeoutSeconds": 300
  },
  "erp": {
    "endpoint": "https://api.farmatotal.com.py/farma/next/ecommerce/",
    "timeout": 30000,
    "retryAttempts": 3
  },
  "database": {
    "host": "srv1724.hstgr.io",
    "database": "u377556581_OXkxK",
    "prefix": "btw70",
    "connected": true
  },
  "features": {
    "multiInventory": false,
    "stockSync": false,
    "dailyReport": true,
    "realtimeUpdates": true,
    "whatsapp": false
  }
}
```

#### `/api/system/status`
Retorna el estado actual del sistema.

**Respuesta:**
```json
{
  "timestamp": "2026-01-26T17:30:00.000Z",
  "uptime": 3600,
  "memory": {...},
  "connections": {
    "mysql": {
      "connected": true,
      "message": "Conectado"
    },
    "erp": {
      "endpoint": "https://api.farmatotal.com.py/...",
      "status": "Configurado"
    }
  },
  "services": {
    "syncService": true,
    "queue": true,
    "notifications": true
  }
}
```

#### `/api/system/test-connections`
Prueba las conexiones a MySQL y ERP.

**Respuesta:**
```json
{
  "timestamp": "2026-01-26T17:30:00.000Z",
  "tests": {
    "mysql": {
      "status": "success",
      "message": "Conexión exitosa"
    },
    "erp": {
      "status": "success",
      "message": "Endpoint accesible",
      "statusCode": 200
    }
  }
}
```

---

## Cómo Usar el Sistema

### 1. Configuración Inicial

Edita el archivo `.env`:

```env
# Habilitar sincronización automática
AUTO_SYNC_ENABLED=true

# Intervalo de sincronización (en minutos)
SYNC_INTERVAL_MINUTES=10

# Tamaño de lote
SYNC_BATCH_SIZE=100

# Reintentos
SYNC_MAX_RETRIES=3
```

### 2. Iniciar el Servidor

```bash
npm start
```

El servidor mostrará:

```
============================================================
  FARMATOTAL SYNC v2.0 - SISTEMA MEJORADO
============================================================

🔄 Cargando Logger...
✅ Logger inicializado
✅ Logs configurados
🔄 Inicializando servicios...
✅ SyncQueue creado
✅ QueueValidator creado
⚠️  MySQL no disponible: Access denied
⚠️  El servidor continuará en modo SOLO LECTURA

📌 Para habilitar MySQL:
   1. Agrega tu IP en el panel de hosting:
      IP: 2600:1900:0:2e03::f01
   2. Ve a Remote MySQL o Acceso Remoto
   3. Agrega la IP a la lista blanca

✅ WhatsAppNotifier creado
✅ SyncService creado
✅ Controllers creados
✅ Todos los servicios inicializados
✅ Sincronización automática configurada: cada 10 minutos

✅ ¡SERVIDOR INICIADO CORRECTAMENTE!

📊 Dashboard: http://localhost:3001
🔍 Health: http://localhost:3001/health
```

### 3. Acceder al Dashboard

Abre tu navegador en: **http://localhost:3001**

El dashboard mostrará:
- Estado de conexiones en tiempo real
- Configuración del sistema
- Próxima sincronización automática
- Logs en vivo
- Estadísticas actualizadas

### 4. Monitorear la Sincronización

El sistema sincronizará automáticamente cada X minutos (según configuración). Puedes ver el progreso en:

- **Dashboard:** Eventos en tiempo real
- **Logs:** `/tmp/cc-agent/62752339/project/logs/YYYY-MM-DD.log`
- **Consola:** Si ejecutas el servidor en terminal

---

## Resolución de Problemas

### Problema: Sincronización automática no se ejecuta

**Causa:** `AUTO_SYNC_ENABLED` está en `false` o MySQL no está disponible

**Solución:**
1. Verifica `.env`: `AUTO_SYNC_ENABLED=true`
2. Verifica que MySQL esté conectado (dashboard muestra el estado)
3. Revisa los logs para ver errores

### Problema: MySQL no conecta

**Causa:** Tu IP no está en la lista blanca del servidor MySQL

**Solución:**
1. Ve al panel de hosting (Hostinger/cPanel)
2. Busca "Remote MySQL" o "Acceso Remoto a MySQL"
3. Agrega tu IP: `2600:1900:0:2e03::f01`
4. Reinicia el servidor

### Problema: Dashboard no muestra datos

**Causa:** El servidor no está ejecutándose o hay un error de conexión

**Solución:**
1. Verifica que el servidor esté corriendo: `curl http://localhost:3001/health`
2. Revisa los logs: `cat logs/$(date +%Y-%m-%d).log`
3. Reinicia el servidor: `npm start`

---

## Diferencias con la Versión Anterior

| Aspecto | Versión Anterior | Nueva Versión |
|---------|------------------|---------------|
| Sincronización | Manual (botón en dashboard) | Automática por cron job |
| Dashboard | Solo estadísticas básicas | Configuración + Estado + Logs en tiempo real |
| Información | No mostraba configuración | Muestra toda la configuración del .env |
| Estado de conexiones | No visible | Visible y actualizado en tiempo real |
| Logs | Solo en archivos | Archivos + Dashboard en vivo |
| Próxima sync | No visible | Muestra countdown/timestamp |

---

## Arquitectura

```
┌─────────────────────────────────────────────┐
│              CRON SCHEDULER                 │
│  (Ejecuta cada SYNC_INTERVAL_MINUTES)      │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│           SYNC SERVICE                      │
│  - Obtiene productos del ERP                │
│  - Valida datos                             │
│  - Procesa lote por lote                    │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│          QUEUE PROCESSOR                    │
│  - Gestiona cola SQLite                     │
│  - Reintentos automáticos                   │
│  - Transacciones MySQL                      │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│      MYSQL WOOCOMMERCE                      │
│  - Actualiza productos                      │
│  - Stock                                    │
│  - Precios                                  │
│  - Imágenes                                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          SOCKET.IO (Tiempo Real)            │
│  - Envía eventos al dashboard               │
│  - Actualiza estadísticas                   │
│  - Logs en vivo                             │
└─────────────────────────────────────────────┘
```

---

## Logs de Sincronización

Durante cada sincronización verás logs como:

```
[2026-01-26 14:30:00] [INFO] Iniciando sincronización automática (cada 10 minutos)...
[2026-01-26 14:30:01] [INFO] Obteniendo productos desde ERP...
[2026-01-26 14:30:05] [INFO] Productos obtenidos: 150
[2026-01-26 14:30:06] [INFO] Validando datos...
[2026-01-26 14:30:07] [INFO] Procesando lote 1/2 (100 productos)...
[2026-01-26 14:30:25] [INFO] Lote 1 completado: 98 exitosos, 2 fallidos
[2026-01-26 14:30:26] [INFO] Procesando lote 2/2 (50 productos)...
[2026-01-26 14:30:40] [INFO] Lote 2 completado: 50 exitosos, 0 fallidos
[2026-01-26 14:30:40] [INFO] Sincronización automática completada
       productos: 150, exitosos: 148, fallidos: 2, duracion: 40s
```

---

## Conclusión

El sistema ahora funciona completamente en **modo automático**. El dashboard es solo para **monitoreo y visualización**, no para control manual.

La sincronización se ejecuta automáticamente según la configuración en `.env` y no requiere interacción del usuario.
