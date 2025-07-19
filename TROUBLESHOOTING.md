# 🔧 Guía de Solución de Problemas - Sincronizador ERP

## 🚨 Problemas Comunes y Soluciones

### ⏰ Problema #1: Cron Job No Se Ejecuta Automáticamente

#### **Síntomas:**
- La sincronización manual funciona (`npm run sync`)
- El cron job no ejecuta cada 10 minutos
- En el dashboard aparece "Cron job INACTIVO"

#### **Causa:**
El cron job no se inicializa correctamente al importar el módulo `sync-enhanced.js`.

#### **Solución Inmediata:**
```bash
# 1. Detener el servidor si está corriendo
Ctrl+C

# 2. Usar el nuevo script de inicio
npm start

# 3. Verificar estado del cron job
npm run cron:status

# 4. Si aún no funciona, forzar inicio del cron
curl -X POST http://localhost:3001/api/cron/start
```

#### **Solución Permanente:**
1. **Reemplazar archivos actualizados:**
   - Usa el `sync-enhanced.js` corregido
   - Usa el `app.js` corregido
   - Usa el `start.js` nuevo

2. **Verificar configuración en `.env`:**
   ```env
   AUTO_SYNC_ENABLED=true
   SYNC_INTERVAL_MINUTES=10
   ```

3. **Verificar que el cron se inicia correctamente:**
   ```bash
   # Ver logs en tiempo real
   npm run logs
   
   # Buscar líneas como:
   # "🕒 Iniciando cron job con intervalo: cada 10 minutos"
   # "✅ Cron job iniciado correctamente"
   ```

---

### 🖥️ Problema #2: Instalación de Servicio en Windows Falla

#### **Síntomas:**
- `node install-service.js` no funciona
- Error: "node-windows no encontrado"
- Error: "PM2 no está instalado"

#### **Solución Paso a Paso:**

#### **Opción A: Usar el Nuevo Instalador Mejorado**
```bash
# 1. Usar el nuevo script de instalación
node install-service.js

# El script detectará automáticamente qué está disponible e instalará dependencias
```

#### **Opción B: Instalación Manual de PM2**
```bash
# 1. Instalar PM2 globalmente (como Administrador)
npm install -g pm2
npm install -g pm2-windows-startup

# 2. Crear configuración
npm run pm2:start

# 3. Configurar inicio automático
pm2-startup install
pm2 save

# 4. Verificar
pm2 status
```

#### **Opción C: Usar Task Scheduler (Programador de Tareas)**
1. Abrir "Programador de tareas" (taskschd.msc)
2. Crear tarea básica:
   - **Nombre:** Sincronizador ERP
   - **Desencadenador:** Al iniciar el equipo
   - **Acción:** Iniciar programa
   - **Programa:** `C:\Program Files\nodejs\node.exe`
   - **Argumentos:** `"C:\ruta\a\tu\proyecto\app.js"`
   - **Directorio:** `C:\ruta\a\tu\proyecto`

#### **Opción D: Usar NSSM (Recomendado para Windows)**
```bash
# 1. Descargar NSSM desde nssm.cc
# 2. Instalar el servicio
nssm install "Sincronizador ERP" "C:\Program Files\nodejs\node.exe"
nssm set "Sincronizador ERP" AppParameters "C:\ruta\a\tu\proyecto\app.js"
nssm set "Sincronizador ERP" AppDirectory "C:\ruta\a\tu\proyecto"
nssm start "Sincronizador ERP"
```

---

### 🔍 Problema #3: Variables de Entorno No Se Cargan

#### **Síntomas:**
- Error: "DB_HOST no definido"
- Error de conexión a base de datos
- El servidor no puede conectar al ERP

#### **Solución:**
```bash
# 1. Verificar que existe .env
ls -la .env

# 2. Si no existe, crear configuración
npm run setup

# 3. Verificar contenido del .env
cat .env

# 4. Validar variables críticas
node -e "require('dotenv').config(); console.log('DB_HOST:', process.env.DB_HOST)"
```

---

### 🗄️ Problema #4: Error de Conexión a Base de Datos

#### **Síntomas:**
- "Error de conexión: ER_ACCESS_DENIED_ERROR"
- "ECONNREFUSED" al conectar a MySQL

#### **Diagnóstico:**
```bash
# Ejecutar diagnóstico automático
npm run troubleshoot

# O verificar manualmente
mysql -h srv1313.hstgr.io -u u377556581_vWMEZ -p
```

#### **Soluciones:**
1. **Verificar credenciales en `.env`:**
   ```env
   DB_HOST=srv1313.hstgr.io
   DB_USER=u377556581_vWMEZ
   DB_PASSWORD=NJdPaC3A$j7DCzE&yU^P
   DB_NAME=u377556581_OXkxK
   ```

2. **Verificar conectividad:**
   ```bash
   ping srv1313.hstgr.io
   telnet srv1313.hstgr.io 3306
   ```

3. **Verificar tablas de WordPress:**
   ```sql
   SHOW TABLES LIKE 'btw70_%';
   ```

---

### 🌐 Problema #5: API ERP No Responde

#### **Síntomas:**
- Timeout connecting to ERP
- "ENOTFOUND api.farmatotal.com.py"

#### **Solución:**
```bash
# 1. Verificar URL en .env
echo $ERP_ENDPOINT

# 2. Probar conectividad
curl -k https://api.farmatotal.com.py/farma/next/ecommerce/producto

# 3. Verificar con timeout mayor
curl -k --max-time 30 https://api.farmatotal.com.py/farma/next/ecommerce/producto
```

---

## 🛠️ Scripts de Diagnóstico y Reparación

### **Diagnóstico Completo:**
```bash
npm run troubleshoot
```

### **Prueba del Sistema:**
```bash
# Prueba completa
npm test

# Prueba rápida (sin sincronización)
npm run test:quick
```

### **Verificar Estado del Sistema:**
```bash
# Estado general
npm run status

# Estado del cron job específicamente
npm run cron:status

# Logs en tiempo real
npm run logs
```

### **Reparaciones Comunes:**
```bash
# Limpiar y reinstalar
npm run clean
npm install

# Reinicializar base de datos
npm run init-db

# Crear backup
npm run backup
```

---

## 🚀 Secuencia de Inicio Recomendada

### **Primera Instalación:**
```bash
# 1. Clonar/descargar proyecto
git clone <repo-url>
cd sync-erp-woocommerce

# 2. Configuración inicial
npm install
npm run setup

# 3. Editar .env con credenciales reales
nano .env

# 4. Verificar configuración
npm run troubleshoot

# 5. Ejecutar pruebas
npm test

# 6. Iniciar servidor
npm start
```

### **Después de Problemas:**
```bash
# 1. Diagnóstico
npm run troubleshoot

# 2. Reparar problemas encontrados
# (seguir las recomendaciones del diagnóstico)

# 3. Prueba rápida
npm run test:quick

# 4. Reiniciar servidor
npm start
```

---

## 📱 Monitoreo y Verificación

### **Dashboard Web:**
- URL: http://localhost:3001
- Verificar: Estado del cron job
- Verificar: Última sincronización
- Verificar: Logs en tiempo real

### **APIs de Verificación:**
```bash
# Health check general
curl http://localhost:3001/health

# Estado del cron job
curl http://localhost:3001/api/cron/status

# Estadísticas
curl http://localhost:3001/api/stats

# Control del cron job
curl -X POST http://localhost:3001/api/cron/start
curl -X POST http://localhost:3001/api/cron/stop
```

### **Logs y Archivos:**
```bash
# Ver logs del día actual
tail -f logs/$(date +%Y-%m-%d).log

# Ver últimas sincronizaciones
grep "Sincronización completa" logs/*.log | tail -5

# Ver errores recientes
grep "ERROR" logs/$(date +%Y-%m-%d).log | tail -10
```

---

## 🆘 Contacto para Soporte

Si después de seguir esta guía aún tienes problemas:

1. **Generar reporte de diagnóstico:**
   ```bash
   npm run troubleshoot > diagnostico.txt
   npm test >> diagnostico.txt
   ```

2. **Incluir información del sistema:**
   ```bash
   echo "Node.js: $(node --version)" >> diagnostico.txt
   echo "OS: $(uname -a)" >> diagnostico.txt
   echo "NPM: $(npm --version)" >> diagnostico.txt
   ```

3. **Enviar el archivo `diagnostico.txt` junto con:**
   - Descripción del problema
   - Pasos que ya intentaste
   - Logs relevantes
   - Archivo `.env` (SIN credenciales sensibles)

---

## 📋 Checklist de Verificación Rápida

- [ ] Archivo `.env` existe y está configurado
- [ ] Variables DB_* están correctas
- [ ] `npm install` ejecutado sin errores
- [ ] Base de datos accesible
- [ ] API ERP responde
- [ ] Puerto 3001 disponible
- [ ] Permisos de escritura en logs/, backups/, tmp/
- [ ] Node.js >= 16.0.0
- [ ] Cron job activo en dashboard
- [ ] Sincronización manual funciona
- [ ] No hay archivos lock antiguos en tmp/

**Si todos los elementos están ✅, el sistema debería funcionar correctamente.**