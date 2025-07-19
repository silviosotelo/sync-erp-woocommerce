<?php
/**
 * Admin class for Sync ERP WooCommerce plugin
 * 
 * @package SyncERPWooCommerce
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class SyncERP_Admin {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'init_settings'));
        add_action('admin_notices', array($this, 'admin_notices'));
        add_action('admin_post_sync_erp_save_settings', array($this, 'save_settings'));
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            __('Sincronizador ERP', 'sync-erp-wc'),
            __('Sincronizador ERP', 'sync-erp-wc'),
            'manage_woocommerce',
            'sync-erp',
            array($this, 'admin_page'),
            'dashicons-update',
            56
        );
        
        add_submenu_page(
            'sync-erp',
            __('Dashboard', 'sync-erp-wc'),
            __('Dashboard', 'sync-erp-wc'),
            'manage_woocommerce',
            'sync-erp',
            array($this, 'admin_page')
        );
        
        add_submenu_page(
            'sync-erp',
            __('Configuración', 'sync-erp-wc'),
            __('Configuración', 'sync-erp-wc'),
            'manage_woocommerce',
            'sync-erp-settings',
            array($this, 'settings_page')
        );
        
        add_submenu_page(
            'sync-erp',
            __('Productos', 'sync-erp-wc'),
            __('Productos', 'sync-erp-wc'),
            'manage_woocommerce',
            'sync-erp-products',
            array($this, 'products_page')
        );
        
        add_submenu_page(
            'sync-erp',
            __('Logs', 'sync-erp-wc'),
            __('Logs', 'sync-erp-wc'),
            'manage_woocommerce',
            'sync-erp-logs',
            array($this, 'logs_page')
        );
        
        add_submenu_page(
            'sync-erp',
            __('Reportes', 'sync-erp-wc'),
            __('Reportes', 'sync-erp-wc'),
            'manage_woocommerce',
            'sync-erp-reports',
            array($this, 'reports_page')
        );
    }
    
    /**
     * Initialize settings
     */
    public function init_settings() {
        register_setting('sync_erp_settings', 'sync_erp_backend_url');
        register_setting('sync_erp_settings', 'sync_erp_api_key');
        register_setting('sync_erp_settings', 'sync_erp_auto_sync');
        register_setting('sync_erp_settings', 'sync_erp_sync_interval');
        register_setting('sync_erp_settings', 'sync_erp_notifications');
        register_setting('sync_erp_settings', 'sync_erp_log_level');
        register_setting('sync_erp_settings', 'sync_erp_email_notifications');
        register_setting('sync_erp_settings', 'sync_erp_notification_email');
    }
    
    /**
     * Main admin page (Dashboard)
     */
    public function admin_page() {
        // Get recent stats
        global $wpdb;
        $recent_stats = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}sync_erp_stats 
             ORDER BY sync_date DESC LIMIT 5"
        );
        
        $summary_stats = $wpdb->get_row(
            "SELECT 
                COUNT(*) as total_syncs,
                SUM(products_created) as total_created,
                SUM(products_updated) as total_updated,
                SUM(products_deleted) as total_deleted,
                SUM(errors) as total_errors
             FROM {$wpdb->prefix}sync_erp_stats 
             WHERE sync_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        
        $last_sync = $wpdb->get_var(
            "SELECT sync_date FROM {$wpdb->prefix}sync_erp_stats 
             ORDER BY sync_date DESC LIMIT 1"
        );
        
        ?>
        <div class="wrap">
            <h1><?php _e('Dashboard - Sincronizador ERP', 'sync-erp-wc'); ?></h1>
            
            <!-- Status Cards -->
            <div class="sync-erp-dashboard">
                <div class="sync-erp-cards">
                    <div class="sync-erp-card">
                        <div class="sync-erp-card-header">
                            <h3><?php _e('Estado del Sistema', 'sync-erp-wc'); ?></h3>
                            <span class="sync-erp-status-indicator" id="system-status"></span>
                        </div>
                        <div class="sync-erp-card-content">
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Última Sincronización:', 'sync-erp-wc'); ?></span>
                                <span class="value"><?php echo $last_sync ? date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($last_sync)) : __('Nunca', 'sync-erp-wc'); ?></span>
                            </div>
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Sincronización Automática:', 'sync-erp-wc'); ?></span>
                                <span class="value"><?php echo get_option('sync_erp_auto_sync') === 'yes' ? __('Activada', 'sync-erp-wc') : __('Desactivada', 'sync-erp-wc'); ?></span>
                            </div>
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Intervalo:', 'sync-erp-wc'); ?></span>
                                <span class="value"><?php printf(__('%d minutos', 'sync-erp-wc'), get_option('sync_erp_sync_interval', 10)); ?></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="sync-erp-card">
                        <div class="sync-erp-card-header">
                            <h3><?php _e('Estadísticas (24h)', 'sync-erp-wc'); ?></h3>
                        </div>
                        <div class="sync-erp-card-content">
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Productos Creados:', 'sync-erp-wc'); ?></span>
                                <span class="value success"><?php echo $summary_stats->total_created ?? 0; ?></span>
                            </div>
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Productos Actualizados:', 'sync-erp-wc'); ?></span>
                                <span class="value"><?php echo $summary_stats->total_updated ?? 0; ?></span>
                            </div>
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Productos Eliminados:', 'sync-erp-wc'); ?></span>
                                <span class="value warning"><?php echo $summary_stats->total_deleted ?? 0; ?></span>
                            </div>
                            <div class="sync-erp-metric">
                                <span class="label"><?php _e('Errores:', 'sync-erp-wc'); ?></span>
                                <span class="value error"><?php echo $summary_stats->total_errors ?? 0; ?></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="sync-erp-card">
                        <div class="sync-erp-card-header">
                            <h3><?php _e('Acciones Rápidas', 'sync-erp-wc'); ?></h3>
                        </div>
                        <div class="sync-erp-card-content">
                            <button type="button" class="button button-primary" id="manual-sync-btn">
                                <span class="dashicons dashicons-update"></span>
                                <?php _e('Sincronizar Ahora', 'sync-erp-wc'); ?>
                            </button>
                            <button type="button" class="button" id="test-connection-btn">
                                <span class="dashicons dashicons-admin-plugins"></span>
                                <?php _e('Probar Conexión', 'sync-erp-wc'); ?>
                            </button>
                            <button type="button" class="button" id="view-logs-btn">
                                <span class="dashicons dashicons-media-text"></span>
                                <?php _e('Ver Logs', 'sync-erp-wc'); ?>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div class="sync-erp-recent-activity">
                    <h3><?php _e('Actividad Reciente', 'sync-erp-wc'); ?></h3>
                    <div class="sync-erp-table-container">
                        <table class="wp-list-table widefat fixed striped">
                            <thead>
                                <tr>
                                    <th><?php _e('Fecha', 'sync-erp-wc'); ?></th>
                                    <th><?php _e('Productos', 'sync-erp-wc'); ?></th>
                                    <th><?php _e('Creados', 'sync-erp-wc'); ?></th>
                                    <th><?php _e('Actualizados', 'sync-erp-wc'); ?></th>
                                    <th><?php _e('Eliminados', 'sync-erp-wc'); ?></th>
                                    <th><?php _e('Errores', 'sync-erp-wc'); ?></th>
                                    <th><?php _e('Duración', 'sync-erp-wc'); ?></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (!empty($recent_stats)): ?>
                                    <?php foreach ($recent_stats as $stat): ?>
                                    <tr>
                                        <td><?php echo date_i18n('d/m/Y H:i', strtotime($stat->sync_date)); ?></td>
                                        <td><?php echo $stat->products_synced; ?></td>
                                        <td><span class="sync-count success"><?php echo $stat->products_created; ?></span></td>
                                        <td><span class="sync-count"><?php echo $stat->products_updated; ?></span></td>
                                        <td><span class="sync-count warning"><?php echo $stat->products_deleted; ?></span></td>
                                        <td><span class="sync-count error"><?php echo $stat->errors; ?></span></td>
                                        <td><?php echo round($stat->duration_seconds, 2); ?>s</td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php else: ?>
                                    <tr>
                                        <td colspan="7"><?php _e('No hay actividad reciente', 'sync-erp-wc'); ?></td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Loading overlay -->
            <div id="sync-erp-loading" class="sync-erp-loading" style="display: none;">
                <div class="sync-erp-spinner"></div>
                <p><?php _e('Procesando...', 'sync-erp-wc'); ?></p>
            </div>
        </div>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // Manual sync
            $('#manual-sync-btn').on('click', function() {
                const btn = $(this);
                const originalText = btn.html();
                
                btn.prop('disabled', true).html('<span class="dashicons dashicons-update spin"></span> <?php _e("Sincronizando...", "sync-erp-wc"); ?>');
                $('#sync-erp-loading').show();
                
                $.ajax({
                    url: syncErpAdmin.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'sync_erp_manual_sync',
                        nonce: syncErpAdmin.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            alert('<?php _e("Sincronización completada exitosamente", "sync-erp-wc"); ?>');
                            location.reload();
                        } else {
                            alert('<?php _e("Error:", "sync-erp-wc"); ?> ' + response.data);
                        }
                    },
                    error: function() {
                        alert('<?php _e("Error de conexión", "sync-erp-wc"); ?>');
                    },
                    complete: function() {
                        btn.prop('disabled', false).html(originalText);
                        $('#sync-erp-loading').hide();
                    }
                });
            });
            
            // Test connection
            $('#test-connection-btn').on('click', function() {
                const btn = $(this);
                const originalText = btn.html();
                
                btn.prop('disabled', true).html('<span class="dashicons dashicons-admin-plugins spin"></span> <?php _e("Probando...", "sync-erp-wc"); ?>');
                
                $.ajax({
                    url: syncErpAdmin.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'sync_erp_test_connection',
                        nonce: syncErpAdmin.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            alert('<?php _e("Conexión exitosa", "sync-erp-wc"); ?>');
                        } else {
                            alert('<?php _e("Error de conexión:", "sync-erp-wc"); ?> ' + response.data);
                        }
                    },
                    error: function() {
                        alert('<?php _e("Error de conexión", "sync-erp-wc"); ?>');
                    },
                    complete: function() {
                        btn.prop('disabled', false).html(originalText);
                    }
                });
            });
            
            // View logs
            $('#view-logs-btn').on('click', function() {
                window.location.href = '<?php echo admin_url('admin.php?page=sync-erp-logs'); ?>';
            });
            
            // Auto-refresh stats every 30 seconds
            setInterval(function() {
                location.reload();
            }, 30000);
        });
        </script>
        
        <style>
        .sync-erp-dashboard {
            margin-top: 20px;
        }
        
        .sync-erp-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .sync-erp-card {
            background: #fff;
            border: 1px solid #ccd0d4;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .sync-erp-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .sync-erp-card-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        
        .sync-erp-status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #46b450;
            display: inline-block;
        }
        
        .sync-erp-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f1f1f1;
        }
        
        .sync-erp-metric:last-child {
            border-bottom: none;
        }
        
        .sync-erp-metric .label {
            font-weight: 500;
            color: #646970;
        }
        
        .sync-erp-metric .value {
            font-weight: 600;
            font-size: 16px;
        }
        
        .sync-erp-metric .value.success {
            color: #46b450;
        }
        
        .sync-erp-metric .value.warning {
            color: #f56e28;
        }
        
        .sync-erp-metric .value.error {
            color: #dc3232;
        }
        
        .sync-erp-card-content .button {
            margin: 5px 5px 5px 0;
        }
        
        .sync-erp-recent-activity h3 {
            margin-bottom: 15px;
        }
        
        .sync-erp-table-container {
            background: #fff;
            border: 1px solid #ccd0d4;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .sync-count {
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
        }
        
        .sync-count.success {
            background: #d4edda;
            color: #155724;
        }
        
        .sync-count.warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .sync-count.error {
            background: #f8d7da;
            color: #721c24;
        }
        
        .sync-erp-loading {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
        }
        
        .sync-erp-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .dashicons.spin {
            animation: spin 1s linear infinite;
        }
        </style>
        <?php
    }
    
    /**
     * Settings page
     */
    public function settings_page() {
        if (isset($_POST['submit'])) {
            $this->save_settings();
        }
        
        $backend_url = get_option('sync_erp_backend_url', 'http://localhost:3001');
        $api_key = get_option('sync_erp_api_key');
        $auto_sync = get_option('sync_erp_auto_sync', 'yes');
        $sync_interval = get_option('sync_erp_sync_interval', 10);
        $notifications = get_option('sync_erp_notifications', 'yes');
        $log_level = get_option('sync_erp_log_level', 'info');
        $email_notifications = get_option('sync_erp_email_notifications', 'no');
        $notification_email = get_option('sync_erp_notification_email', get_option('admin_email'));
        ?>
        <div class="wrap">
            <h1><?php _e('Configuración - Sincronizador ERP', 'sync-erp-wc'); ?></h1>
            
            <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
                <?php wp_nonce_field('sync_erp_save_settings', 'sync_erp_nonce'); ?>
                <input type="hidden" name="action" value="sync_erp_save_settings">
                
                <table class="form-table">
                    <tbody>
                        <tr>
                            <th scope="row">
                                <label for="backend_url"><?php _e('URL del Backend', 'sync-erp-wc'); ?></label>
                            </th>
                            <td>
                                <input type="url" id="backend_url" name="sync_erp_backend_url" value="<?php echo esc_attr($backend_url); ?>" class="regular-text" />
                                <p class="description"><?php _e('URL donde está ejecutándose el servidor de sincronización', 'sync-erp-wc'); ?></p>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row">
                                <label for="api_key"><?php _e('Clave API', 'sync-erp-wc'); ?></label>
                            </th>
                            <td>
                                <input type="text" id="api_key" name="sync_erp_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                                <button type="button" class="button" id="generate-api-key"><?php _e('Generar Nueva', 'sync-erp-wc'); ?></button>
                                <p class="description"><?php _e('Clave para autenticar las comunicaciones con el backend', 'sync-erp-wc'); ?></p>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row"><?php _e('Sincronización Automática', 'sync-erp-wc'); ?></th>
                            <td>
                                <fieldset>
                                    <label>
                                        <input type="radio" name="sync_erp_auto_sync" value="yes" <?php checked($auto_sync, 'yes'); ?> />
                                        <?php _e('Activada', 'sync-erp-wc'); ?>
                                    </label><br>
                                    <label>
                                        <input type="radio" name="sync_erp_auto_sync" value="no" <?php checked($auto_sync, 'no'); ?> />
                                        <?php _e('Desactivada', 'sync-erp-wc'); ?>
                                    </label>
                                </fieldset>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row">
                                <label for="sync_interval"><?php _e('Intervalo de Sincronización', 'sync-erp-wc'); ?></label>
                            </th>
                            <td>
                                <select id="sync_interval" name="sync_erp_sync_interval">
                                    <option value="5" <?php selected($sync_interval, 5); ?>><?php _e('5 minutos', 'sync-erp-wc'); ?></option>
                                    <option value="10" <?php selected($sync_interval, 10); ?>><?php _e('10 minutos', 'sync-erp-wc'); ?></option>
                                    <option value="15" <?php selected($sync_interval, 15); ?>><?php _e('15 minutos', 'sync-erp-wc'); ?></option>
                                    <option value="30" <?php selected($sync_interval, 30); ?>><?php _e('30 minutos', 'sync-erp-wc'); ?></option>
                                    <option value="60" <?php selected($sync_interval, 60); ?>><?php _e('1 hora', 'sync-erp-wc'); ?></option>
                                </select>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row"><?php _e('Notificaciones', 'sync-erp-wc'); ?></th>
                            <td>
                                <fieldset>
                                    <label>
                                        <input type="radio" name="sync_erp_notifications" value="yes" <?php checked($notifications, 'yes'); ?> />
                                        <?php _e('Activadas', 'sync-erp-wc'); ?>
                                    </label><br>
                                    <label>
                                        <input type="radio" name="sync_erp_notifications" value="no" <?php checked($notifications, 'no'); ?> />
                                        <?php _e('Desactivadas', 'sync-erp-wc'); ?>
                                    </label>
                                </fieldset>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row"><?php _e('Notificaciones por Email', 'sync-erp-wc'); ?></th>
                            <td>
                                <fieldset>
                                    <label>
                                        <input type="radio" name="sync_erp_email_notifications" value="yes" <?php checked($email_notifications, 'yes'); ?> />
                                        <?php _e('Activadas', 'sync-erp-wc'); ?>
                                    </label><br>
                                    <label>
                                        <input type="radio" name="sync_erp_email_notifications" value="no" <?php checked($email_notifications, 'no'); ?> />
                                        <?php _e('Desactivadas', 'sync-erp-wc'); ?>
                                    </label>
                                </fieldset>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row">
                                <label for="notification_email"><?php _e('Email para Notificaciones', 'sync-erp-wc'); ?></label>
                            </th>
                            <td>
                                <input type="email" id="notification_email" name="sync_erp_notification_email" value="<?php echo esc_attr($notification_email); ?>" class="regular-text" />
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row">
                                <label for="log_level"><?php _e('Nivel de Log', 'sync-erp-wc'); ?></label>
                            </th>
                            <td>
                                <select id="log_level" name="sync_erp_log_level">
                                    <option value="debug" <?php selected($log_level, 'debug'); ?>><?php _e('Debug (Muy detallado)', 'sync-erp-wc'); ?></option>
                                    <option value="info" <?php selected($log_level, 'info'); ?>><?php _e('Info (Normal)', 'sync-erp-wc'); ?></option>
                                    <option value="warning" <?php selected($log_level, 'warning'); ?>><?php _e('Warning (Solo advertencias)', 'sync-erp-wc'); ?></option>
                                    <option value="error" <?php selected($log_level, 'error'); ?>><?php _e('Error (Solo errores)', 'sync-erp-wc'); ?></option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                <?php submit_button(); ?>
            </form>
        </div>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            $('#generate-api-key').on('click', function() {
                if (confirm('<?php _e("¿Estás seguro de que quieres generar una nueva clave API?", "sync-erp-wc"); ?>')) {
                    // Generate random API key
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    let apiKey = '';
                    for (let i = 0; i < 32; i++) {
                        apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    $('#api_key').val(apiKey);
                }
            });
        });
        </script>
        <?php
    }
    
    /**
     * Products management page
     */
    public function products_page() {
        // Handle bulk actions
        if (isset($_POST['action']) && $_POST['action'] === 'bulk_delete' && !empty($_POST['product_codes'])) {
            $this->bulk_delete_products($_POST['product_codes'], $_POST['delete_reason'] ?? '');
        }
        
        // Get deleted products
        $deleted_products = $this->get_deleted_products();
        ?>
        <div class="wrap">
            <h1><?php _e('Gestión de Productos', 'sync-erp-wc'); ?></h1>
            
            <div class="sync-erp-products-actions">
                <button type="button" class="button button-primary" id="delete-product-btn">
                    <span class="dashicons dashicons-trash"></span>
                    <?php _e('Eliminar Producto', 'sync-erp-wc'); ?>
                </button>
                <button type="button" class="button" id="restore-product-btn">
                    <span class="dashicons dashicons-undo"></span>
                    <?php _e('Restaurar Producto', 'sync-erp-wc'); ?>
                </button>
            </div>
            
            <h3><?php _e('Productos Eliminados Recientemente', 'sync-erp-wc'); ?></h3>
            <div class="sync-erp-table-container">
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th><?php _e('Código Interno', 'sync-erp-wc'); ?></th>
                            <th><?php _e('Título', 'sync-erp-wc'); ?></th>
                            <th><?php _e('Fecha Eliminación', 'sync-erp-wc'); ?></th>
                            <th><?php _e('Razón', 'sync-erp-wc'); ?></th>
                            <th><?php _e('Acciones', 'sync-erp-wc'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($deleted_products)): ?>
                            <?php foreach ($deleted_products as $product): ?>
                            <tr>
                                <td><?php echo esc_html($product['cod_interno']); ?></td>
                                <td><?php echo esc_html($product['post_title']); ?></td>
                                <td><?php echo date_i18n(get_option('date_format'), strtotime($product['post_modified'])); ?></td>
                                <td><?php echo esc_html($product['deletion_reason'] ?? __('No especificada', 'sync-erp-wc')); ?></td>
                                <td>
                                    <button type="button" class="button button-small restore-single-btn" data-code="<?php echo esc_attr($product['cod_interno']); ?>">
                                        <?php _e('Restaurar', 'sync-erp-wc'); ?>
                                    </button>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <tr>
                                <td colspan="5"><?php _e('No hay productos eliminados recientemente', 'sync-erp-wc'); ?></td>
                            </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Delete Product Modal -->
        <div id="delete-product-modal" class="sync-erp-modal" style="display: none;">
            <div class="sync-erp-modal-content">
                <span class="sync-erp-close">&times;</span>
                <h2><?php _e('Eliminar Producto', 'sync-erp-wc'); ?></h2>
                <form id="delete-product-form">
                    <p>
                        <label for="delete-product-code"><?php _e('Código Interno del Producto:', 'sync-erp-wc'); ?></label>
                        <input type="text" id="delete-product-code" required>
                    </p>
                    <p>
                        <label for="delete-reason"><?php _e('Razón de Eliminación:', 'sync-erp-wc'); ?></label>
                        <input type="text" id="delete-reason" placeholder="<?php _e('Opcional', 'sync-erp-wc'); ?>">
                    </p>
                    <p>
                        <button type="submit" class="button button-primary"><?php _e('Eliminar Producto', 'sync-erp-wc'); ?></button>
                        <button type="button" class="button cancel-btn"><?php _e('Cancelar', 'sync-erp-wc'); ?></button>
                    </p>
                </form>
            </div>
        </div>
        
        <!-- Restore Product Modal -->
        <div id="restore-product-modal" class="sync-erp-modal" style="display: none;">
            <div class="sync-erp-modal-content">
                <span class="sync-erp-close">&times;</span>
                <h2><?php _e('Restaurar Producto', 'sync-erp-wc'); ?></h2>
                <form id="restore-product-form">
                    <p>
                        <label for="restore-product-code"><?php _e('Código Interno del Producto:', 'sync-erp-wc'); ?></label>
                        <input type="text" id="restore-product-code" required>
                    </p>
                    <p>
                        <button type="submit" class="button button-primary"><?php _e('Restaurar Producto', 'sync-erp-wc'); ?></button>
                        <button type="button" class="button cancel-btn"><?php _e('Cancelar', 'sync-erp-wc'); ?></button>
                    </p>
                </form>
            </div>
        </div>
        
        <style>
        .sync-erp-products-actions {
            margin: 20px 0;
        }
        
        .sync-erp-products-actions .button {
            margin-right: 10px;
        }
        
        .sync-erp-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .sync-erp-modal-content {
            background-color: #fefefe;
            margin: 10% auto;
            padding: 20px;
            border-radius: 8px;
            width: 80%;
            max-width: 500px;
            position: relative;
        }
        
        .sync-erp-close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            position: absolute;
            right: 15px;
            top: 10px;
        }
        
        .sync-erp-close:hover {
            color: #000;
        }
        
        .sync-erp-modal form p {
            margin-bottom: 15px;
        }
        
        .sync-erp-modal label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        .sync-erp-modal input[type="text"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        </style>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // Delete product modal
            $('#delete-product-btn').on('click', function() {
                $('#delete-product-modal').show();
            });
            
            // Restore product modal
            $('#restore-product-btn').on('click', function() {
                $('#restore-product-modal').show();
            });
            
            // Close modals
            $('.sync-erp-close, .cancel-btn').on('click', function() {
                $('.sync-erp-modal').hide();
                $('input[type="text"]').val('');
            });
            
            // Delete product form
            $('#delete-product-form').on('submit', function(e) {
                e.preventDefault();
                
                const productCode = $('#delete-product-code').val();
                const reason = $('#delete-reason').val();
                
                $.ajax({
                    url: syncErpAdmin.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'sync_erp_delete_product',
                        nonce: syncErpAdmin.nonce,
                        product_code: productCode,
                        reason: reason
                    },
                    success: function(response) {
                        if (response.success) {
                            alert('<?php _e("Producto eliminado exitosamente", "sync-erp-wc"); ?>');
                            location.reload();
                        } else {
                            alert('<?php _e("Error:", "sync-erp-wc"); ?> ' + response.data);
                        }
                    },
                    error: function() {
                        alert('<?php _e("Error de conexión", "sync-erp-wc"); ?>');
                    }
                });
            });
            
            // Restore product form
            $('#restore-product-form').on('submit', function(e) {
                e.preventDefault();
                
                const productCode = $('#restore-product-code').val();
                
                $.ajax({
                    url: syncErpAdmin.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'sync_erp_restore_product',
                        nonce: syncErpAdmin.nonce,
                        product_code: productCode
                    },
                    success: function(response) {
                        if (response.success) {
                            alert('<?php _e("Producto restaurado exitosamente", "sync-erp-wc"); ?>');
                            location.reload();
                        } else {
                            alert('<?php _e("Error:", "sync-erp-wc"); ?> ' + response.data);
                        }
                    },
                    error: function() {
                        alert('<?php _e("Error de conexión", "sync-erp-wc"); ?>');
                    }
                });
            });
            
            // Restore single product
            $('.restore-single-btn').on('click', function() {
                const productCode = $(this).data('code');
                
                if (confirm('<?php _e("¿Estás seguro de que quieres restaurar este producto?", "sync-erp-wc"); ?>')) {
                    $.ajax({
                        url: syncErpAdmin.ajaxurl,
                        type: 'POST',
                        data: {
                            action: 'sync_erp_restore_product',
                            nonce: syncErpAdmin.nonce,
                            product_code: productCode
                        },
                        success: function(response) {
                            if (response.success) {
                                alert('<?php _e("Producto restaurado exitosamente", "sync-erp-wc"); ?>');
                                location.reload();
                            } else {
                                alert('<?php _e("Error:", "sync-erp-wc"); ?> ' + response.data);
                            }
                        },
                        error: function() {
                            alert('<?php _e("Error de conexión", "sync-erp-wc"); ?>');
                        }
                    });
                }
            });
        });
        </script>
        <?php
    }
    
    /**
     * Get deleted products
     */
    private function get_deleted_products() {
        global $wpdb;
        
        return $wpdb->get_results(
            "SELECT 
                p.ID,
                p.post_title,
                p.post_modified,
                pm1.meta_value as cod_interno,
                pm2.meta_value as deletion_reason
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'cod_interno'
             LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'deletion_reason'
             WHERE p.post_type = 'product' 
             AND p.post_status IN ('trash', 'private')
             ORDER BY p.post_modified DESC
             LIMIT 50",
            ARRAY_A
        );
    }
    
    /**
     * Logs page
     */
    public function logs_page() {
        global $wpdb;
        
        // Get logs with pagination
        $paged = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $per_page = 50;
        $offset = ($paged - 1) * $per_page;
        
        $logs = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}sync_erp_logs 
             ORDER BY timestamp DESC 
             LIMIT %d OFFSET %d",
            $per_page,
            $offset
        ));
        
        $total_logs = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}sync_erp_logs");
        $total_pages = ceil($total_logs / $per_page);
        ?>
        <div class="wrap">
            <h1><?php _e('Logs del Sistema', 'sync-erp-wc'); ?></h1>
            
            <div class="sync-erp-logs-actions">
                <button type="button" class="button" id="refresh-logs-btn">
                    <span class="dashicons dashicons-update"></span>
                    <?php _e('Actualizar', 'sync-erp-wc'); ?>
                </button>
                <button type="button" class="button" id="clear-logs-btn">
                    <span class="dashicons dashicons-trash"></span>
                    <?php _e('Limpiar Logs', 'sync-erp-wc'); ?>
                </button>
            </div>
            
            <div class="sync-erp-table-container">
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th style="width: 150px;"><?php _e('Fecha/Hora', 'sync-erp-wc'); ?></th>
                            <th style="width: 80px;"><?php _e('Nivel', 'sync-erp-wc'); ?></th>
                            <th><?php _e('Mensaje', 'sync-erp-wc'); ?></th>
                            <th style="width: 100px;"><?php _e('Origen', 'sync-erp-wc'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($logs)): ?>
                            <?php foreach ($logs as $log): ?>
                            <tr>
                                <td><?php echo date_i18n('d/m/Y H:i:s', strtotime($log->timestamp)); ?></td>
                                <td>
                                    <span class="sync-erp-log-level sync-erp-log-<?php echo strtolower($log->level); ?>">
                                        <?php echo esc_html($log->level); ?>
                                    </span>
                                </td>
                                <td><?php echo esc_html($log->message); ?></td>
                                <td><?php echo esc_html($log->source ?? '-'); ?></td>
                            </tr>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <tr>
                                <td colspan="4"><?php _e('No hay logs disponibles', 'sync-erp-wc'); ?></td>
                            </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
            
            <?php if ($total_pages > 1): ?>
            <div class="tablenav">
                <div class="tablenav-pages">
                    <?php
                    echo paginate_links(array(
                        'base' => add_query_arg('paged', '%#%'),
                        'format' => '',
                        'prev_text' => __('&laquo;'),
                        'next_text' => __('&raquo;'),
                        'total' => $total_pages,
                        'current' => $paged
                    ));
                    ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        
        <style>
        .sync-erp-logs-actions {
            margin: 20px 0;
        }
        
        .sync-erp-logs-actions .button {
            margin-right: 10px;
        }
        
        .sync-erp-log-level {
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .sync-erp-log-error {
            background: #f8d7da;
            color: #721c24;
        }
        
        .sync-erp-log-warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .sync-erp-log-info {
            background: #d1ecf1;
            color: #0c5460;
        }
        
        .sync-erp-log-debug {
            background: #e2e3e5;
            color: #383d41;
        }
        </style>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            $('#refresh-logs-btn').on('click', function() {
                location.reload();
            });
            
            $('#clear-logs-btn').on('click', function() {
                if (confirm('<?php _e("¿Estás seguro de que quieres limpiar todos los logs?", "sync-erp-wc"); ?>')) {
                    $.ajax({
                        url: syncErpAdmin.ajaxurl,
                        type: 'POST',
                        data: {
                            action: 'sync_erp_clear_logs',
                            nonce: syncErpAdmin.nonce
                        },
                        success: function(response) {
                            if (response.success) {
                                alert('<?php _e("Logs limpiados exitosamente", "sync-erp-wc"); ?>');
                                location.reload();
                            } else {
                                alert('<?php _e("Error:", "sync-erp-wc"); ?> ' + response.data);
                            }
                        }
                    });
                }
            });
        });
        </script>
        <?php
    }
    
    /**
     * Reports page
     */
    public function reports_page() {
        echo '<div class="wrap">';
        echo '<h1>' . __('Reportes - Sincronizador ERP', 'sync-erp-wc') . '</h1>';
        echo '<p>' . __('Esta sección estará disponible próximamente.', 'sync-erp-wc') . '</p>';
        echo '</div>';
    }
    
    /**
     * Save settings
     */
    public function save_settings() {
        if (!wp_verify_nonce($_POST['sync_erp_nonce'], 'sync_erp_save_settings')) {
            wp_die(__('Error de seguridad', 'sync-erp-wc'));
        }
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('No tienes permisos para realizar esta acción.', 'sync-erp-wc'));
        }
        
        $options = array(
            'sync_erp_backend_url',
            'sync_erp_api_key',
            'sync_erp_auto_sync',
            'sync_erp_sync_interval',
            'sync_erp_notifications',
            'sync_erp_log_level',
            'sync_erp_email_notifications',
            'sync_erp_notification_email'
        );
        
        foreach ($options as $option) {
            if (isset($_POST[$option])) {
                update_option($option, sanitize_text_field($_POST[$option]));
            }
        }
        
        // Update cron schedule if interval changed
        $timestamp = wp_next_scheduled('sync_erp_auto_sync');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'sync_erp_auto_sync');
        }
        
        if (get_option('sync_erp_auto_sync') === 'yes') {
            wp_schedule_event(time(), 'sync_erp_interval', 'sync_erp_auto_sync');
        }
        
        wp_redirect(admin_url('admin.php?page=sync-erp-settings&updated=1'));
        exit;
    }
    
    /**
     * Admin notices
     */
    public function admin_notices() {
        if (isset($_GET['updated']) && $_GET['updated'] == '1') {
            echo '<div class="notice notice-success is-dismissible">';
            echo '<p>' . __('Configuración guardada exitosamente.', 'sync-erp-wc') . '</p>';
            echo '</div>';
        }
    }
}