
<?php
/**
 * Order and Stock synchronization classes for Sync ERP WooCommerce plugin
 * 
 * @package SyncERPWooCommerce
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Stock Synchronization Class
 */
class SyncERP_StockSync {
    
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
        
        // Hooks for stock events
        add_action('woocommerce_product_set_stock', array($this, 'on_stock_changed'), 10, 1);
        add_action('woocommerce_variation_set_stock', array($this, 'on_variation_stock_changed'), 10, 1);
        
        // Stock sync schedule
        add_action('sync_erp_sync_stock', array($this, 'sync_all_stock'));
        
        if (!wp_next_scheduled('sync_erp_sync_stock')) {
            wp_schedule_event(time(), 'hourly', 'sync_erp_sync_stock');
        }
    }
    
    /**
     * Sync all stock from ERP
     */
    public function sync_all_stock() {
        $stats = array(
            'products_updated' => 0,
            'products_failed' => 0,
            'errors' => array()
        );
        
        try {
            // Get stock data from ERP
            $stock_data = $this->get_stock_from_erp();
            
            foreach ($stock_data as $item) {
                try {
                    $result = $this->update_product_stock($item['cod_interno'], $item['stock_data']);
                    if ($result) {
                        $stats['products_updated']++;
                    } else {
                        $stats['products_failed']++;
                    }
                } catch (Exception $e) {
                    $stats['products_failed']++;
                    $stats['errors'][] = "Producto {$item['cod_interno']}: " . $e->getMessage();
                }
            }
            
            if ($stats['products_updated'] > 0 || $stats['products_failed'] > 0) {
                SyncERP_Logger::log('Sincronización de stock completada', 'info', $stats);
            }
            
        } catch (Exception $e) {
            SyncERP_Logger::error('Error en sincronización de stock: ' . $e->getMessage());
        }
        
        return $stats;
    }
    
    /**
     * Get stock data from ERP
     */
    private function get_stock_from_erp() {
        try {
            $response = $this->make_api_request('/api/stock/all', 'GET');
            return $response['stock_data'] ?? array();
        } catch (Exception $e) {
            SyncERP_Logger::error('Error obteniendo stock desde ERP: ' . $e->getMessage());
            return array();
        }
    }
    
    /**
     * Update product stock
     */
    public function update_product_stock($cod_interno, $stock_data) {
        global $wpdb;
        
        // Find product by internal code
        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} 
             WHERE meta_key = 'cod_interno' AND meta_value = %s",
            $cod_interno
        ));
        
        if (!$product_id) {
            throw new Exception("Producto no encontrado: {$cod_interno}");
        }
        
        $product = wc_get_product($product_id);
        if (!$product) {
            throw new Exception("Producto WooCommerce no válido: {$product_id}");
        }
        
        try {
            // Calculate total stock from all branches
            $total_stock = 0;
            if (is_array($stock_data)) {
                foreach ($stock_data as $branch_id => $quantity) {
                    $total_stock += intval($quantity);
                }
            } else {
                $total_stock = intval($stock_data);
            }
            
            // Update WooCommerce stock
            $product->set_stock_quantity($total_stock);
            $product->set_stock_status($total_stock > 0 ? 'instock' : 'outofstock');
            $product->save();
            
            // Update multi-inventory if plugin is active
            if ($this->is_multi_inventory_active()) {
                $this->update_multi_inventory_stock($product_id, $stock_data);
            }
            
            // Log stock update
            SyncERP_Logger::debug("Stock actualizado para producto {$cod_interno}", array(
                'product_id' => $product_id,
                'total_stock' => $total_stock,
                'stock_data' => $stock_data
            ));
            
            return array(
                'product_id' => $product_id,
                'total_stock' => $total_stock,
                'stock_data' => $stock_data
            );
            
        } catch (Exception $e) {
            SyncERP_Logger::error("Error actualizando stock para {$cod_interno}: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Check if multi-inventory plugin is active
     */
    private function is_multi_inventory_active() {
        return class_exists('WC_Multi_Inventory');
    }
    
    /**
     * Update multi-inventory stock
     */
    private function update_multi_inventory_stock($product_id, $stock_data) {
        if (!is_array($stock_data)) {
            return;
        }
        
        // Serialize stock data for multi-inventory plugin
        $serialized_stock = $this->serialize_stock_data($stock_data);
        update_post_meta($product_id, 'woocommerce_multi_inventory_inventories_stock', $serialized_stock);
        
        SyncERP_Logger::debug("Multi-inventory stock actualizado", array(
            'product_id' => $product_id,
            'serialized_stock' => $serialized_stock
        ));
    }
    
    /**
     * Serialize stock data for multi-inventory
     */
    private function serialize_stock_data($stock_data) {
        $serialized = 'a:' . count($stock_data) . ':{';
        foreach ($stock_data as $branch_id => $quantity) {
            $qty_str = strval($quantity);
            $serialized .= 'i:' . $branch_id . ';s:' . strlen($qty_str) . ':"' . $qty_str . '";';
        }
        $serialized .= '}';
        
        return $serialized;
    }
    
    /**
     * Handle stock change in WooCommerce
     */
    public function on_stock_changed($product) {
        $cod_interno = get_post_meta($product->get_id(), 'cod_interno', true);
        
        if (empty($cod_interno)) {
            return;
        }
        
        $stock_quantity = $product->get_stock_quantity();
        
        SyncERP_Logger::debug("Stock cambiado en WooCommerce", array(
            'product_id' => $product->get_id(),
            'cod_interno' => $cod_interno,
            'new_stock' => $stock_quantity
        ));
        
        // Notify ERP of stock change
        $this->notify_erp_stock_change($cod_interno, $stock_quantity);
    }
    
    /**
     * Handle variation stock change
     */
    public function on_variation_stock_changed($variation) {
        $parent_id = $variation->get_parent_id();
        $cod_interno = get_post_meta($parent_id, 'cod_interno', true);
        
        if (empty($cod_interno)) {
            return;
        }
        
        SyncERP_Logger::debug("Stock de variación cambiado", array(
            'variation_id' => $variation->get_id(),
            'parent_id' => $parent_id,
            'cod_interno' => $cod_interno,
            'new_stock' => $variation->get_stock_quantity()
        ));
    }
    
    /**
     * Notify ERP of stock change
     */
    private function notify_erp_stock_change($cod_interno, $stock_quantity) {
        try {
            $data = array(
                'cod_interno' => $cod_interno,
                'stock_quantity' => $stock_quantity,
                'timestamp' => current_time('mysql'),
                'source' => 'woocommerce'
            );
            
            $this->make_api_request('/api/stock/update', 'POST', $data);
        } catch (Exception $e) {
            SyncERP_Logger::warning('Error notificando cambio de stock a ERP: ' . $e->getMessage());
        }
    }
    
    /**
     * Get low stock products
     */
    public function get_low_stock_products($threshold = 5) {
        global $wpdb;
        
        $products = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_title, pm1.meta_value as stock_quantity, pm2.meta_value as cod_interno
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_stock'
             LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'cod_interno'
             WHERE p.post_type = 'product'
             AND p.post_status = 'publish'
             AND CAST(pm1.meta_value AS UNSIGNED) <= %d
             AND CAST(pm1.meta_value AS UNSIGNED) > 0
             ORDER BY CAST(pm1.meta_value AS UNSIGNED) ASC",
            $threshold
        ));
        
        return $products;
    }
    
    /**
     * Get out of stock products
     */
    public function get_out_of_stock_products() {
        global $wpdb;
        
        $products = $wpdb->get_results(
            "SELECT p.ID, p.post_title, pm2.meta_value as cod_interno
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_stock_status'
             LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'cod_interno'
             WHERE p.post_type = 'product'
             AND p.post_status = 'publish'
             AND pm1.meta_value = 'outofstock'
             ORDER BY p.post_title ASC"
        );
        
        return $products;
    }
    
    /**
     * Make API request to backend
     */
    private function make_api_request($endpoint, $method = 'GET', $data = null) {
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
        
        $start_time = microtime(true);
        $response = wp_remote_request($url, $args);
        $response_time = (microtime(true) - $start_time) * 1000;
        
        if (is_wp_error($response)) {
            SyncERP_Logger::log_api_request($endpoint, $method, 0, $response_time, $response->get_error_message());
            throw new Exception('Error de conexión: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        SyncERP_Logger::log_api_request($endpoint, $method, $status_code, $response_time);
        
        if ($status_code >= 400) {
            throw new Exception("Error HTTP {$status_code}: {$body}");
        }
        
        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Respuesta JSON inválida');
        }
        
        return $decoded;
    }
}