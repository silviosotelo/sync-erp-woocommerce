<?php
/**
 * Logger class for Sync ERP WooCommerce plugin
 * 
 * @package SyncERPWooCommerce
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class SyncERP_Logger {
    
    /**
     * Log levels
     */
    const LEVEL_DEBUG = 'debug';
    const LEVEL_INFO = 'info';
    const LEVEL_WARNING = 'warning';
    const LEVEL_ERROR = 'error';
    
    /**
     * Current log level
     * @var string
     */
    private static $current_level = null;
    
    /**
     * Log level hierarchy
     * @var array
     */
    private static $level_hierarchy = array(
        'debug' => 0,
        'info' => 1,
        'warning' => 2,
        'error' => 3
    );
    
    /**
     * Constructor
     */
    public function __construct() {
        // Clean up old logs periodically
        add_action('sync_erp_cleanup_logs', array($this, 'cleanup_old_logs'));
        
        // Schedule cleanup if not already scheduled
        if (!wp_next_scheduled('sync_erp_cleanup_logs')) {
            wp_schedule_event(time(), 'daily', 'sync_erp_cleanup_logs');
        }
    }
    
    /**
     * Get current log level
     */
    private static function get_current_level() {
        if (self::$current_level === null) {
            self::$current_level = get_option('sync_erp_log_level', self::LEVEL_INFO);
        }
        return self::$current_level;
    }
    
    /**
     * Check if a message should be logged based on current level
     */
    private static function should_log($level) {
        $current_level = self::get_current_level();
        
        if (!isset(self::$level_hierarchy[$level]) || !isset(self::$level_hierarchy[$current_level])) {
            return true; // Log unknown levels by default
        }
        
        return self::$level_hierarchy[$level] >= self::$level_hierarchy[$current_level];
    }
    
    /**
     * Main logging method
     */
    public static function log($message, $level = self::LEVEL_INFO, $context = null, $source = 'sync-erp') {
        // Check if we should log this level
        if (!self::should_log($level)) {
            return;
        }
        
        global $wpdb;
        
        // Prepare context data
        $context_json = null;
        if ($context !== null) {
            $context_json = wp_json_encode($context, JSON_UNESCAPED_UNICODE);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $context_json = 'JSON Error: ' . json_last_error_msg();
            }
        }
        
        // Insert into database
        $result = $wpdb->insert(
            $wpdb->prefix . 'sync_erp_logs',
            array(
                'timestamp' => current_time('mysql'),
                'level' => strtoupper($level),
                'message' => $message,
                'context' => $context_json,
                'source' => $source
            ),
            array('%s', '%s', '%s', '%s', '%s')
        );
        
        // Also log to WordPress debug log if WP_DEBUG is enabled
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $debug_message = sprintf(
                '[SYNC-ERP] [%s] %s',
                strtoupper($level),
                $message
            );
            
            if ($context) {
                $debug_message .= ' | Context: ' . wp_json_encode($context);
            }
            
            error_log($debug_message);
        }
        
        // Send critical errors to admin email if enabled
        if ($level === self::LEVEL_ERROR && get_option('sync_erp_email_notifications') === 'yes') {
            self::send_error_email($message, $context);
        }
        
        return $result !== false;
    }
    
    /**
     * Log debug message
     */
    public static function debug($message, $context = null, $source = 'sync-erp') {
        return self::log($message, self::LEVEL_DEBUG, $context, $source);
    }
    
    /**
     * Log info message
     */
    public static function info($message, $context = null, $source = 'sync-erp') {
        return self::log($message, self::LEVEL_INFO, $context, $source);
    }
    
    /**
     * Log warning message
     */
    public static function warning($message, $context = null, $source = 'sync-erp') {
        return self::log($message, self::LEVEL_WARNING, $context, $source);
    }
    
    /**
     * Log error message
     */
    public static function error($message, $context = null, $source = 'sync-erp') {
        return self::log($message, self::LEVEL_ERROR, $context, $source);
    }
    
    /**
     * Get recent logs
     */
    public static function get_recent_logs($limit = 50, $level = null) {
        global $wpdb;
        
        $where_clause = '';
        $params = array();
        
        if ($level) {
            $where_clause = 'WHERE level = %s';
            $params[] = strtoupper($level);
        }
        
        $params[] = $limit;
        
        $query = "SELECT * FROM {$wpdb->prefix}sync_erp_logs 
                  $where_clause 
                  ORDER BY timestamp DESC 
                  LIMIT %d";
        
        return $wpdb->get_results($wpdb->prepare($query, $params));
    }
    
    /**
     * Get logs by date range
     */
    public static function get_logs_by_date($start_date, $end_date = null, $level = null) {
        global $wpdb;
        
        $where_conditions = array('timestamp >= %s');
        $params = array($start_date);
        
        if ($end_date) {
            $where_conditions[] = 'timestamp <= %s';
            $params[] = $end_date;
        }
        
        if ($level) {
            $where_conditions[] = 'level = %s';
            $params[] = strtoupper($level);
        }
        
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        
        $query = "SELECT * FROM {$wpdb->prefix}sync_erp_logs 
                  $where_clause 
                  ORDER BY timestamp DESC";
        
        return $wpdb->get_results($wpdb->prepare($query, $params));
    }
    
    /**
     * Get log statistics
     */
    public static function get_log_stats($hours = 24) {
        global $wpdb;
        
        $stats = $wpdb->get_results($wpdb->prepare(
            "SELECT 
                level,
                COUNT(*) as count
             FROM {$wpdb->prefix}sync_erp_logs 
             WHERE timestamp >= DATE_SUB(NOW(), INTERVAL %d HOUR)
             GROUP BY level
             ORDER BY count DESC",
            $hours
        ));
        
        $formatted_stats = array();
        foreach ($stats as $stat) {
            $formatted_stats[strtolower($stat->level)] = $stat->count;
        }
        
        // Ensure all levels are present
        $levels = array('debug', 'info', 'warning', 'error');
        foreach ($levels as $level) {
            if (!isset($formatted_stats[$level])) {
                $formatted_stats[$level] = 0;
            }
        }
        
        return $formatted_stats;
    }
    
    /**
     * Clear all logs
     */
    public static function clear_logs() {
        global $wpdb;
        
        $result = $wpdb->query("TRUNCATE TABLE {$wpdb->prefix}sync_erp_logs");
        
        if ($result !== false) {
            self::log('Logs limpiados por administrador', self::LEVEL_INFO, null, 'admin');
        }
        
        return $result !== false;
    }
    
    /**
     * Clean up old logs (keep only last 30 days by default)
     */
    public function cleanup_old_logs($days = 30) {
        global $wpdb;
        
        $deleted = $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}sync_erp_logs 
             WHERE timestamp < DATE_SUB(NOW(), INTERVAL %d DAY)",
            $days
        ));
        
        if ($deleted > 0) {
            self::log("Limpieza automática: {$deleted} logs antiguos eliminados", self::LEVEL_INFO, array(
                'days_older_than' => $days,
                'deleted_count' => $deleted
            ), 'cleanup');
        }
        
        return $deleted;
    }
    
    /**
     * Export logs to CSV
     */
    public static function export_logs_csv($start_date = null, $end_date = null, $level = null) {
        $logs = self::get_logs_by_date($start_date ?: '1970-01-01', $end_date, $level);
        
        if (empty($logs)) {
            return false;
        }
        
        $filename = 'sync-erp-logs-' . date('Y-m-d-H-i-s') . '.csv';
        $filepath = wp_upload_dir()['path'] . '/' . $filename;
        
        $file = fopen($filepath, 'w');
        if (!$file) {
            return false;
        }
        
        // Write CSV header
        fputcsv($file, array('Timestamp', 'Level', 'Message', 'Source', 'Context'));
        
        // Write log entries
        foreach ($logs as $log) {
            fputcsv($file, array(
                $log->timestamp,
                $log->level,
                $log->message,
                $log->source,
                $log->context
            ));
        }
        
        fclose($file);
        
        return array(
            'filename' => $filename,
            'filepath' => $filepath,
            'url' => wp_upload_dir()['url'] . '/' . $filename,
            'count' => count($logs)
        );
    }
    
    /**
     * Send error email notification
     */
    private static function send_error_email($message, $context = null) {
        $email = get_option('sync_erp_notification_email', get_option('admin_email'));
        
        if (empty($email)) {
            return;
        }
        
        // Don't spam with too many error emails
        $last_error_email = get_transient('sync_erp_last_error_email');
        if ($last_error_email && (time() - $last_error_email) < 3600) { // 1 hour cooldown
            return;
        }
        
        $subject = sprintf(__('Error en Sincronizador ERP - %s', 'sync-erp-wc'), get_bloginfo('name'));
        
        $email_message = sprintf(
            __("Se ha detectado un error en el Sincronizador ERP:\n\n" .
               "Mensaje: %s\n\n" .
               "Contexto: %s\n\n" .
               "Fecha/Hora: %s\n\n" .
               "Por favor revisa los logs del plugin para más detalles.", 'sync-erp-wc'),
            $message,
            $context ? wp_json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : 'No disponible',
            current_time('mysql')
        );
        
        $sent = wp_mail($email, $subject, $email_message);
        
        if ($sent) {
            set_transient('sync_erp_last_error_email', time(), 3600);
        }
        
        return $sent;
    }
    
    /**
     * Get error count for dashboard
     */
    public static function get_error_count($hours = 24) {
        global $wpdb;
        
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}sync_erp_logs 
             WHERE level = 'ERROR' 
             AND timestamp >= DATE_SUB(NOW(), INTERVAL %d HOUR)",
            $hours
        ));
    }
    
    /**
     * Get warning count for dashboard
     */
    public static function get_warning_count($hours = 24) {
        global $wpdb;
        
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}sync_erp_logs 
             WHERE level = 'WARNING' 
             AND timestamp >= DATE_SUB(NOW(), INTERVAL %d HOUR)",
            $hours
        ));
    }
    
    /**
     * Log product sync event
     */
    public static function log_product_sync($product_code, $action, $success = true, $error_message = null, $additional_data = null) {
        $level = $success ? self::LEVEL_INFO : self::LEVEL_ERROR;
        $message = sprintf('Producto %s: %s', $product_code, $action);
        
        $context = array(
            'product_code' => $product_code,
            'action' => $action,
            'success' => $success
        );
        
        if ($error_message) {
            $context['error'] = $error_message;
            $message .= ' - Error: ' . $error_message;
        }
        
        if ($additional_data) {
            $context = array_merge($context, $additional_data);
        }
        
        return self::log($message, $level, $context, 'product-sync');
    }
    
    /**
     * Log order sync event
     */
    public static function log_order_sync($order_id, $action, $success = true, $error_message = null, $additional_data = null) {
        $level = $success ? self::LEVEL_INFO : self::LEVEL_ERROR;
        $message = sprintf('Orden %s: %s', $order_id, $action);
        
        $context = array(
            'order_id' => $order_id,
            'action' => $action,
            'success' => $success
        );
        
        if ($error_message) {
            $context['error'] = $error_message;
            $message .= ' - Error: ' . $error_message;
        }
        
        if ($additional_data) {
            $context = array_merge($context, $additional_data);
        }
        
        return self::log($message, $level, $context, 'order-sync');
    }
    
    /**
     * Log API communication
     */
    public static function log_api_request($endpoint, $method, $status_code, $response_time = null, $error = null) {
        $level = ($status_code >= 200 && $status_code < 300) ? self::LEVEL_DEBUG : self::LEVEL_WARNING;
        if ($status_code >= 400) {
            $level = self::LEVEL_ERROR;
        }
        
        $message = sprintf('API %s %s - Status: %d', $method, $endpoint, $status_code);
        
        $context = array(
            'endpoint' => $endpoint,
            'method' => $method,
            'status_code' => $status_code
        );
        
        if ($response_time) {
            $context['response_time_ms'] = $response_time;
            $message .= sprintf(' - Time: %.2fms', $response_time);
        }
        
        if ($error) {
            $context['error'] = $error;
            $message .= ' - Error: ' . $error;
        }
        
        return self::log($message, $level, $context, 'api');
    }
    
    /**
     * Format log message for display
     */
    public static function format_log_message($log) {
        $formatted = array(
            'timestamp' => date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($log->timestamp)),
            'level' => $log->level,
            'message' => $log->message,
            'source' => $log->source ?: 'sync-erp',
            'context' => null
        );
        
        if ($log->context) {
            $context = json_decode($log->context, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $formatted['context'] = $context;
            }
        }
        
        return $formatted;
    }
    
    /**
     * Get level color for UI
     */
    public static function get_level_color($level) {
        $colors = array(
            'DEBUG' => '#6c757d',
            'INFO' => '#17a2b8',
            'WARNING' => '#ffc107',
            'ERROR' => '#dc3545'
        );
        
        return $colors[strtoupper($level)] ?? '#6c757d';
    }
}