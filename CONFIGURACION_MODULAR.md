# ⚙️ Guía de Configuración Modular
## Sincronizador ERP v2.0 - Sistema Configurable

Esta guía te explica cómo configurar todas las funcionalidades del Sincronizador ERP de manera modular.

---

## 🎯 **Filosofía del Sistema Modular**

El Sincronizador v2.0 está diseñado para ser **completamente configurable**:

- ✅ **Activa solo lo que necesitas** - Reduce consumo de recursos
- ✅ **Configuración sin código** - Todo desde el archivo `.env`
- ✅ **Optimización automática** - El sistema se adapta a tu configuración
- ✅ **Escalabilidad controlada** - Maneja el crecimiento de tu base de datos

---

## 🔧 **Configuraciones Principales**

### **1. Multi-Inventario (CRÍTICO)**

```env
# ⚠️ DECISIÓN IMPORTANTE: ¿Necesitas stock por sucursal?
MULTI_INVENTORY_ENABLED=false

# ✅ Si tienes UNA sucursal o no necesitas stock detallado
MULTI_INVENTORY_ENABLED=false

# ⚠️ Si tienes MÚLTIPLES sucursales y necesitas stock separado
MULTI_INVENTORY_ENABLED=true
```

#### **Impacto en Base de Datos:**

| Configuración | Productos | Registros por Producto | Total Registros |
|--------------|-----------|----------------------|-----------------|
| **Desactivado** | 15,000 | ~10 campos | 150,000 registros |
| **Activado (6 sucursales)** | 15,000 | ~16 campos | 240,000 registros |

#### **Cuándo Activar Multi-Inventario:**
- ✅ Tienes múltiples sucursales físicas
- ✅ Necesitas mostrar stock específico por ubicación
- ✅ Tu infraestructura soporta mayor uso de BD

#### **Cuándo Mantenerlo Desactivado:**
- ✅ Tienes una sola sucursal
- ✅ Solo necesitas stock general (total)
- ✅ Quieres minimizar el crecimiento de la BD
- ✅ Tu hosting tiene limitaciones de base de datos

---

### **2. Notificaciones WhatsApp**

```env
# Activar WhatsApp
WHATSAPP_ENABLED=true
WHATSAPP_RECIPIENT=+595981234567
WHATSAPP_RESPOND_COMMANDS=true
```

#### **Configuración Inicial:**
1. **Activar en .env:** `WHATSAPP_ENABLED=true`
2. **Configurar número:** Tu número con código de país
3. **Reiniciar servidor:** `npm start`
4. **Escanear QR:** Aparecerá en la consola
5. **Confirmar conexión:** Recibirás mensaje de confirmación

#### **Comandos Disponibles:**
- `status` - Estado del sistema
- `help` - Lista de comandos
- `sync` - Información sobre sincronización

#### **Notificaciones Automáticas:**
- 🔄 Reportes de sincronización
- ❌ Alertas de errores críticos
- 🗑️ Productos eliminados
- ♻️ Productos restaurados

---

### **3. Sistema de Sincronización**

```env
# Configuración de sincronización
AUTO_SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=10
SYNC_MAX_RETRIES=3
SYNC_BATCH_SIZE=100
```

#### **Optimización por Tamaño de Catálogo:**

| Productos | Intervalo Recomendado | Batch Size | Multi-Inventory |
|-----------|---------------------|------------|----------------|
| < 1,000 | 5 minutos | 50 | ✅ Puede activar |
| 1,000 - 5,000 | 10 minutos | 100 | ⚠️ Evaluar impacto |
| 5,000 - 15,000 | 15 minutos | 100 | ❌ No recomendado |
| > 15,000 | 30 minutos | 50 | ❌ Definitivamente no |

---

### **4. Sistema de Backup**

```env
# Configuración de backup
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_AUTO_CLEANUP=true
```

#### **Impacto del Sistema de Backup:**

| Configuración | Espacio Usado | Ventajas | Desventajas |
|--------------|---------------|----------|-------------|
| **Activado** | ~100MB/mes | Recuperación completa | Usa espacio en disco |
| **Desactivado** | 0MB | Sin uso de espacio | Sin capacidad de rollback |

---

## 🎛️ **Configuraciones por Escenario**

### **🏪 Farmacia Pequeña (1 sucursal, <1000 productos)**

```env
# Configuración optimizada para farmacia pequeña
MULTI_INVENTORY_ENABLED=false
WHATSAPP_ENABLED=true
AUTO_SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=5
BACKUP_ENABLED=true
LOG_LEVEL=INFO
```

**Características:**
- ✅ Base de datos liviana
- ✅ Notificaciones WhatsApp
- ✅ Sincronización frecuente
- ✅ Backups habilitados

---

### **🏬 Cadena Mediana (2-4 sucursales, 1000-5000 productos)**

```env
# Configuración balanceada
MULTI_INVENTORY_ENABLED=true
WHATSAPP_ENABLED=true
AUTO_SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=10
SYNC_BATCH_SIZE=50
BACKUP_ENABLED=true
LOG_LEVEL=INFO
```

**Características:**
- ⚠️ Multi-inventario activado (evaluar performance)
- ✅ Todas las notificaciones
- ✅ Sincronización balanceada
- ✅ Lotes más pequeños

---

### **🏢 Cadena Grande (5+ sucursales, 5000+ productos)**

```env
# Configuración para alto volumen
MULTI_INVENTORY_ENABLED=false  # ⚠️ Evaluar cuidadosamente
WHATSAPP_ENABLED=true
AUTO_SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=15
SYNC_BATCH_SIZE=25
BACKUP_ENABLED=false  # Opcional para ahorrar espacio
LOG_LEVEL=WARN
DB_CONNECTION_LIMIT=25
```

**Características:**
- ❌ Multi-inventario deshabilitado por performance
- ✅ Solo notificaciones críticas
- ⏱️ Sincronización menos frecuente
- 🔢 Lotes muy pequeños para no sobrecargar

---

## 📊 **Monitoreo de Performance**

### **Indicadores Clave:**

#### **Base de Datos:**
```sql
-- Verificar tamaño de tablas
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size MB'
FROM information_schema.tables 
WHERE table_schema = 'tu_bd'
ORDER BY (data_length + index_length) DESC;
```

#### **Dashboard:**
- 📊 **Duración promedio:** <30 segundos = ✅ | >60 segundos = ⚠️
- 🔄 **Productos por minuto:** >100 = ✅ | <50 = ⚠️
- ❌ **Tasa de errores:** <5% = ✅ | >10% = ❌
- 💾 **Memoria:** <200MB = ✅ | >500MB = ⚠️

---

## 🚨 **Alertas y Problemas Comunes**

### **Base de Datos Muy Grande:**

**Síntomas:**
- Sincronización tarda >2 minutos
- Errores de timeout frecuentes
- Hosting reporta uso alto de recursos

**Soluciones:**
```env
# 1. Desactivar multi-inventario
MULTI_INVENTORY_ENABLED=false

# 2. Reducir frecuencia
SYNC_INTERVAL_MINUTES=30

# 3. Lotes más pequeños
SYNC_BATCH_SIZE=25

# 4. Desactivar logs debug
LOG_LEVEL=WARN
```

### **WhatsApp No Conecta:**

**Soluciones:**
1. **Verificar número:** Formato `+595981234567`
2. **Limpiar sesión:** 
   ```bash
   rm -rf tmp/whatsapp-auth/*
   npm start
   ```
3. **Escanear QR nuevamente:** Aparece en la consola

### **Sincronización Lenta:**

**Optimizaciones:**
```env
# Reducir timeouts
SYNC_TIMEOUT_SECONDS=600

# Menos conexiones concurrentes
DB_CONNECTION_LIMIT=5

# Lotes más grandes
SYNC_BATCH_SIZE=200
```

---

## 🔄 **Cambiar Configuración en Producción**

### **Pasos Seguros:**

1. **Hacer backup:**
   ```bash
   npm run backup
   ```

2. **Editar .env:**
   ```bash
   nano .env
   ```

3. **Reiniciar servicio:**
   ```bash
   pm2 restart sync-erp-woocommerce
   ```

4. **Verificar estado:**
   ```bash
   pm2 logs sync-erp-woocommerce
   ```

### **Cambios que Requieren Reinicio:**
- ✅ Todas las configuraciones de funcionalidades
- ✅ Configuraciones de base de datos
- ✅ Configuraciones de WhatsApp
- ✅ Intervalos de sincronización

### **Cambios en Tiempo Real:**
- ✅ Nivel de logs (parcialmente)
- ✅ Control manual del cron job
- ✅ Activar/desactivar funcionalidades via API

---

## 📋 **Checklist de Configuración Inicial**

### **Configuración Básica (Obligatoria):**
- [ ] Credenciales de base de datos configuradas
- [ ] `ERP_ENDPOINT` configurado
- [ ] `AUTO_SYNC_ENABLED=true`
- [ ] Puerto disponible (default: 3001)

### **Configuración de Funcionalidades:**
- [ ] **Multi-inventario:** Decidir activar/desactivar según necesidad
- [ ] **WhatsApp:** Configurar número si se desea notificaciones
- [ ] **Intervalo de sync:** Configurar según volumen de productos
- [ ] **Backups:** Activar para seguridad (recomendado)

### **Optimización de Performance:**
- [ ] **Batch size:** Ajustar según capacidad del servidor
- [ ] **Nivel de logs:** INFO para producción, DEBUG para troubleshooting
- [ ] **Timeouts:** Aumentar si hay problemas de conectividad
- [ ] **Límites de conexión:** Ajustar según plan de hosting

### **Verificación Post-Configuración:**
- [ ] Dashboard responde en `http://localhost:3001`
- [ ] Cron job aparece como "ACTIVO"
- [ ] Sincronización manual funciona
- [ ] WhatsApp conectado (si está habilitado)
- [ ] Logs se generan correctamente

---

## 🎯 **Recomendaciones Finales**

1. **Empieza conservador:** Activa funcionalidades gradualmente
2. **Monitorea constantemente:** Revisa el dashboard regularmente
3. **Haz backups:** Antes de cambios importantes
4. **Documenta cambios:** Mantén un registro de tu configuración
5. **Prueba en desarrollo:** Si es posible, prueba cambios primero

**¿Dudas?** Consulta el dashboard en `http://localhost:3001` para ver el estado actual de todas las funcionalidades.

---

**Con esta configuración modular, tienes el control total sobre cómo funciona tu Sincronizador ERP. ¡Úsalo sabiamente! 🚀**