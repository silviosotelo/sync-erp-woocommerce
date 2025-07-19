<?php
/**
 * Plugin Name: Sincronizador ERP - WooCommerce
 * Plugin URI: https://farmatotal.com.py
 * Description: Plugin para sincronización bidireccional entre ERP y WooCommerce con dashboard de monitoreo
 * Version: 1.0.0
 * Author: Tu Empresa
 * Author URI: https://farmatotal.com.py
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: sync-erp-wc
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SYNC_ERP_WC_VERSION', '1.0.0');
define('SYNC_ERP_WC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SYNC_ERP_WC_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('SYNC_ERP_WC_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main plugin class
 */
class SyncERPWooCommerce {
    
    /**
     * Single instance of the plugin
     */
    private static $instance = null;
    
    /**
     * Get instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        add_action('plugins_loaded', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
        
        // Load text domain
        load_plugin_textdomain('sync-erp-wc', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Initialize components
        $this->includes();
        $this->init_hooks();
        
        // Initialize classes only if they exist
        if (class_exists('SyncERP_Admin')) {
            new SyncERP_Admin();
        }
        
        if (class_exists('SyncERP_API')) {
            new SyncERP_API();
        }
        
        if (class_exists('SyncERP_ProductSync')) {
            new SyncERP_ProductSync();
        }
        
        if (class_exists('SyncERP_OrderSync')) {
            new SyncERP_OrderSync();
        }
        
        if (class_exists('SyncERP_StockSync')) {
            new SyncERP_StockSync();
        }
        
        if (class_exists('SyncERP_Logger')) {
            new SyncERP_Logger();
        }
    }
    
    /**
     * Include required files
     */
    private function includes() {
        // Evitar múltiples inclusiones
        if (class_exists('SyncERP_Admin')) {
            return;
        }
        
        $includes = array(
            'includes/class-logger.php',
            'includes/class-admin.php',
            'includes/class-api.php',
            'includes/class-product-sync.php',
            'includes/class-order-sync.php',
            'includes/class-stock-sync.php',
            'includes/functions.php'
        );
        
        foreach ($includes as $file) {
            $file_path = SYNC_ERP_WC_PLUGIN_PATH . $file;
            if (file_exists($file_path)) {
                require_once $file_path;
            } else {
                // Log error if file doesn't exist
                error_log("Sync ERP Plugin: Missing file - " . $file_path);
            }
        }
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('init', array($this, 'init_api_endpoints'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        
        // AJAX hooks - only if classes exist
        if (class_exists('SyncERP_ProductSync')) {
            add_action('wp_ajax_sync_erp_manual_sync', array($this, 'handle_manual_sync'));
            add_action('wp_ajax_sync_erp_delete_product', array($this, 'handle_delete_product'));
            add_action('wp_ajax_sync_erp_restore_product', array($this, 'handle_restore_product'));
            add_action('wp_ajax_sync_erp_get_stats', array($this, 'handle_get_stats'));
        }
    }
    
    /**
     * Initialize API endpoints
     */
    public function init_api_endpoints() {
        add_action('rest_api_init', function() {
            register_rest_route('sync-erp/v1', '/sync', array(
                'methods' => 'POST',
                'callback' => array($this, 'api_trigger_sync'),
                'permission_callback' => array($this, 'api_permission_check')
            ));
            
            register_rest_route('sync-erp/v1', '/product/delete', array(
                'methods' => 'POST',
                'callback' => array($this, 'api_delete_product'),
                'permission_callback' => array($this, 'api_permission_check')
            ));
            
            register_rest_route('sync-erp/v1', '/product/restore', array(
                'methods' => 'POST',
                'callback' => array($this, 'api_restore_product'),
                'permission_callback' => array($this, 'api_permission_check')
            ));
            
            register_rest_route('sync-erp/v1', '/stats', array(
                'methods' => 'GET',
                'callback' => array($this, 'api_get_stats'),
                'permission_callback' => array($this, 'api_permission_check')
            ));
        });
    }
    
    /**
     * Enqueue frontend scripts
     */
    public function enqueue_scripts() {
        wp_enqueue_script(
            'sync-erp-frontend',
            SYNC_ERP_WC_PLUGIN_URL . 'assets/js/frontend.js',
            array('jquery'),
            SYNC_ERP_WC_VERSION,
            true
        );
        
        wp_localize_script('sync-erp-frontend', 'syncErpAjax', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sync_erp_nonce')
        ));
    }
    
    /**
     * Enqueue admin scripts
     */
    public function admin_enqueue_scripts($hook) {
        if (strpos($hook, 'sync-erp') === false) {
            return;
        }
        
        wp_enqueue_script(
            'sync-erp-admin',
            SYNC_ERP_WC_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'jquery-ui-core'),
            SYNC_ERP_WC_VERSION,
            true
        );
        
        wp_enqueue_style(
            'sync-erp-admin',
            SYNC_ERP_WC_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            SYNC_ERP_WC_VERSION
        );
        
        wp_localize_script('sync-erp-admin', 'syncErpAdmin', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sync_erp_admin_nonce'),
            'resturl' => rest_url('sync-erp/v1/'),
            'restnonce' => wp_create_nonce('wp_rest')
        ));
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Load required classes for activation
        $this->includes();
        
        // Create database tables
        $this->create_tables();
        
        // Set default options
        $default_options = array(
            'sync_erp_backend_url' => 'http://localhost:3001',
            'sync_erp_api_key' => wp_generate_password(32, false),
            'sync_erp_auto_sync' => 'yes',
            'sync_erp_sync_interval' => 10,
            'sync_erp_notifications' => 'yes',
            'sync_erp_log_level' => 'info'
        );
        
        foreach ($default_options as $key => $value) {
            if (!get_option($key)) {
                add_option($key, $value);
            }
        }
        
        // Schedule sync cron if not exists
        if (!wp_next_scheduled('sync_erp_auto_sync')) {
            wp_schedule_event(time(), 'sync_erp_interval', 'sync_erp_auto_sync');
        }
        
        // Flush rewrite rules
        flush_rewrite_rules();
        
        // Log activation (solo si la clase existe)
        if (class_exists('SyncERP_Logger')) {
            SyncERP_Logger::log('Plugin activated', 'info');
        }
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clear scheduled cron
        $timestamp = wp_next_scheduled('sync_erp_auto_sync');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'sync_erp_auto_sync');
        }
        
        // Log deactivation (solo si la clase existe)
        if (class_exists('SyncERP_Logger')) {
            SyncERP_Logger::log('Plugin deactivated', 'info');
        }
    }
    
    /**
     * Create database tables
     */
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Sync logs table
        $table_name = $wpdb->prefix . 'sync_erp_logs';
        $sql = "CREATE TABLE $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            timestamp datetime DEFAULT CURRENT_TIMESTAMP,
            level varchar(20) NOT NULL,
            message text NOT NULL,
            context longtext,
            source varchar(100),
            PRIMARY KEY (id),
            KEY level (level),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        
        // Sync stats table
        $table_name2 = $wpdb->prefix . 'sync_erp_stats';
        $sql2 = "CREATE TABLE $table_name2 (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            sync_date datetime DEFAULT CURRENT_TIMESTAMP,
            products_synced int(11) DEFAULT 0,
            products_created int(11) DEFAULT 0,
            products_updated int(11) DEFAULT 0,
            products_deleted int(11) DEFAULT 0,
            orders_synced int(11) DEFAULT 0,
            errors int(11) DEFAULT 0,
            duration_seconds float DEFAULT 0,
            source varchar(50) DEFAULT 'auto',
            PRIMARY KEY (id),
            KEY sync_date (sync_date)
        ) $charset_collate;";
        
        // Product mapping table
        $table_name3 = $wpdb->prefix . 'sync_erp_product_mapping';
        $sql3 = "CREATE TABLE $table_name3 (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            wc_product_id bigint(20) NOT NULL,
            erp_product_code varchar(100) NOT NULL,
            erp_internal_code varchar(100),
            last_sync datetime DEFAULT CURRENT_TIMESTAMP,
            sync_status varchar(20) DEFAULT 'synced',
            error_message text,
            PRIMARY KEY (id),
            UNIQUE KEY wc_product_id (wc_product_id),
            UNIQUE KEY erp_product_code (erp_product_code),
            KEY last_sync (last_sync)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        dbDelta($sql2);
        dbDelta($sql3);
    }
    
    /**
     * WooCommerce missing notice
     */
    public function woocommerce_missing_notice() {
        $message = sprintf(
            /* translators: %s: WooCommerce link */
            esc_html__('Sincronizador ERP requiere que %s esté instalado y activado.', 'sync-erp-wc'),
            '<a href="' . admin_url('plugin-install.php?s=woocommerce&tab=search&type=term') . '">WooCommerce</a>'
        );
        
        printf('<div class="notice notice-error"><p>%s</p></div>', wp_kses_post($message));
    }
    
    /**
     * API permission check
     */
    public function api_permission_check($request) {
        $api_key = $request->get_header('X-API-Key');
        $stored_key = get_option('sync_erp_api_key');
        
        return $api_key === $stored_key || current_user_can('manage_woocommerce');
    }
    
    /**
     * API: Trigger sync
     */
    public function api_trigger_sync($request) {
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->manual_sync();
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => 'Sincronización iniciada',
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
     * API: Delete product
     */
    public function api_delete_product($request) {
        $product_code = $request->get_param('product_code');
        $reason = $request->get_param('reason');
        
        if (empty($product_code)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Código de producto requerido'
            ), 400);
        }
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->delete_product($product_code, $reason);
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => 'Producto eliminado exitosamente',
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
     * API: Restore product
     */
    public function api_restore_product($request) {
        $product_code = $request->get_param('product_code');
        
        if (empty($product_code)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Código de producto requerido'
            ), 400);
        }
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->restore_product($product_code);
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => 'Producto restaurado exitosamente',
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
     * API: Get stats
     */
    public function api_get_stats($request) {
        try {
            global $wpdb;
            
            $recent_stats = $wpdb->get_results(
                "SELECT * FROM {$wpdb->prefix}sync_erp_stats 
                 ORDER BY sync_date DESC LIMIT 10"
            );
            
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
                'data' => array(
                    'recent' => $recent_stats,
                    'summary' => $summary,
                    'timestamp' => current_time('mysql')
                )
            ), 200);
        } catch (Exception $e) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => $e->getMessage()
            ), 500);
        }
    }
    
    /**
     * AJAX: Handle manual sync
     */
    public function handle_manual_sync() {
        check_ajax_referer('sync_erp_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('No tienes permisos para realizar esta acción.', 'sync-erp-wc'));
        }
        
        if (!class_exists('SyncERP_ProductSync')) {
            wp_send_json_error(__('Clase de sincronización no disponible.', 'sync-erp-wc'));
            return;
        }
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->manual_sync();
            
            wp_send_json_success($result);
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    /**
     * AJAX: Handle delete product
     */
    public function handle_delete_product() {
        check_ajax_referer('sync_erp_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('No tienes permisos para realizar esta acción.', 'sync-erp-wc'));
        }
        
        if (!class_exists('SyncERP_ProductSync')) {
            wp_send_json_error(__('Clase de sincronización no disponible.', 'sync-erp-wc'));
            return;
        }
        
        $product_code = sanitize_text_field($_POST['product_code']);
        $reason = sanitize_textarea_field($_POST['reason']);
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->delete_product($product_code, $reason);
            
            wp_send_json_success($result);
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    /**
     * AJAX: Handle restore product
     */
    public function handle_restore_product() {
        check_ajax_referer('sync_erp_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('No tienes permisos para realizar esta acción.', 'sync-erp-wc'));
        }
        
        if (!class_exists('SyncERP_ProductSync')) {
            wp_send_json_error(__('Clase de sincronización no disponible.', 'sync-erp-wc'));
            return;
        }
        
        $product_code = sanitize_text_field($_POST['product_code']);
        
        try {
            $sync = new SyncERP_ProductSync();
            $result = $sync->restore_product($product_code);
            
            wp_send_json_success($result);
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    /**
     * AJAX: Handle get stats
     */
    public function handle_get_stats() {
        check_ajax_referer('sync_erp_admin_nonce', 'nonce');
        
        try {
            $response = $this->api_get_stats(new WP_REST_Request());
            wp_send_json_success($response->get_data());
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}

// Add custom cron schedule
add_filter('cron_schedules', function($schedules) {
    $interval = get_option('sync_erp_sync_interval', 10);
    $schedules['sync_erp_interval'] = array(
        'interval' => $interval * 60,
        'display' => sprintf(__('Cada %d minutos', 'sync-erp-wc'), $interval)
    );
    return $schedules;
});

// Hook for auto sync
add_action('sync_erp_auto_sync', function() {
    if (get_option('sync_erp_auto_sync') === 'yes') {
        try {
            $sync = new SyncERP_ProductSync();
            $sync->auto_sync();
        } catch (Exception $e) {
            SyncERP_Logger::log('Error en sincronización automática: ' . $e->getMessage(), 'error');
        }
    }
});

// Initialize plugin
function sync_erp_woocommerce_init() {
    return SyncERPWooCommerce::get_instance();
}

// Start the plugin
sync_erp_woocommerce_init();