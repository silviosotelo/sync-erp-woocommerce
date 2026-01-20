# Changelog - Migración a v2.0

## Cambios Realizados

### Archivos Eliminados (Sistema v1 Obsoleto)

**Archivos principales v1:**
- `app.js` - Sistema antiguo de sincronización
- `sync-enhanced.js` - Sincronizador v1
- `start.js` - Iniciador v1
- `dashboard-server.js` - Dashboard antiguo
- `api-endpoints.js` - API v1
- `diagnostic-service.js` - Diagnósticos v1

**Scripts de instalación obsoletos:**
- `install-service.js`
- `install-service-native.js`
- `install-pm2-service.js`
- `uninstall-service.js`
- `uninstall-service-native.js`

**Scripts de configuración obsoletos:**
- `setup.js`
- `setup-whatsapp.js`
- `troubleshoot.js`
- `test-sync.js`

**Directorios eliminados:**
- `dashboard/` - Dashboard v1 antiguo
- `modules/` - Módulos v1 (reemplazados por src/)

**Documentación obsoleta:**
- `readme.md` - README v1
- `guia.md` - Guía v1
- `CONFIGURACION_MODULAR.md` - Config v1
- `TROUBLESHOOTING.md` - Troubleshooting v1

### Archivos Nuevos (Sistema v2)

**Servidor principal:**
- `server.js` - Servidor v2 con Socket.io y colas

**Nueva arquitectura modular (src/):**
```
src/
├── database/
│   ├── sqlite.js - Base de datos SQLite para colas
│   └── mysql-connection.js - Conexión MySQL mejorada
├── queue/
│   ├── SyncQueue.js - Sistema de colas
│   ├── QueueProcessor.js - Procesamiento con retry logic
│   └── QueueValidator.js - Validación robusta
├── sync/
│   └── SyncService.js - Servicio de sincronización principal
├── notifications/
│   ├── WhatsAppNotifier.js - Notificaciones mejoradas
│   └── templates/ - Templates de mensajes
├── reports/
│   ├── DailyReportGenerator.js - Generador de reportes
│   └── CSVExporter.js - Exportador CSV
├── api/
│   ├── routes/ - Rutas API REST
│   └── controllers/ - Controladores
└── utils/
    └── Logger.js - Sistema de logging mejorado
```

**Dashboard mejorado (public/):**
- `public/dashboard-v2.html` - Dashboard con gráficos
- `public/js/dashboard-v2.js` - Lógica del dashboard

**Configuración:**
- `.env.example` - Template de configuración limpio

**Documentación nueva:**
- `README.md` - Documentación completa v2
- `QUICKSTART.md` - Guía rápida de inicio
- `IMPORTANTE-LEER.md` - Notas importantes

## Mejoras Técnicas

### 1. Sistema de Colas con SQLite
- Base de datos local para tracking completo
- Estados: pending → processing → completed/failed
- Historial de sincronizaciones
- Tracking de errores

### 2. Retry Logic Inteligente
- 3 reintentos automáticos con backoff exponencial
- Transacciones MySQL con rollback
- Validación pre-procesamiento

### 3. Dashboard Avanzado
- Gráficos en tiempo real (Chart.js)
- WebSocket con Socket.io
- Estadísticas detalladas
- Filtros y búsqueda

### 4. Notificaciones Mejoradas
- Mensajes estructurados por WhatsApp
- Templates profesionales
- Reportes diarios automáticos

### 5. API REST Completa
- 10 endpoints documentados
- Respuestas JSON consistentes
- Manejo de errores robusto

### 6. Configuración MySQL Mejorada
- Timeouts aumentados a 60s
- Keep-alive habilitado
- Retry automático de conexiones

## Scripts Simplificados

**Antes (v1):**
```bash
npm start              # Sistema v1
npm run start:v2       # Sistema v2
npm run setup          # Configuración
npm run troubleshoot   # Diagnóstico
```

**Ahora (v2):**
```bash
npm start              # Sistema v2 (único)
npm run dev            # Desarrollo con nodemon
npm run logs           # Ver logs
npm run status         # Estado del servidor
npm run pm2:start      # Iniciar con PM2
```

## Configuración Simplificada

**Antes:** 200+ líneas en .env con muchas opciones obsoletas

**Ahora:** ~60 líneas en .env con solo lo esencial:
- MySQL WooCommerce
- ERP Database
- Sistema de colas v2
- Notificaciones WhatsApp
- Reportes diarios
- Dashboard

## Migración

Si estás migrando de v1 a v2:

1. **Backup de datos:**
   ```bash
   cp .env .env.backup
   ```

2. **Actualizar dependencias:**
   ```bash
   npm install
   ```

3. **Crear directorios:**
   ```bash
   npm run prepare
   ```

4. **Configurar .env:**
   ```bash
   cp .env.example .env
   # Editar .env con tus credenciales
   ```

5. **Iniciar sistema v2:**
   ```bash
   npm start
   ```

## Comandos Útiles

```bash
# Ver estado
npm run status

# Ver logs
npm run logs
npm run logs:errors

# Dashboard
npm run dashboard

# Limpiar datos
npm run clean
npm run clean:db

# PM2
npm run pm2:start
npm run pm2:logs
npm run pm2:stop
```

## Soporte

- Dashboard: http://localhost:3001
- Logs: logs/YYYY-MM-DD.log
- Errores: logs/errors/YYYY-MM-DD-errors.log
- Documentación: README.md
- Guía rápida: QUICKSTART.md

## Versión

- **v1.x:** Sistema antiguo (OBSOLETO)
- **v2.0:** Sistema nuevo con colas, retry logic, dashboard avanzado

---

**Fecha de migración:** 2026-01-19
**Estado:** Producción
**Mantenedor:** Farmatotal
