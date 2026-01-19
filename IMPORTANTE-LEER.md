# ⚠️ IMPORTANTE: Cómo ejecutar el sistema v2

## El problema que estás viendo

Si estás viendo errores de "Handshake inactivity timeout", probablemente estás ejecutando el sistema ANTIGUO (v1) en lugar del NUEVO (v2).

## ❌ NO HACER

```bash
npm start              # ❌ Ejecuta el sistema antiguo (v1)
node start.js          # ❌ Ejecuta el sistema antiguo (v1)
node app.js            # ❌ Sistema antiguo (v1)
```

## ✅ HACER

```bash
npm run start:v2       # ✅ Ejecuta el sistema NUEVO (v2)
```

O directamente:

```bash
node server-v2.js      # ✅ Sistema nuevo (v2)
```

## ¿Cómo saber qué versión estoy ejecutando?

### Sistema v2 (NUEVO - CORRECTO)
Al iniciar verás:
```
Inicializando Farmatotal Sync v2...
Inicializando SQLite queue...
SQLite queue inicializado correctamente
Inicializando MySQL processor...
MySQL processor inicializado correctamente
Servidor iniciado en puerto 3001
Dashboard disponible en: http://localhost:3001
Sistema de colas con SQLite inicializado
Retry logic con transacciones habilitado
```

### Sistema v1 (ANTIGUO - NO USAR)
Al iniciar verás:
```
🚀 INICIADOR INTELIGENTE - Sincronizador ERP
📋 Verificando prerrequisitos...
⚙️ Configurando entorno...
❌ Error inicializando base de datos: Handshake inactivity timeout
```

## Solución al problema de timeout

El sistema v2 tiene configuraciones de timeout mejoradas:
- `connectTimeout: 60000` (60 segundos)
- `acquireTimeout: 60000`
- `timeout: 60000`
- `enableKeepAlive: true`

Si aún tienes problemas:

### 1. Verifica la conexión a MySQL
```bash
# Prueba conectar manualmente
mysql -h srv1313.hstgr.io -u u377556581_vWMEZ -p
```

### 2. Verifica que el puerto 3306 esté abierto
```bash
telnet srv1313.hstgr.io 3306
```

### 3. Verifica el firewall
Si estás detrás de un firewall corporativo, puede estar bloqueando la conexión MySQL.

### 4. Aumenta los timeouts en .env
```env
MYSQL_CONNECT_TIMEOUT=120000
MYSQL_ACQUIRE_TIMEOUT=120000
MYSQL_TIMEOUT=120000
```

### 5. Prueba con una conexión local primero
Si es posible, prueba conectarte a un MySQL local primero para descartar problemas de red:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
```

## Comandos útiles

```bash
# Ver qué puerto está usando el servidor
lsof -i :3001

# Ver procesos de Node corriendo
ps aux | grep node

# Matar proceso anterior si quedó colgado
pkill -f node

# Ver logs en tiempo real
tail -f logs/$(date +%Y-%m-%d).log

# Ver solo errores
tail -f logs/errors/$(date +%Y-%m-%d)-errors.log
```

## Verificación rápida

1. Detén cualquier proceso anterior:
```bash
pkill -f node
```

2. Inicia el sistema v2:
```bash
npm run start:v2
```

3. Verifica que el dashboard carga:
```bash
curl http://localhost:3001/health
```

4. Abre en el navegador:
```
http://localhost:3001
```

Si sigues con problemas después de seguir estos pasos, revisa los logs:
```bash
cat logs/$(date +%Y-%m-%d).log | grep ERROR
```

## Diferencias clave v1 vs v2

| Característica | v1 | v2 |
|----------------|----|----|
| Base de datos de cola | No | SQLite |
| Retry logic | No | Sí (3 intentos) |
| Transacciones | No | Sí |
| Dashboard | Básico | Avanzado con gráficos |
| WebSocket | No | Sí (tiempo real) |
| Timeouts MySQL | 10s | 60s |
| Validación | Básica | Robusta |
| Reportes | No | Sí (diarios) |

## Próximos pasos

Una vez que el sistema v2 esté funcionando:

1. Accede al dashboard: http://localhost:3001
2. Inicia tu primera sincronización desde el botón "Iniciar Sync"
3. Observa el progreso en tiempo real
4. Revisa las estadísticas y gráficos

¡Éxito! 🚀
