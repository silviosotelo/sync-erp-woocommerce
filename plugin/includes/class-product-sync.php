<?php
/**
 * Product synchronization class for Sync ERP WooCommerce plugin
 * 
 * @package SyncERPWooCommerce
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class SyncERP_ProductSync {
    
    /**
     * Backend API URL
     * @var string
     */
    private $backend_url;
    
    /**
     * API Key
     * @var string
     */
    private $api_key;
    
    /**
     * Constructor
     */
    public function __construct() {
        $this->backend_url = rtrim(get_option('sync_erp_backend_url', 'http://localhost:3001'), '/');
        $this->api_key = get_option('sync_erp_api_key');
        
        // Hooks for product updates
        add_action('woocommerce_update_product', array($this, 'on_product_update'), 10, 1);
        add_action('woocommerce_delete_product', array($this, 'on_product_delete'), 10, 1);
        add_action('woocommerce_trash_product', array($this, 'on_product_trash'), 10, 1);
        add_action('woocommerce_untrash_product', array($this, 'on_product_restore'), 10, 1);
        
        // AJAX hooks
        add_action('wp_ajax_sync_erp_test_connection', array($this, 'test_connection'));
        add_action('wp_ajax_sync_erp_clear_logs', array($this, 'clear_logs'));
    }
    
    /**
     * Manual synchronization triggered from admin
     */
    public function manual_sync() {
        SyncERP_Logger::log('Iniciando sincronización manual', 'info', array('source' => 'manual'));
        
        $start_time = microtime(true);
        $stats = array(
            'products_synced' => 0,
            'products_created' => 0,
            'products_updated' => 0,
            'products_deleted' => 0,
            'errors' => 0,
            'source' => 'manual'
        );
        
        try {
            // Test connection first
            if (!$this->test_backend_connection()) {
                throw new Exception(__('No se puede conectar con el backend de sincronización', 'sync-erp-wc'));
            }
            
            // Sync products from ERP
            $sync_result = $this->sync_products_from_erp();
            $stats = array_merge($stats, $sync_result);
            
            // Process deleted products
            $delete_result = $this->process_deleted_products();
            $stats['products_deleted'] = $delete_result['deleted_count'];
            $stats['errors'] += $delete_result['errors'];
            
            // Calculate duration
            $duration = microtime(true) - $start_time;
            $stats['duration_seconds'] = $duration;
            
            // Save statistics
            $this->save_sync_stats($stats);
            
            SyncERP_Logger::log('Sincronización manual completada', 'info', $stats);
            
            return $stats;
            
        } catch (Exception $e) {
            $stats['errors']++;
            $error_msg = 'Error en sincronización manual: ' . $e->getMessage();
            SyncERP_Logger::log($error_msg, 'error');
            
            // Save error stats
            $stats['duration_seconds'] = microtime(true) - $start_time;
            $this->save_sync_stats($stats);
            
            throw $e;
        }
    }
    
    /**
     * Automatic synchronization triggered by cron
     */
    public function auto_sync() {
        if (get_option('sync_erp_auto_sync') !== 'yes') {
            return;
        }
        
        SyncERP_Logger::log('Iniciando sincronización automática', 'info', array('source' => 'auto'));
        
        $start_time = microtime(true);
        $stats = array(
            'products_synced' => 0,
            'products_created' => 0,
            'products_updated' => 0,
            'products_deleted' => 0,
            'errors' => 0,
            'source' => 'auto'
        );
        
        try {
            // Test connection
            if (!$this->test_backend_connection()) {
                SyncERP_Logger::log('Backend no disponible para sincronización automática', 'warning');
                return;
            }
            
            // Sync products
            $sync_result = $this->sync_products_from_erp();
            $stats = array_merge($stats, $sync_result);
            
            // Process deletions
            $delete_result = $this->process_deleted_products();
            $stats['products_deleted'] = $delete_result['deleted_count'];
            $stats['errors'] += $delete_result['errors'];
            
            // Calculate duration and save stats
            $stats['duration_seconds'] = microtime(true) - $start_time;
            $this->save_sync_stats($stats);
            
            SyncERP_Logger::log('Sincronización automática completada', 'info', $stats);
            
            // Send notifications if enabled
            if (get_option('sync_erp_email_notifications') === 'yes' && $stats['errors'] > 0) {
                $this->send_error_notification($stats);
            }
            
        } catch (Exception $e) {
            SyncERP_Logger::log('Error en sincronización automática: ' . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Sync products from ERP backend
     */
    private function sync_products_from_erp() {
        $stats = array(
            'products_synced' => 0,
            'products_created' => 0,
            'products_updated' => 0,
            'errors' => 0
        );
        
        try {
            // Get products from backend
            $response = $this->make_api_request('/api/stats', 'GET');
            
            if (!$response || !isset($response['recent'])) {
                throw new Exception('No se pudieron obtener productos del ERP');
            }
            
            // Trigger backend sync
            $sync_response = $this->make_api_request('/api/sync/start', 'POST');
            
            if (!$sync_response || !$sync_response['success']) {
                throw new Exception('Error iniciando sincronización en backend');
            }
            
            // Wait a bit for backend to process
            sleep(2);
            
            // Get updated stats
            $updated_response = $this->make_api_request('/api/stats', 'GET');
            
            if ($updated_response && isset($updated_response['summary'])) {
                $summary = $updated_response['summary'];
                $stats['products_created'] = $summary['total_created'] ?? 0;
                $stats['products_updated'] = $summary['total_updated'] ?? 0;
                $stats['products_synced'] = $stats['products_created'] + $stats['products_updated'];
            }
            
            SyncERP_Logger::log('Productos sincronizados desde ERP', 'info', $stats);
            
        } catch (Exception $e) {
            $stats['errors']++;
            SyncERP_Logger::log('Error sincronizando productos desde ERP: ' . $e->getMessage(), 'error');
        }
        
        return $stats;
    }
    
    /**
     * Process deleted products from ERP
     */
    private function process_deleted_products() {
        $result = array(
            'deleted_count' => 0,
            'errors' => 0
        );
        
        try {
            // Get deleted products from backend
            $response = $this->make_api_request('/api/products/deleted', 'GET');
            
            if (!$response || !isset($response['products'])) {
                return $result;
            }
            
            $deleted_products = $response['products'];
            
            foreach ($deleted_products as $deleted_product) {
                if (isset($deleted_product['cod_interno'])) {
                    try {
                        $this->delete_product_by_code($deleted_product['cod_interno'], 'Eliminado desde ERP');
                        $result['deleted_count']++;
                    } catch (Exception $e) {
                        $result['errors']++;
                        SyncERP_Logger::log('Error eliminando producto ' . $deleted_product['cod_interno'] . ': ' . $e->getMessage(), 'error');
                    }
                }
            }
            
            if ($result['deleted_count'] > 0) {
                SyncERP_Logger::log("Productos eliminados: {$result['deleted_count']}", 'info', $result);
            }
            
        } catch (Exception $e) {
            $result['errors']++;
            SyncERP_Logger::log('Error procesando productos eliminados: ' . $e->getMessage(), 'error');
        }
        
        return $result;
    }
    
    /**
     * Delete product by internal code
     */
    public function delete_product($product_code, $reason = '') {
        return $this->delete_product_by_code($product_code, $reason);
    }
    
    /**
     * Delete product by internal code (internal method)
     */
    private function delete_product_by_code($product_code, $reason = '') {
        global $wpdb;
        
        // Find product by internal code
        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} 
             WHERE meta_key = 'cod_interno' AND meta_value = %s",
            $product_code
        ));
        
        if (!$product_id) {
            throw new Exception("Producto no encontrado: {$product_code}");
        }
        
        $product = wc_get_product($product_id);
        if (!$product) {
            throw new Exception("Producto WooCommerce no válido: {$product_id}");
        }
        
        // Check if product has pending orders
        $has_pending_orders = $this->product_has_pending_orders($product_id);
        
        if ($has_pending_orders) {
            // If has pending orders, just hide it instead of deleting
            $product->set_status('private');
            $product->set_catalog_visibility('hidden');
            $product->save();
            
            // Add deletion metadata
            update_post_meta($product_id, 'deletion_reason', $reason ?: 'Producto con órdenes pendientes');
            update_post_meta($product_id, 'deletion_date', current_time('mysql'));
            
            SyncERP_Logger::log("Producto {$product_code} ocultado (tiene órdenes pendientes)", 'warning', array(
                'product_id' => $product_id,
                'reason' => $reason
            ));
        } else {
            // Safe to move to trash
            wp_trash_post($product_id);
            
            // Add deletion metadata
            update_post_meta($product_id, 'deletion_reason', $reason ?: 'Eliminado desde ERP');
            update_post_meta($product_id, 'deletion_date', current_time('mysql'));
            
            SyncERP_Logger::log("Producto {$product_code} movido a papelera", 'info', array(
                'product_id' => $product_id,
                'reason' => $reason
            ));
        }
        
        // Update mapping table
        $this->update_product_mapping($product_id, $product_code, 'deleted', $reason);
        
        // Notify backend
        $this->notify_backend_product_action('delete', $product_code, $reason);
        
        return array(
            'product_id' => $product_id,
            'action' => $has_pending_orders ? 'hidden' : 'trashed',
            'reason' => $reason
        );
    }
    
    /**
     * Restore deleted product
     */
    public function restore_product($product_code) {
        global $wpdb;
        
        // Find product by internal code
        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} 
             WHERE meta_key = 'cod_interno' AND meta_value = %s",
            $product_code
        ));
        
        if (!$product_id) {
            throw new Exception("Producto no encontrado: {$product_code}");
        }
        
        $post = get_post($product_id);
        if (!$post) {
            throw new Exception("Post no encontrado: {$product_id}");
        }
        
        if ($post->post_status === 'trash') {
            // Restore from trash
            wp_untrash_post($product_id);
        } else {
            // Restore from private/hidden status
            $product = wc_get_product($product_id);
            if ($product) {
                $product->set_status('publish');
                $product->set_catalog_visibility('visible');
                $product->save();
            }
        }
        
        // Remove deletion metadata
        delete_post_meta($product_id, 'deletion_reason');
        delete_post_meta($product_id, 'deletion_date');
        
        // Update mapping table
        $this->update_product_mapping($product_id, $product_code, 'synced', '');
        
        // Log action
        SyncERP_Logger::log("Producto {$product_code} restaurado", 'info', array(
            'product_id' => $product_id
        ));
        
        // Notify backend
        $this->notify_backend_product_action('restore', $product_code, '');
        
        return array(
            'product_id' => $product_id,
            'action' => 'restored'
        );
    }
    
    /**
     * Check if product has pending orders
     */
    private function product_has_pending_orders($product_id) {
        global $wpdb;
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) 
             FROM {$wpdb->prefix}woocommerce_order_items oi
             INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
             INNER JOIN {$wpdb->posts} o ON oi.order_id = o.ID
             WHERE oim.meta_key = '_product_id' 
             AND oim.meta_value = %d 
             AND o.post_status IN ('wc-processing', 'wc-pending', 'wc-on-hold')",
            $product_id
        ));
        
        return intval($count) > 0;
    }
    
    /**
     * Update product mapping table
     */
    private function update_product_mapping($product_id, $product_code, $status, $error_message = '') {
        global $wpdb;
        
        $wpdb->replace(
            $wpdb->prefix . 'sync_erp_product_mapping',
            array(
                'wc_product_id' => $product_id,
                'erp_product_code' => $product_code,
                'last_sync' => current_time('mysql'),
                'sync_status' => $status,
                'error_message' => $error_message
            ),
            array('%d', '%s', '%s', '%s', '%s')
        );
    }
    
    /**
     * Notify backend about product action
     */
    private function notify_backend_product_action($action, $product_code, $reason = '') {
        try {
            $endpoint = '/api/webhook/product-' . $action;
            $data = array(
                'art_cod_int' => $product_code,
                'reason' => $reason,
                'timestamp' => current_time('mysql'),
                'source' => 'woocommerce'
            );
            
            $this->make_api_request($endpoint, 'POST', $data);
        } catch (Exception $e) {
            SyncERP_Logger::log("Error notificando backend sobre acción {$action}: " . $e->getMessage(), 'warning');
        }
    }
    
    /**
     * Test backend connection
     */
    public function test_backend_connection() {
        try {
            $response = $this->make_api_request('/health', 'GET');
            return $response && (isset($response['status']) && $response['status'] === 'OK');
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Test connection AJAX handler
     */
    public function test_connection() {
        check_ajax_referer('sync_erp_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('No tienes permisos para realizar esta acción.', 'sync-erp-wc'));
        }
        
        try {
            if ($this->test_backend_connection()) {
                wp_send_json_success(__('Conexión exitosa con el backend', 'sync-erp-wc'));
            } else {
                wp_send_json_error(__('No se puede conectar con el backend', 'sync-erp-wc'));
            }
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    /**
     * Clear logs AJAX handler
     */
    public function clear_logs() {
        check_ajax_referer('sync_erp_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('No tienes permisos para realizar esta acción.', 'sync-erp-wc'));
        }
        
        try {
            global $wpdb;
            $wpdb->query("TRUNCATE TABLE {$wpdb->prefix}sync_erp_logs");
            
            SyncERP_Logger::log('Logs limpiados desde admin', 'info');
            wp_send_json_success(__('Logs limpiados exitosamente', 'sync-erp-wc'));
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    /**
     * Make API request to backend
     */
    private function make_api_request($endpoint, $method = 'GET', $data = null) {
        if (empty($this->backend_url)) {
            throw new Exception('URL del backend no configurada');
        }
        
        $url = $this->backend_url . $endpoint;
        
        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->api_key
            ),
            'sslverify' => false
        );
        
        if ($data && in_array($method, array('POST', 'PUT', 'PATCH'))) {
            $args['body'] = json_encode($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            throw new Exception('Error de conexión: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code >= 400) {
            throw new Exception("Error HTTP {$status_code}: {$body}");
        }
        
        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Respuesta JSON inválida');
        }
        
        return $decoded;
    }
    
    /**
     * Save synchronization statistics
     */
    private function save_sync_stats($stats) {
        global $wpdb;
        
        $wpdb->insert(
            $wpdb->prefix . 'sync_erp_stats',
            array(
                'sync_date' => current_time('mysql'),
                'products_synced' => $stats['products_synced'] ?? 0,
                'products_created' => $stats['products_created'] ?? 0,
                'products_updated' => $stats['products_updated'] ?? 0,
                'products_deleted' => $stats['products_deleted'] ?? 0,
                'orders_synced' => $stats['orders_synced'] ?? 0,
                'errors' => $stats['errors'] ?? 0,
                'duration_seconds' => $stats['duration_seconds'] ?? 0,
                'source' => $stats['source'] ?? 'unknown'
            ),
            array('%s', '%d', '%d', '%d', '%d', '%d', '%d', '%f', '%s')
        );
    }
    
    /**
     * Send error notification email
     */
    private function send_error_notification($stats) {
        $email = get_option('sync_erp_notification_email', get_option('admin_email'));
        
        if (empty($email)) {
            return;
        }
        
        $subject = sprintf(__('Errores en Sincronización ERP - %s', 'sync-erp-wc'), get_bloginfo('name'));
        
        $message = sprintf(
            __("Se han detectado errores en la sincronización automática:\n\n" .
               "Productos sincronizados: %d\n" .
               "Productos creados: %d\n" .
               "Productos actualizados: %d\n" .
               "Productos eliminados: %d\n" .
               "Errores: %d\n" .
               "Duración: %.2f segundos\n\n" .
               "Por favor revisa los logs para más detalles.", 'sync-erp-wc'),
            $stats['products_synced'],
            $stats['products_created'],
            $stats['products_updated'],
            $stats['products_deleted'],
            $stats['errors'],
            $stats['duration_seconds']
        );
        
        wp_mail($email, $subject, $message);
    }
    
    /**
     * Hooks for WooCommerce product events
     */
    
    /**
     * When a product is updated in WooCommerce
     */
    public function on_product_update($product_id) {
        $product = wc_get_product($product_id);
        if (!$product) {
            return;
        }
        
        // Get internal code
        $internal_code = get_post_meta($product_id, 'cod_interno', true);
        if (empty($internal_code)) {
            return;
        }
        
        SyncERP_Logger::log("Producto WooCommerce actualizado: {$internal_code}", 'debug', array(
            'product_id' => $product_id,
            'title' => $product->get_name()
        ));
        
        // Update mapping
        $this->update_product_mapping($product_id, $internal_code, 'synced');
        
        // Notify backend if needed
        $this->notify_backend_product_action('update', $internal_code);
    }
    
    /**
     * When a product is deleted in WooCommerce
     */
    public function on_product_delete($product_id) {
        $internal_code = get_post_meta($product_id, 'cod_interno', true);
        if (!empty($internal_code)) {
            SyncERP_Logger::log("Producto WooCommerce eliminado: {$internal_code}", 'info', array(
                'product_id' => $product_id
            ));
            
            // Notify backend
            $this->notify_backend_product_action('delete', $internal_code, 'Eliminado desde WooCommerce');
        }
    }
    
    /**
     * When a product is moved to trash in WooCommerce
     */
    public function on_product_trash($product_id) {
        $internal_code = get_post_meta($product_id, 'cod_interno', true);
        if (!empty($internal_code)) {
            SyncERP_Logger::log("Producto WooCommerce movido a papelera: {$internal_code}", 'info', array(
                'product_id' => $product_id
            ));
            
            // Update mapping
            $this->update_product_mapping($product_id, $internal_code, 'trashed');
        }
    }
    
    /**
     * When a product is restored from trash in WooCommerce
     */
    public function on_product_restore($product_id) {
        $internal_code = get_post_meta($product_id, 'cod_interno', true);
        if (!empty($internal_code)) {
            SyncERP_Logger::log("Producto WooCommerce restaurado: {$internal_code}", 'info', array(
                'product_id' => $product_id
            ));
            
            // Update mapping
            $this->update_product_mapping($product_id, $internal_code, 'synced');
            
            // Notify backend
            $this->notify_backend_product_action('restore', $internal_code);
        }
    }
}