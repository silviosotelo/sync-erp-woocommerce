<?php
/**
 * Helper functions for Sync ERP WooCommerce plugin
 * 
 * @package SyncERPWooCommerce
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Get plugin option with fallback
 */
function sync_erp_get_option($option_name, $default = null) {
    return get_option('sync_erp_' . $option_name, $default);
}

/**
 * Update plugin option
 */
function sync_erp_update_option($option_name, $value) {
    return update_option('sync_erp_' . $option_name, $value);
}

/**
 * Check if auto sync is enabled
 */
function sync_erp_is_auto_sync_enabled() {
    return sync_erp_get_option('auto_sync', 'no') === 'yes';
}

/**
 * Check if notifications are enabled
 */
function sync_erp_are_notifications_enabled() {
    return sync_erp_get_option('notifications', 'no') === 'yes';
}

/**
 * Get backend URL
 */
function sync_erp_get_backend_url() {
    return rtrim(sync_erp_get_option('backend_url', 'http://localhost:3001'), '/');
}

/**
 * Get API key
 */
function sync_erp_get_api_key() {
    return sync_erp_get_option('api_key', '');
}

/**
 * Format duration in seconds to human readable
 */
function sync_erp_format_duration($seconds) {
    if ($seconds < 60) {
        return round($seconds, 2) . ' ' . __('segundos', 'sync-erp-wc');
    } elseif ($seconds < 3600) {
        return round($seconds / 60, 2) . ' ' . __('minutos', 'sync-erp-wc');
    } else {
        return round($seconds / 3600, 2) . ' ' . __('horas', 'sync-erp-wc');
    }
}

/**
 * Format file size
 */
function sync_erp_format_file_size($bytes) {
    $units = array('B', 'KB', 'MB', 'GB');
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, 2) . ' ' . $units[$pow];
}

/**
 * Get product by internal code
 */
function sync_erp_get_product_by_code($cod_interno) {
    global $wpdb;
    
    $product_id = $wpdb->get_var($wpdb->prepare(
        "SELECT post_id FROM {$wpdb->postmeta} 
         WHERE meta_key = 'cod_interno' AND meta_value = %s",
        $cod_interno
    ));
    
    return $product_id ? wc_get_product($product_id) : false;
}

/**
 * Get product internal code
 */
function sync_erp_get_product_code($product_id) {
    return get_post_meta($product_id, 'cod_interno', true);
}

/**
 * Check if product is synced
 */
function sync_erp_is_product_synced($product_id) {
    $cod_interno = sync_erp_get_product_code($product_id);
    return !empty($cod_interno);
}

/**
 * Get sync statistics
 */
function sync_erp_get_sync_stats($period = '24h') {
    global $wpdb;
    
    $hours_map = array(
        '1h' => 1,
        '24h' => 24,
        '7d' => 168,
        '30d' => 720
    );
    
    $hours = $hours_map[$period] ?? 24;
    
    return $wpdb->get_row($wpdb->prepare(
        "SELECT 
            COUNT(*) as total_syncs,
            SUM(products_created) as total_created,
            SUM(products_updated) as total_updated,
            SUM(products_deleted) as total_deleted,
            SUM(errors) as total_errors,
            AVG(duration_seconds) as avg_duration
         FROM {$wpdb->prefix}sync_erp_stats 
         WHERE sync_date >= DATE_SUB(NOW(), INTERVAL %d HOUR)",
        $hours
    ));
}

/**
 * Get recent sync activities
 */
function sync_erp_get_recent_activities($limit = 10) {
    global $wpdb;
    
    return $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}sync_erp_stats 
         ORDER BY sync_date DESC 
         LIMIT %d",
        $limit
    ));
}

/**
 * Get error count
 */
function sync_erp_get_error_count($hours = 24) {
    return SyncERP_Logger::get_error_count($hours);
}

/**
 * Get warning count
 */
function sync_erp_get_warning_count($hours = 24) {
    return SyncERP_Logger::get_warning_count($hours);
}

/**
 * Check if WooCommerce is active and compatible
 */
function sync_erp_is_woocommerce_compatible() {
    if (!class_exists('WooCommerce')) {
        return false;
    }
    
    $wc_version = defined('WC_VERSION') ? WC_VERSION : '0.0.0';
    return version_compare($wc_version, '5.0.0', '>=');
}

/**
 * Get plugin status
 */
function sync_erp_get_plugin_status() {
    return array(
        'plugin_version' => SYNC_ERP_WC_VERSION,
        'wordpress_version' => get_bloginfo('version'),
        'woocommerce_version' => defined('WC_VERSION') ? WC_VERSION : null,
        'php_version' => PHP_VERSION,
        'auto_sync_enabled' => sync_erp_is_auto_sync_enabled(),
        'backend_url' => sync_erp_get_backend_url(),
        'has_api_key' => !empty(sync_erp_get_api_key()),
        'product_count' => wp_count_posts('product')->publish ?? 0,
        'recent_errors' => sync_erp_get_error_count(24),
        'recent_warnings' => sync_erp_get_warning_count(24)
    );
}

/**
 * Send test notification
 */
function sync_erp_send_test_notification() {
    if (!sync_erp_are_notifications_enabled()) {
        return false;
    }
    
    $email = sync_erp_get_option('notification_email', get_option('admin_email'));
    
    if (empty($email)) {
        return false;
    }
    
    $subject = sprintf(__('Prueba de Notificación - Sincronizador ERP (%s)', 'sync-erp-wc'), get_bloginfo('name'));
    $message = __('Esta es una prueba de notificación del plugin Sincronizador ERP. Si recibes este email, las notificaciones están funcionando correctamente.', 'sync-erp-wc');
    
    return wp_mail($email, $subject, $message);
}

/**
 * Clean up old data
 */
function sync_erp_cleanup_old_data() {
    global $wpdb;
    
    $results = array(
        'logs_deleted' => 0,
        'stats_deleted' => 0
    );
    
    // Clean old logs (older than 30 days)
    $logs_deleted = $wpdb->query(
        "DELETE FROM {$wpdb->prefix}sync_erp_logs 
         WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    $results['logs_deleted'] = $logs_deleted ?: 0;
    
    // Clean old stats (older than 90 days)
    $stats_deleted = $wpdb->query(
        "DELETE FROM {$wpdb->prefix}sync_erp_stats 
         WHERE sync_date < DATE_SUB(NOW(), INTERVAL 90 DAY)"
    );
    $results['stats_deleted'] = $stats_deleted ?: 0;
    
    if ($results['logs_deleted'] > 0 || $results['stats_deleted'] > 0) {
        SyncERP_Logger::log('Limpieza automática completada', 'info', $results, 'cleanup');
    }
    
    return $results;
}

/**
 * Export sync data to CSV
 */
function sync_erp_export_sync_data($start_date = null, $end_date = null) {
    global $wpdb;
    
    $where_conditions = array('1=1');
    $params = array();
    
    if ($start_date) {
        $where_conditions[] = 'sync_date >= %s';
        $params[] = $start_date;
    }
    
    if ($end_date) {
        $where_conditions[] = 'sync_date <= %s';
        $params[] = $end_date;
    }
    
    $where_clause = implode(' AND ', $where_conditions);
    
    $query = "SELECT * FROM {$wpdb->prefix}sync_erp_stats WHERE {$where_clause} ORDER BY sync_date DESC";
    
    if (!empty($params)) {
        $query = $wpdb->prepare($query, $params);
    }
    
    $data = $wpdb->get_results($query, ARRAY_A);
    
    if (empty($data)) {
        return false;
    }
    
    $filename = 'sync-erp-data-' . date('Y-m-d-H-i-s') . '.csv';
    $upload_dir = wp_upload_dir();
    $filepath = $upload_dir['path'] . '/' . $filename;
    
    $file = fopen($filepath, 'w');
    if (!$file) {
        return false;
    }
    
    // Write CSV header
    if (!empty($data)) {
        fputcsv($file, array_keys($data[0]));
    }
    
    // Write data
    foreach ($data as $row) {
        fputcsv($file, $row);
    }
    
    fclose($file);
    
    return array(
        'filename' => $filename,
        'filepath' => $filepath,
        'url' => $upload_dir['url'] . '/' . $filename,
        'size' => filesize($filepath),
        'count' => count($data)
    );
}

/**
 * Validate API key format
 */
function sync_erp_validate_api_key($api_key) {
    return preg_match('/^[a-zA-Z0-9]{32}$/', $api_key);
}

/**
 * Generate random API key
 */
function sync_erp_generate_api_key() {
    return wp_generate_password(32, false);
}

/**
 * Test backend connection
 */
function sync_erp_test_backend_connection() {
    try {
        $backend_url = sync_erp_get_backend_url();
        $api_key = sync_erp_get_api_key();
        
        if (empty($backend_url)) {
            throw new Exception(__('URL del backend no configurada', 'sync-erp-wc'));
        }
        
        $response = wp_remote_get($backend_url . '/health', array(
            'timeout' => 10,
            'headers' => array(
                'X-API-Key' => $api_key
            ),
            'sslverify' => false
        ));
        
        if (is_wp_error($response)) {
            throw new Exception($response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            throw new Exception("HTTP Error: {$status_code}");
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception(__('Respuesta inválida del backend', 'sync-erp-wc'));
        }
        
        return array(
            'success' => true,
            'data' => $data,
            'response_time' => wp_remote_retrieve_header($response, 'X-Response-Time')
        );
        
    } catch (Exception $e) {
        return array(
            'success' => false,
            'error' => $e->getMessage()
        );
    }
}

/**
 * Get sync health status
 */
function sync_erp_get_health_status() {
    $status = array(
        'overall' => 'good',
        'checks' => array()
    );
    
    // Check WooCommerce
    $status['checks']['woocommerce'] = array(
        'label' => __('WooCommerce', 'sync-erp-wc'),
        'status' => sync_erp_is_woocommerce_compatible() ? 'good' : 'error',
        'message' => sync_erp_is_woocommerce_compatible() 
            ? __('WooCommerce está activo y es compatible', 'sync-erp-wc')
            : __('WooCommerce no está activo o no es compatible', 'sync-erp-wc')
    );
    
    // Check backend connection
    $backend_test = sync_erp_test_backend_connection();
    $status['checks']['backend'] = array(
        'label' => __('Conexión Backend', 'sync-erp-wc'),
        'status' => $backend_test['success'] ? 'good' : 'error',
        'message' => $backend_test['success'] 
            ? __('Conexión exitosa con el backend', 'sync-erp-wc')
            : $backend_test['error']
    );
    
    // Check recent errors
    $error_count = sync_erp_get_error_count(24);
    $status['checks']['errors'] = array(
        'label' => __('Errores Recientes', 'sync-erp-wc'),
        'status' => $error_count === 0 ? 'good' : ($error_count < 5 ? 'warning' : 'error'),
        'message' => sprintf(__('%d errores en las últimas 24 horas', 'sync-erp-wc'), $error_count)
    );
    
    // Check configuration
    $has_api_key = !empty(sync_erp_get_api_key());
    $has_backend_url = !empty(sync_erp_get_backend_url());
    $config_ok = $has_api_key && $has_backend_url;
    
    $status['checks']['configuration'] = array(
        'label' => __('Configuración', 'sync-erp-wc'),
        'status' => $config_ok ? 'good' : 'warning',
        'message' => $config_ok 
            ? __('Configuración completa', 'sync-erp-wc')
            : __('Configuración incompleta', 'sync-erp-wc')
    );
    
    // Determine overall status
    $error_checks = array_filter($status['checks'], function($check) {
        return $check['status'] === 'error';
    });
    
    $warning_checks = array_filter($status['checks'], function($check) {
        return $check['status'] === 'warning';
    });
    
    if (!empty($error_checks)) {
        $status['overall'] = 'error';
    } elseif (!empty($warning_checks)) {
        $status['overall'] = 'warning';
    }
    
    return $status;
}

/**
 * Display admin notice
 */
function sync_erp_admin_notice($message, $type = 'info', $dismissible = true) {
    $class = 'notice notice-' . $type;
    if ($dismissible) {
        $class .= ' is-dismissible';
    }
    
    printf('<div class="%s"><p>%s</p></div>', esc_attr($class), esc_html($message));
}

/**
 * Schedule cleanup event
 */
function sync_erp_schedule_cleanup() {
    if (!wp_next_scheduled('sync_erp_cleanup')) {
        wp_schedule_event(time(), 'daily', 'sync_erp_cleanup');
    }
}

/**
 * Unschedule cleanup event
 */
function sync_erp_unschedule_cleanup() {
    $timestamp = wp_next_scheduled('sync_erp_cleanup');
    if ($timestamp) {
        wp_unschedule_event($timestamp, 'sync_erp_cleanup');
    }
}

// Hook cleanup function
add_action('sync_erp_cleanup', 'sync_erp_cleanup_old_data');

/**
 * Get dashboard widget data
 */
function sync_erp_get_dashboard_widget_data() {
    $stats = sync_erp_get_sync_stats('24h');
    $health = sync_erp_get_health_status();
    $recent_activity = sync_erp_get_recent_activities(3);
    
    return array(
        'stats' => $stats,
        'health' => $health,
        'recent_activity' => $recent_activity,
        'auto_sync_enabled' => sync_erp_is_auto_sync_enabled()
    );
}

/**
 * Add dashboard widget
 */
function sync_erp_add_dashboard_widget() {
    wp_add_dashboard_widget(
        'sync_erp_dashboard_widget',
        __('Sincronizador ERP', 'sync-erp-wc'),
        'sync_erp_dashboard_widget_content'
    );
}

/**
 * Dashboard widget content
 */
function sync_erp_dashboard_widget_content() {
    $data = sync_erp_get_dashboard_widget_data();
    ?>
    <div class="sync-erp-widget">
        <div class="sync-erp-widget-status">
            <span class="status-indicator status-<?php echo esc_attr($data['health']['overall']); ?>"></span>
            <strong><?php echo $data['auto_sync_enabled'] ? __('Sincronización Activa', 'sync-erp-wc') : __('Sincronización Desactivada', 'sync-erp-wc'); ?></strong>
        </div>
        
        <?php if ($data['stats']): ?>
        <div class="sync-erp-widget-stats">
            <div class="stat">
                <span class="number"><?php echo esc_html($data['stats']->total_created ?? 0); ?></span>
                <span class="label"><?php _e('Creados', 'sync-erp-wc'); ?></span>
            </div>
            <div class="stat">
                <span class="number"><?php echo esc_html($data['stats']->total_updated ?? 0); ?></span>
                <span class="label"><?php _e('Actualizados', 'sync-erp-wc'); ?></span>
            </div>
            <div class="stat">
                <span class="number error"><?php echo esc_html($data['stats']->total_errors ?? 0); ?></span>
                <span class="label"><?php _e('Errores', 'sync-erp-wc'); ?></span>
            </div>
        </div>
        <?php endif; ?>
        
        <div class="sync-erp-widget-actions">
            <a href="<?php echo admin_url('admin.php?page=sync-erp'); ?>" class="button">
                <?php _e('Ver Dashboard', 'sync-erp-wc'); ?>
            </a>
        </div>
    </div>
    
    <style>
    .sync-erp-widget {
        padding: 0;
    }
    .sync-erp-widget-status {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
    }
    .status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 8px;
    }
    .status-indicator.status-good { background: #46b450; }
    .status-indicator.status-warning { background: #f56e28; }
    .status-indicator.status-error { background: #dc3232; }
    .sync-erp-widget-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
    }
    .sync-erp-widget-stats .stat {
        text-align: center;
    }
    .sync-erp-widget-stats .number {
        display: block;
        font-size: 18px;
        font-weight: bold;
        color: #23282d;
    }
    .sync-erp-widget-stats .number.error {
        color: #dc3232;
    }
    .sync-erp-widget-stats .label {
        display: block;
        font-size: 12px;
        color: #646970;
    }
    </style>
    <?php
}

// Hook dashboard widget
add_action('wp_dashboard_setup', 'sync_erp_add_dashboard_widget');