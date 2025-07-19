<?php
/**
 * API class for Sync ERP WooCommerce plugin
 * Handles REST API endpoints and webhook communications
 * 
 * @package SyncERPWooCommerce
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class SyncERP_API {
    
    /**
     * API namespace
     */
    const API_NAMESPACE = 'sync-erp/v1';
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('init', array($this, 'add_cors_headers'));
    }
    
    /**
     * Add CORS headers for API requests
     */
    public function add_cors_headers() {
        if (defined('REST_REQUEST') && REST_REQUEST) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
        }
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Health check endpoint
        register_rest_route(self::API_NAMESPACE, '/health', array(
            'methods' => 'GET',
            'callback' => array($this, 'health_check'),
            'permission_callback' => '__return_true'
        ));
        
        // Sync endpoints
        register_rest_route(self::API_NAMESPACE, '/sync/trigger', array(
            'methods' => 'POST',
            'callback' => array($this, 'trigger_sync'),
            'permission_callback' => array($this, 'check_api_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/sync/status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_sync_status'),
            'permission_callback' => array($this, 'check_api_permissions')
        ));
        
        // Product endpoints
        register_rest_route(self::API_NAMESPACE, '/products/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync_products'),
            'permission_callback' => array($this, 'check_api_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/products/delete', array(
            'methods' => 'POST',
            'callback' => array($this, 'delete_product'),
            'permission_callback' => array($this, 'check_api_permissions'),
            'args' => array(
                'product_code' => array(
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field'
                ),
                'reason' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_textarea_field',
                    'default' => ''
                )
            )
        ));
        
        register_rest_route(self::API_NAMESPACE, '/products/restore', array(
            'methods' => 'POST',
            'callback' => array($this, 'restore_product'),
            'permission_callback' => array($this, 'check_api_permissions'),
            'args' => array(
                'product_code' => array(
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field'
                )
            )
        ));
        
        register_rest_route(self::API_NAMESPACE, '/products/deleted', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_deleted_products'),
            'permission_callback' => array($this, 'check_api_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/products/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_product'),
            'permission_callback' => array($this, 'check_api_permissions'),
            'args' => array(
                'id' => array(
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // Order endpoints
        register_rest_route(self::API_NAMESPACE, '/orders/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync_orders'),
            'permission_callback' => array($this, 'check_api_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/orders/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_order'),
            'permission_callback' => array($this, 'check_api_permissions'),
            'args' => array(
                'id' => array(
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // Statistics endpoints
        register_rest_route(self::API_NAMESPACE, '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => array($this, 'check_api_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/stats/detailed', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_detailed_stats'),
            'permission_callback' => array($this, 'check_api_permissions'),
            'args' => array(
                'period' => array(
                    'required' => false,
                    'type' => 'string',
                    'default' => '24h',
                    'enum' => array('1h', '24h', '7d', '30d')
                )
            )
        ));
        
        // Logs endpoints
        register_rest_route(self::API_NAMESPACE, '/logs', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_logs'),
            'permission_callback' => array($this, 'check_api_permissions'),
            'args' => array(
                'limit' => array(
                    'required' => false,
                    'type' => 'integer',
                    'default' => 50,
                    'minimum' => 1,
                    'maximum' => 1000
                ),
                'level' => array(
                    'required' => false,
                    'type' => 'string',
                    'enum' => array('debug', 'info', 'warning', 'error')
                )
            )
        ));
        
        // Webhook endpoints
        register_rest_route(self::API_NAMESPACE, '/webhook/product-updated', array(
            'methods' => 'POST',
            'callback' => array($this, 'webhook_product_updated'),
            'permission_callback' => array($this, 'check_webhook_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/webhook/product-deleted', array(
            'methods' => 'POST',
            'callback' => array($this, 'webhook_product_deleted'),
            'permission_callback' => array($this, 'check_webhook_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/webhook/stock-updated', array(
            'methods' => 'POST',
            'callback' => array($this, 'webhook_stock_updated'),
            'permission_callback' => array($this, 'check_webhook_permissions')
        ));
        
        // Configuration endpoints
        register_rest_route(self::API_NAMESPACE, '/config', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_config'),
            'permission_callback' => array($this, 'check_admin_permissions')
        ));
        
        register_rest_route(self::API_NAMESPACE, '/config', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_config'),
            'permission_callback' => array($this, 'check_admin_permissions')
        ));
    }
    
    /**
     * Check API permissions
     */
    public function check_api_permissions($request) {
        // Check API key
        $api_key = $request->get_header('X-API-Key');
        $stored_key = get_option('sync_erp_api_key');
        
        if (!empty($api_key) && $api_key === $stored_key) {
            return true;
        }
        
        // Check user permissions
        return current_user_can('manage_woocommerce');
    }
    
    /**
     * Check webhook permissions (more lenient)
     */
    public function check_webhook_permissions($request) {
        // Allow webhook access with API key or from localhost
        $api_key = $request->get_header('X-API-Key');
        $stored_key = get_option('sync_erp_api_key');
        
        if (!empty($api_key) && $api_key === $stored_key) {
            return true;
        }
        
        // Allow from localhost/backend server
        $remote_ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $allowed_ips = array('127.0.0.1', '::1', 'localhost');
        
        return in_array($remote_ip, $allowed_ips) || current_user_can('manage_woocommerce');
    }
    
    /**
     * Check admin permissions
     */
    public function check_admin_permissions($request) {
        return current_user_can('manage_options');
    }
    
    /**
     * Health check endpoint
     */
    public function health_check($request) {
        $health_data = array(
            'status' => 'OK',
            'timestamp' => current_time('mysql'),
            'version' => SYNC_ERP_WC_VERSION,
            'wordpress_version' => get_bloginfo('version'),
            'woocommerce_version' => defined('WC_VERSION') ? WC_VERSION : 'Not installed',
            'php_version' => PHP_VERSION,
            'services' => array(
                'database' => $this->check_database_connection(),
                'woocommerce' => class_exists('WooCommerce'),
                'sync_enabled' => get_option('sync_erp_auto_sync') === 'yes'
            ),
            'stats' => array(
                'total_products' => wp_count_posts('product')->publish,
                'recent_errors' => SyncERP_Logger::get_error_count(24),
                'recent_warnings' => SyncERP_Logger::get_warning_count(24)
            )
        );
        
        return new WP_REST_Response($health_data, 200);
    }
    
    /**
     * Trigger synchronization
     */
    public function trigger_sync($request) {
        try {
            SyncERP_Logger::log('Sincronización iniciada vía API', 'info', array('source' => 'api'));
            
            $sync = new SyncERP_ProductSync();
            $result = $sync->manual_sync();
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => __('Sincronización iniciada exitosamente', 'sync-erp-wc'),
                'data' => $result
            ), 200);
            
        } catch (Exception $e) {
            SyncERP_Logger::error('Error en sincronización vía API: ' . $e->getMessage());
            
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 500);
        }
    }
    
    /**
     * Get sync status
     */
    public function get_sync_status($request) {
        global $wpdb;
        
        // Get last sync
        $last_sync = $wpdb->get_row(
            "SELECT * FROM {$wpdb->prefix}sync_erp_stats 
             ORDER BY sync_date DESC LIMIT 1"
        );
        
        // Check if sync is currently running (simple check)
        $is_running = get_transient('sync_erp_running');
        
        return new WP_REST_Response(array(
            'is_running' => (bool) $is_running,
            'auto_sync_enabled' => get_option('sync_erp_auto_sync') === 'yes',
            'last_sync' => $last_sync ? array(
                'date' => $last_sync->sync_date,
                'products_synced' => $last_sync->products_synced,
                'errors' => $last_sync->errors,
                'duration' => $last_sync->duration_seconds
            ) : null
        ), 200);
    }
    
    /**
     * Sync products endpoint
     */
    public function sync_products($request) {
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->manual_sync();
            
            return new WP_REST_Response(array(
                'success' => true,
                'data' => $result
            ), 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 500);
        }
    }
    
    /**
     * Delete product endpoint
     */
    public function delete_product($request) {
        $product_code = $request['product_code'];
        $reason = $request['reason'];
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->delete_product($product_code, $reason);
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => sprintf(__('Producto %s eliminado exitosamente', 'sync-erp-wc'), $product_code),
                'data' => $result
            ), 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 400);
        }
    }
    
    /**
     * Restore product endpoint
     */
    public function restore_product($request) {
        $product_code = $request['product_code'];
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->restore_product($product_code);
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => sprintf(__('Producto %s restaurado exitosamente', 'sync-erp-wc'), $product_code),
                'data' => $result
            ), 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 400);
        }
    }
    
    /**
     * Get deleted products
     */
    public function get_deleted_products($request) {
        global $wpdb;
        
        $deleted_products = $wpdb->get_results(
            "SELECT 
                p.ID,
                p.post_title,
                p.post_modified,
                pm1.meta_value as cod_interno,
                pm2.meta_value as deletion_reason,
                pm3.meta_value as deletion_date
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'cod_interno'
             LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'deletion_reason'
             LEFT JOIN {$wpdb->postmeta} pm3 ON p.ID = pm3.post_id AND pm3.meta_key = 'deletion_date'
             WHERE p.post_type = 'product' 
             AND p.post_status IN ('trash', 'private')
             ORDER BY p.post_modified DESC
             LIMIT 100"
        );
        
        return new WP_REST_Response(array(
            'success' => true,
            'products' => $deleted_products,
            'count' => count($deleted_products)
        ), 200);
    }
    
    /**
     * Get single product
     */
    public function get_product($request) {
        $product_id = $request['id'];
        
        $product = wc_get_product($product_id);
        if (!$product) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => __('Producto no encontrado', 'sync-erp-wc')
            ), 404);
        }
        
        $product_data = array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'status' => $product->get_status(),
            'stock_status' => $product->get_stock_status(),
            'stock_quantity' => $product->get_stock_quantity(),
            'cod_interno' => get_post_meta($product_id, 'cod_interno', true),
            'last_modified' => $product->get_date_modified() ? $product->get_date_modified()->date('Y-m-d H:i:s') : null
        );
        
        return new WP_REST_Response(array(
            'success' => true,
            'product' => $product_data
        ), 200);
    }
    
    /**
     * Sync orders endpoint
     */
    public function sync_orders($request) {
        try {
            $order_sync = new SyncERP_OrderSync();
            $result = $order_sync->sync_pending_orders();
            
            return new WP_REST_Response(array(
                'success' => true,
                'data' => $result
            ), 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 500);
        }
    }
    
    /**
     * Get single order
     */
    public function get_order($request) {
        $order_id = $request['id'];
        
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => __('Orden no encontrada', 'sync-erp-wc')
            ), 404);
        }
        
        $order_data = array(
            'id' => $order->get_id(),
            'status' => $order->get_status(),
            'total' => $order->get_total(),
            'currency' => $order->get_currency(),
            'date_created' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d H:i:s') : null,
            'customer_id' => $order->get_customer_id(),
            'billing' => $order->get_billing_email(),
            'items' => array()
        );
        
        foreach ($order->get_items() as $item) {
            $order_data['items'][] = array(
                'product_id' => $item->get_product_id(),
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => $item->get_total()
            );
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'order' => $order_data
        ), 200);
    }
    
    /**
     * Get statistics
     */
    public function get_stats($request) {
        global $wpdb;
        
        // Get recent stats
        $recent_stats = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}sync_erp_stats 
             ORDER BY sync_date DESC LIMIT 10"
        );
        
        // Get summary stats for last 24 hours
        $summary = $wpdb->get_row(
            "SELECT 
                COUNT(*) as total_syncs,
                SUM(products_created) as total_created,
                SUM(products_updated) as total_updated,
                SUM(products_deleted) as total_deleted,
                SUM(errors) as total_errors,
                AVG(duration_seconds) as avg_duration
             FROM {$wpdb->prefix}sync_erp_stats 
             WHERE sync_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        
        return new WP_REST_Response(array(
            'success' => true,
            'recent' => $recent_stats,
            'summary' => $summary,
            'timestamp' => current_time('mysql')
        ), 200);
    }
    
    /**
     * Get detailed statistics
     */
    public function get_detailed_stats($request) {
        $period = $request['period'];
        
        // Convert period to hours
        $hours_map = array(
            '1h' => 1,
            '24h' => 24,
            '7d' => 168,
            '30d' => 720
        );
        
        $hours = $hours_map[$period] ?? 24;
        
        global $wpdb;
        
        $stats = array(
            'period' => $period,
            'log_stats' => SyncERP_Logger::get_log_stats($hours),
            'sync_timeline' => $wpdb->get_results($wpdb->prepare(
                "SELECT 
                    DATE(sync_date) as date,
                    SUM(products_created) as created,
                    SUM(products_updated) as updated,
                    SUM(products_deleted) as deleted,
                    SUM(errors) as errors,
                    COUNT(*) as total_syncs
                 FROM {$wpdb->prefix}sync_erp_stats 
                 WHERE sync_date >= DATE_SUB(NOW(), INTERVAL %d HOUR)
                 GROUP BY DATE(sync_date)
                 ORDER BY date ASC",
                $hours
            )),
            'product_count' => wp_count_posts('product'),
            'order_count' => wp_count_posts('shop_order')
        );
        
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $stats
        ), 200);
    }
    
    /**
     * Get logs
     */
    public function get_logs($request) {
        $limit = $request['limit'];
        $level = $request['level'];
        
        $logs = SyncERP_Logger::get_recent_logs($limit, $level);
        
        $formatted_logs = array();
        foreach ($logs as $log) {
            $formatted_logs[] = SyncERP_Logger::format_log_message($log);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'logs' => $formatted_logs,
            'count' => count($formatted_logs)
        ), 200);
    }
    
    /**
     * Webhook: Product updated
     */
    public function webhook_product_updated($request) {
        $data = $request->get_json_params();
        
        SyncERP_Logger::log('Webhook producto actualizado recibido', 'info', $data, 'webhook');
        
        // Process product update from ERP
        // This would typically trigger a product sync
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Webhook procesado', 'sync-erp-wc')
        ), 200);
    }
    
    /**
     * Webhook: Product deleted
     */
    public function webhook_product_deleted($request) {
        $data = $request->get_json_params();
        
        if (!isset($data['art_cod_int'])) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => __('Código de producto requerido', 'sync-erp-wc')
            ), 400);
        }
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->delete_product($data['art_cod_int'], $data['reason'] ?? 'Eliminado vía webhook');
            
            SyncERP_Logger::log('Webhook producto eliminado procesado', 'info', $data, 'webhook');
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => __('Producto eliminado vía webhook', 'sync-erp-wc'),
                'data' => $result
            ), 200);
            
        } catch (Exception $e) {
            SyncERP_Logger::error('Error procesando webhook de eliminación: ' . $e->getMessage(), $data);
            
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 500);
        }
    }
    
    /**
     * Webhook: Stock updated
     */
    public function webhook_stock_updated($request) {
        $data = $request->get_json_params();
        
        SyncERP_Logger::log('Webhook stock actualizado recibido', 'info', $data, 'webhook');
        
        // Process stock update
        if (isset($data['art_cod_int']) && isset($data['stock_data'])) {
            try {
                $stock_sync = new SyncERP_StockSync();
                $result = $stock_sync->update_product_stock($data['art_cod_int'], $data['stock_data']);
                
                return new WP_REST_Response(array(
                    'success' => true,
                    'message' => __('Stock actualizado vía webhook', 'sync-erp-wc'),
                    'data' => $result
                ), 200);
                
            } catch (Exception $e) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => $e->getMessage()
                ), 500);
            }
        }
        
        return new WP_REST_Response(array(
            'success' => false,
            'message' => __('Datos de stock incompletos', 'sync-erp-wc')
        ), 400);
    }
    
    /**
     * Get configuration
     */
    public function get_config($request) {
        $config = array(
            'backend_url' => get_option('sync_erp_backend_url'),
            'auto_sync' => get_option('sync_erp_auto_sync') === 'yes',
            'sync_interval' => get_option('sync_erp_sync_interval'),
            'notifications' => get_option('sync_erp_notifications') === 'yes',
            'email_notifications' => get_option('sync_erp_email_notifications') === 'yes',
            'notification_email' => get_option('sync_erp_notification_email'),
            'log_level' => get_option('sync_erp_log_level')
        );
        
        return new WP_REST_Response(array(
            'success' => true,
            'config' => $config
        ), 200);
    }
    
    /**
     * Update configuration
     */
    public function update_config($request) {
        $data = $request->get_json_params();
        
        $allowed_options = array(
            'sync_erp_backend_url',
            'sync_erp_auto_sync',
            'sync_erp_sync_interval',
            'sync_erp_notifications',
            'sync_erp_email_notifications',
            'sync_erp_notification_email',
            'sync_erp_log_level'
        );
        
        foreach ($data as $key => $value) {
            $option_key = 'sync_erp_' . $key;
            if (in_array($option_key, $allowed_options)) {
                update_option($option_key, $value);
            }
        }
        
        SyncERP_Logger::log('Configuración actualizada vía API', 'info', $data, 'api');
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Configuración actualizada', 'sync-erp-wc')
        ), 200);
    }
    
    /**
     * Check database connection
     */
    private function check_database_connection() {
        global $wpdb;
        
        try {
            $result = $wpdb->get_var("SELECT 1");
            return $result === '1';
        } catch (Exception $e) {
            return false;
        }
    }
}