# 🔌 Plugin Sincronizador ERP - WooCommerce

## 📋 Información del Plugin

- **Nombre**: Sincronizador ERP - WooCommerce
- **Versión**: 1.0.0
- **Autor**: Tu Empresa
- **Descripción**: Plugin para sincronización bidireccional entre ERP y WooCommerce con dashboard de monitoreo
- **Requerimientos**: WordPress 5.0+, WooCommerce 5.0+, PHP 7.4+

## 🚀 Instalación del Plugin

### Método 1: Instalación Manual

1. **Descargar archivos del plugin**
   ```
   📁 sync-erp-woocommerce/
   ├── 📄 sync-erp-woocommerce.php (archivo principal)
   ├── 📁 includes/
   │   ├── 📄 class-admin.php
   │   ├── 📄 class-api.php
   │   ├── 📄 class-product-sync.php
   │   ├── 📄 class-order-sync.php
   │   ├── 📄 class-stock-sync.php
   │   ├── 📄 class-logger.php
   │   └── 📄 functions.php
   ├── 📁 assets/
   │   ├── 📁 css/
   │   │   └── 📄 admin.css
   │   └── 📁 js/
   │       └── 📄 admin.js
   ├── 📁 languages/
   └── 📄 readme.txt
   ```

2. **Subir archivos vía FTP**
   ```bash
   # Subir la carpeta completa a:
   /wp-content/plugins/sync-erp-woocommerce/
   ```

3. **O comprimir y subir vía WordPress**
   ```bash
   zip -r sync-erp-woocommerce.zip sync-erp-woocommerce/
   # Luego subir desde WordPress Admin > Plugins > Añadir nuevo > Subir plugin
   ```

### Método 2: Instalación vía WordPress Admin

1. **Ir a Plugins > Añadir nuevo**
2. **Hacer clic en "Subir Plugin"**
3. **Seleccionar el archivo ZIP del plugin**
4. **Hacer clic en "Instalar ahora"**
5. **Activar el plugin**

## ⚙️ Configuración Inicial

### 1. Verificar Requisitos

- ✅ **WordPress**: 5.0 o superior
- ✅ **WooCommerce**: 5.0 o superior  
- ✅ **PHP**: 7.4 o superior
- ✅ **MySQL**: 5.7 o superior
- ✅ **Backend Node.js**: Funcionando y accesible

### 2. Configuración Básica

1. **Ir a "Sincronizador ERP" > "Configuración"**
2. **Configurar los siguientes campos**:

   ```
   URL del Backend: http://localhost:3001
   Clave API: [generar nueva o usar existente]
   Sincronización Automática: Activada
   Intervalo de Sincronización: 10 minutos
   Notificaciones: Activadas
   Email para Notificaciones: admin@tudominio.com
   Nivel de Log: Info
   ```

3. **Hacer clic en "Guardar cambios"**

### 3. Probar Conexión

1. **Ir a "Sincronizador ERP" > "Dashboard"**
2. **Hacer clic en "Probar Conexión"**
3. **Verificar que aparezca "Conexión exitosa"**

### 4. Primera Sincronización

1. **Hacer clic en "Sincronizar Ahora"**
2. **Verificar en "Actividad Reciente" que la sincronización se completó**
3. **Revisar los logs si hay errores**

## 🎛️ Panel de Administración

### Dashboard Principal
- **Estado del Sistema**: Conexión, última sincronización, configuración
- **Estadísticas**: Productos creados, actualizados, eliminados, errores
- **Acciones Rápidas**: Sincronizar ahora, probar conexión, ver logs
- **Actividad Reciente**: Historial de sincronizaciones

### Gestión de Productos
- **Eliminar Producto**: Eliminación individual por código interno
- **Restaurar Producto**: Restauración de productos eliminados
- **Productos Eliminados**: Lista de productos eliminados recientemente

### Logs del Sistema
- **Visualización**: Logs en tiempo real con filtros por nivel
- **Búsqueda**: Filtrar por fecha, nivel o mensaje
- **Limpieza**: Limpiar logs antiguos
- **Exportación**: Descargar logs en formato CSV

### Configuración Avanzada
- **Backend**: URL y configuración de API
- **Sincronización**: Intervalos y configuración automática
- **Notificaciones**: Email y configuración de alertas
- **Logging**: Niveles y retención de logs

## 🔌 APIs Disponibles

### Endpoints REST API

```
# Health Check
GET /wp-json/sync-erp/v1/health

# Sincronización
POST /wp-json/sync-erp/v1/sync/trigger
GET /wp-json/sync-erp/v1/sync/status

# Productos
POST /wp-json/sync-erp/v1/products/delete
POST /wp-json/sync-erp/v1/products/restore
GET /wp-json/sync-erp/v1/products/deleted

# Estadísticas
GET /wp-json/sync-erp/v1/stats
GET /wp-json/sync-erp/v1/stats/detailed

# Logs
GET /wp-json/sync-erp/v1/logs
```

### Autenticación

**Usar API Key en header:**
```http
X-API-Key: tu_api_key_de_32_caracteres
```

**O autenticación de WordPress:**
```http
Authorization: Bearer wp_token
```

## 🔧 Hooks y Filtros

### Hooks de Acción

```php
// Antes de sincronización
do_action('sync_erp_before_sync', $products);

// Después de sincronización
do_action('sync_erp_after_sync', $results);

// Producto eliminado
do_action('sync_erp_product_deleted', $product_id, $cod_interno);

// Producto restaurado
do_action('sync_erp_product_restored', $product_id, $cod_interno);
```

### Filtros

```php
// Modificar configuración por defecto
add_filter('sync_erp_default_config', function($config) {
    $config['sync_interval'] = 5; // 5 minutos
    return $config;
});

// Filtrar productos a sincronizar
add_filter('sync_erp_products_to_sync', function($products) {
    // Filtrar productos específicos
    return $products;
});

// Modificar datos de producto antes de sincronizar
add_filter('sync_erp_product_data', function($data, $product) {
    // Modificar datos del producto
    return $data;
}, 10, 2);
```

## 🛠️ Funciones de Desarrollo

### Funciones Helper

```php
// Verificar si un producto está sincronizado
if (sync_erp_is_product_synced($product_id)) {
    // Producto sincronizado
}

// Obtener código interno del producto
$cod_interno = sync_erp_get_product_code($product_id);

// Obtener producto por código interno
$product = sync_erp_get_product_by_code($cod_interno);

// Obtener estadísticas
$stats = sync_erp_get_sync_stats('24h');

// Probar conexión con backend
$result = sync_erp_test_backend_connection();
```

### Logging Personalizado

```php
// Log básico
SyncERP_Logger::log('Mi mensaje', 'info');

// Log con contexto
SyncERP_Logger::log('Producto actualizado', 'info', array(
    'product_id' => 123,
    'cod_interno' => 'ABC123'
));

// Logs específicos
SyncERP_Logger::log_product_sync('ABC123', 'updated', true);
SyncERP_Logger::log_order_sync(456, 'created', true);
SyncERP_Logger::log_api_request('/api/products', 'GET', 200, 150);
```

## 🔍 Troubleshooting

### Problema: Plugin no aparece en admin

**Solución:**
```bash
# Verificar permisos de archivos
chmod -R 755 /wp-content/plugins/sync-erp-woocommerce/
chown -R www-data:www-data /wp-content/plugins/sync-erp-woocommerce/

# Verificar logs de WordPress
tail -f /wp-content/debug.log
```

### Problema: Error de conexión con backend

**Verificar:**
1. ✅ Backend ejecutándose en la URL configurada
2. ✅ API Key correcta
3. ✅ Firewall no bloquea conexión
4. ✅ SSL/HTTPS configurado correctamente

**Comando de prueba:**
```bash
curl -H "X-API-Key: tu_api_key" http://localhost:3001/health
```

### Problema: Sincronización no automática

**Verificar:**
1. ✅ Cron de WordPress funcionando
2. ✅ Sincronización automática activada
3. ✅ No hay errores en logs

**Comando de prueba:**
```bash
wp cron event list --fields=hook,next_run
```

### Problema: Productos no se crean/actualizan

**Verificar:**
1. ✅ Permisos de usuario
2. ✅ WooCommerce activo y compatible
3. ✅ Códigos internos únicos
4. ✅ Logs para errores específicos

### Problema: Logs no se muestran

**Verificar:**
1. ✅ Tablas de base de datos creadas
2. ✅ Permisos de escritura en DB
3. ✅ Nivel de log configurado correctamente

**SQL para verificar:**
```sql
SELECT COUNT(*) FROM wp_sync_erp_logs;
SELECT COUNT(*) FROM wp_sync_erp_stats;
```

## 📊 Monitoreo y Mantenimiento

### Limpieza Automática

El plugin incluye limpieza automática de:
- **Logs**: Mayores a 30 días
- **Estadísticas**: Mayores a 90 días
- **Backups**: Mayores a 30 días

### Monitoreo de Salud

**Verificar regularmente:**
- Estado de conexión con backend
- Errores en sincronización
- Espacio en disco para logs
- Performance de sincronización

### Backup Recomendado

```bash
# Backup de base de datos
mysqldump -u user -p database > backup_$(date +%Y%m%d).sql

# Backup de archivos del plugin
tar -czf plugin_backup_$(date +%Y%m%d).tar.gz /wp-content/plugins/sync-erp-woocommerce/
```

## 📞 Soporte

### Información de Debug

**Para reportar problemas, incluir:**
1. Versión del plugin
2. Versión de WordPress y WooCommerce
3. Logs relevantes (últimas 24 horas)
4. Configuración del plugin
5. Mensaje de error específico

### Generar Reporte de Debug

```php
// Código para generar reporte automático
$debug_info = array(
    'plugin_version' => SYNC_ERP_WC_VERSION,
    'wp_version' => get_bloginfo('version'),
    'wc_version' => WC_VERSION,
    'php_version' => PHP_VERSION,
    'config' => sync_erp_get_plugin_status(),
    'recent_logs' => SyncERP_Logger::get_recent_logs(20),
    'health_status' => sync_erp_get_health_status()
);
```

---

## 🎯 Próximos Pasos

Una vez instalado y configurado el plugin:

1. ✅ **Verificar sincronización automática**
2. ✅ **Configurar notificaciones**
3. ✅ **Probar eliminación y restauración**
4. ✅ **Configurar backups automáticos**
5. ✅ **Monitorear logs regularmente**

**¿Todo funcionando?** 🎉 ¡El sistema de sincronización bidireccional está listo!