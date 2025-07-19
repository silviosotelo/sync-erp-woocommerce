
/* ===================================================================
   assets/js/admin.js
   JavaScript para el panel de administración
   =================================================================== */

(function ($) {
    'use strict';

    // Variables globales
    let syncInProgress = false;
    let refreshInterval = null;

    // Inicialización cuando el DOM está listo
    $(document).ready(function () {
        initializeDashboard();
        initializeModals();
        initializeFormHandlers();
        initializeAutoRefresh();
        initializeNotifications();
    });

    /**
     * Inicializar dashboard principal
     */
    function initializeDashboard() {
        // Botón de sincronización manual
        $('#manual-sync-btn').on('click', function () {
            if (syncInProgress) return;
            triggerManualSync();
        });

        // Botón de prueba de conexión
        $('#test-connection-btn').on('click', function () {
            testBackendConnection();
        });

        // Botón para ver logs
        $('#view-logs-btn').on('click', function () {
            window.location.href = syncErpAdmin.baseUrl + 'admin.php?page=sync-erp-logs';
        });

        // Auto-actualización de estadísticas
        if ($('.sync-erp-dashboard').length > 0) {
            startStatsAutoRefresh();
        }
    }

    /**
     * Inicializar modales
     */
    function initializeModals() {
        // Botones para abrir modales
        $('#delete-product-btn').on('click', function () {
            showModal('#delete-product-modal');
        });

        $('#restore-product-btn').on('click', function () {
            showModal('#restore-product-modal');
        });

        // Botones para cerrar modales
        $('.sync-erp-close, .cancel-btn').on('click', function () {
            hideAllModals();
        });

        // Cerrar modal al hacer clic fuera
        $('.sync-erp-modal').on('click', function (e) {
            if (e.target === this) {
                hideAllModals();
            }
        });

        // Escape para cerrar modales
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') {
                hideAllModals();
            }
        });
    }

    /**
     * Inicializar manejadores de formularios
     */
    function initializeFormHandlers() {
        // Formulario de eliminación de producto
        $('#delete-product-form').on('submit', function (e) {
            e.preventDefault();
            deleteProduct();
        });

        // Formulario de restauración de producto
        $('#restore-product-form').on('submit', function (e) {
            e.preventDefault();
            restoreProduct();
        });

        // Formulario de configuración
        $('#sync-erp-settings-form').on('submit', function (e) {
            e.preventDefault();
            saveSettings();
        });

        // Botón de generar API key
        $('#generate-api-key').on('click', function () {
            if (confirm(syncErpAdmin.strings.confirmGenerateApiKey)) {
                generateApiKey();
            }
        });

        // Botón de limpiar logs
        $('#clear-logs-btn').on('click', function () {
            if (confirm(syncErpAdmin.strings.confirmClearLogs)) {
                clearLogs();
            }
        });

        // Botón de enviar notificación de prueba
        $('#test-notification-btn').on('click', function () {
            sendTestNotification();
        });

        // Restauración rápida de productos
        $('.restore-single-btn').on('click', function () {
            const productCode = $(this).data('code');
            if (confirm(syncErpAdmin.strings.confirmRestoreProduct)) {
                quickRestoreProduct(productCode);
            }
        });
    }

    /**
     * Inicializar auto-actualización
     */
    function initializeAutoRefresh() {
        // Actualizar logs automáticamente
        if ($('#logs-container').length > 0) {
            setInterval(refreshLogs, 30000); // cada 30 segundos
        }

        // Actualizar estadísticas automáticamente
        if ($('.sync-erp-dashboard').length > 0) {
            setInterval(refreshStats, 60000); // cada minuto
        }
    }

    /**
     * Inicializar sistema de notificaciones
     */
    function initializeNotifications() {
        // Verificar notificaciones pendientes
        checkPendingNotifications();
    }

    /**
     * Activar sincronización manual
     */
    function triggerManualSync() {
        syncInProgress = true;
        const btn = $('#manual-sync-btn');
        const originalText = btn.html();

        btn.prop('disabled', true).html('<span class="dashicons dashicons-update spin"></span> ' + syncErpAdmin.strings.syncing);
        showLoading(syncErpAdmin.strings.syncInProgress);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_manual_sync',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.syncCompleted, 'success');
                    refreshStats();
                    refreshLogs();
                } else {
                    showNotification(syncErpAdmin.strings.syncError + ': ' + response.data, 'error');
                }
            },
            error: function (xhr, status, error) {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
                console.error('Sync error:', error);
            },
            complete: function () {
                btn.prop('disabled', false).html(originalText);
                hideLoading();
                syncInProgress = false;
            }
        });
    }

    /**
     * Probar conexión con backend
     */
    function testBackendConnection() {
        const btn = $('#test-connection-btn');
        const originalText = btn.html();

        btn.prop('disabled', true).html('<span class="dashicons dashicons-admin-plugins spin"></span> ' + syncErpAdmin.strings.testing);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_test_connection',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.connectionSuccess, 'success');
                } else {
                    showNotification(syncErpAdmin.strings.connectionError + ': ' + response.data, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                btn.prop('disabled', false).html(originalText);
            }
        });
    }

    /**
     * Eliminar producto
     */
    function deleteProduct() {
        const productCode = $('#delete-product-code').val();
        const reason = $('#delete-reason').val();

        if (!productCode) {
            showNotification(syncErpAdmin.strings.productCodeRequired, 'error');
            return;
        }

        showLoading(syncErpAdmin.strings.deletingProduct);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_delete_product',
                nonce: syncErpAdmin.nonce,
                product_code: productCode,
                reason: reason
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.productDeleted, 'success');
                    hideAllModals();
                    refreshDeletedProducts();
                } else {
                    showNotification(syncErpAdmin.strings.deleteError + ': ' + response.data, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                hideLoading();
            }
        });
    }

    /**
     * Restaurar producto
     */
    function restoreProduct() {
        const productCode = $('#restore-product-code').val();

        if (!productCode) {
            showNotification(syncErpAdmin.strings.productCodeRequired, 'error');
            return;
        }

        showLoading(syncErpAdmin.strings.restoringProduct);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_restore_product',
                nonce: syncErpAdmin.nonce,
                product_code: productCode
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.productRestored, 'success');
                    hideAllModals();
                    refreshDeletedProducts();
                } else {
                    showNotification(syncErpAdmin.strings.restoreError + ': ' + response.data, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                hideLoading();
            }
        });
    }

    /**
     * Restauración rápida de producto
     */
    function quickRestoreProduct(productCode) {
        const btn = $(`.restore-single-btn[data-code="${productCode}"]`);
        const originalText = btn.text();

        btn.prop('disabled', true).text(syncErpAdmin.strings.restoring);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_restore_product',
                nonce: syncErpAdmin.nonce,
                product_code: productCode
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.productRestored, 'success');
                    btn.closest('tr').fadeOut(500, function () {
                        $(this).remove();
                    });
                } else {
                    showNotification(syncErpAdmin.strings.restoreError + ': ' + response.data, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                btn.prop('disabled', false).text(originalText);
            }
        });
    }

    /**
     * Limpiar logs
     */
    function clearLogs() {
        showLoading(syncErpAdmin.strings.clearingLogs);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_clear_logs',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.logsCleared, 'success');
                    refreshLogs();
                } else {
                    showNotification(syncErpAdmin.strings.clearError + ': ' + response.data, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                hideLoading();
            }
        });
    }

    /**
     * Generar nueva API key
     */
    function generateApiKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let apiKey = '';
        for (let i = 0; i < 32; i++) {
            apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        $('#api_key').val(apiKey);
        showNotification(syncErpAdmin.strings.apiKeyGenerated, 'success');
    }

    /**
     * Enviar notificación de prueba
     */
    function sendTestNotification() {
        const btn = $('#test-notification-btn');
        const originalText = btn.text();

        btn.prop('disabled', true).text(syncErpAdmin.strings.sending);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_test_notification',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success) {
                    showNotification(syncErpAdmin.strings.testNotificationSent, 'success');
                } else {
                    showNotification(syncErpAdmin.strings.notificationError + ': ' + response.data, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                btn.prop('disabled', false).text(originalText);
            }
        });
    }

    /**
     * Actualizar estadísticas
     */
    function refreshStats() {
        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_get_stats',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success && response.data) {
                    updateStatsDisplay(response.data);
                }
            },
            error: function () {
                console.error('Error refreshing stats');
            }
        });
    }

    /**
     * Actualizar logs
     */
    function refreshLogs() {
        const container = $('#logs-container');
        if (container.length === 0) return;

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_get_logs',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success && response.data) {
                    updateLogsDisplay(response.data);
                }
            },
            error: function () {
                console.error('Error refreshing logs');
            }
        });
    }

    /**
     * Actualizar productos eliminados
     */
    function refreshDeletedProducts() {
        const container = $('#deleted-products-container');
        if (container.length === 0) return;

        container.html('<p>' + syncErpAdmin.strings.loading + '</p>');

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_get_deleted_products',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success && response.data) {
                    updateDeletedProductsDisplay(response.data);
                }
            },
            error: function () {
                container.html('<p>' + syncErpAdmin.strings.errorLoading + '</p>');
            }
        });
    }

    /**
     * Actualizar display de estadísticas
     */
    function updateStatsDisplay(data) {
        if (data.summary) {
            $('#productsCreated').text(data.summary.total_created || 0);
            $('#productsUpdated').text(data.summary.total_updated || 0);
            $('#productsDeleted').text(data.summary.total_deleted || 0);
            $('#errors').text(data.summary.total_errors || 0);
        }

        if (data.recent && data.recent.length > 0) {
            const lastSync = new Date(data.recent[0].sync_date);
            $('#lastSync').text(lastSync.toLocaleString());
        }
    }

    /**
     * Actualizar display de logs
     */
    function updateLogsDisplay(logs) {
        const container = $('#logs-container');
        container.empty();

        if (logs && logs.length > 0) {
            logs.forEach(function (log) {
                const logEntry = $('<div class="log-entry"></div>');
                logEntry.html(`
                    <span class="log-timestamp">${log.timestamp}</span>
                    <span class="log-level ${log.level}">${log.level}</span>
                    <span class="log-message">${log.message}</span>
                `);
                container.append(logEntry);
            });
            container.scrollTop(container[0].scrollHeight);
        } else {
            container.html('<div class="log-entry">' + syncErpAdmin.strings.noLogs + '</div>');
        }
    }

    /**
     * Actualizar display de productos eliminados
     */
    function updateDeletedProductsDisplay(products) {
        const container = $('#deleted-products-container');

        if (products && products.length > 0) {
            let tableHtml = `
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>${syncErpAdmin.strings.internalCode}</th>
                            <th>${syncErpAdmin.strings.title}</th>
                            <th>${syncErpAdmin.strings.deletionDate}</th>
                            <th>${syncErpAdmin.strings.reason}</th>
                            <th>${syncErpAdmin.strings.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            products.forEach(function (product) {
                const date = new Date(product.deletion_date || product.post_modified);
                tableHtml += `
                    <tr>
                        <td>${product.cod_interno}</td>
                        <td>${product.post_title}</td>
                        <td>${date.toLocaleDateString()}</td>
                        <td>${product.deletion_reason || syncErpAdmin.strings.notSpecified}</td>
                        <td>
                            <button type="button" class="button button-small restore-single-btn" data-code="${product.cod_interno}">
                                ${syncErpAdmin.strings.restore}
                            </button>
                        </td>
                    </tr>
                `;
            });

            tableHtml += '</tbody></table>';
            container.html(tableHtml);

            // Re-attach event handlers
            $('.restore-single-btn').on('click', function () {
                const productCode = $(this).data('code');
                if (confirm(syncErpAdmin.strings.confirmRestoreProduct)) {
                    quickRestoreProduct(productCode);
                }
            });
        } else {
            container.html('<p>' + syncErpAdmin.strings.noDeletedProducts + '</p>');
        }
    }

    /**
     * Mostrar modal
     */
    function showModal(modalId) {
        $(modalId).fadeIn(300);
        $(modalId).find('input[type="text"]:first').focus();
    }

    /**
     * Ocultar todos los modales
     */
    function hideAllModals() {
        $('.sync-erp-modal').fadeOut(300);
        $('.sync-erp-modal input[type="text"], .sync-erp-modal textarea').val('');
    }

    /**
     * Mostrar loading overlay
     */
    function showLoading(message) {
        let overlay = $('#sync-erp-loading');
        if (overlay.length === 0) {
            overlay = $(`
                <div id="sync-erp-loading" class="sync-erp-loading">
                    <div class="sync-erp-spinner"></div>
                    <p></p>
                </div>
            `);
            $('body').append(overlay);
        }
        overlay.find('p').text(message || syncErpAdmin.strings.processing);
        overlay.fadeIn(300);
    }

    /**
     * Ocultar loading overlay
     */
    function hideLoading() {
        $('#sync-erp-loading').fadeOut(300);
    }

    /**
     * Mostrar notificación
     */
    function showNotification(message, type = 'info', duration = 4000) {
        // Remover notificaciones existentes
        $('.sync-erp-notification').remove();

        const notification = $(`
            <div class="sync-erp-notification ${type}">
                ${message}
            </div>
        `);

        $('body').append(notification);

        setTimeout(() => notification.addClass('show'), 100);

        setTimeout(() => {
            notification.removeClass('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    /**
     * Iniciar auto-actualización de estadísticas
     */
    function startStatsAutoRefresh() {
        refreshInterval = setInterval(refreshStats, 30000); // cada 30 segundos
    }

    /**
     * Detener auto-actualización
     */
    function stopStatsAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    /**
     * Verificar notificaciones pendientes
     */
    function checkPendingNotifications() {
        // Verificar si hay errores recientes
        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_check_notifications',
                nonce: syncErpAdmin.nonce
            },
            success: function (response) {
                if (response.success && response.data) {
                    if (response.data.errors > 0) {
                        showNotification(
                            syncErpAdmin.strings.recentErrors.replace('%d', response.data.errors),
                            'warning',
                            8000
                        );
                    }
                }
            },
            error: function () {
                // Silently fail
            }
        });
    }

    /**
     * Exportar datos
     */
    function exportData(format = 'csv') {
        const btn = $('#export-data-btn');
        const originalText = btn.text();

        btn.prop('disabled', true).text(syncErpAdmin.strings.exporting);

        $.ajax({
            url: syncErpAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'sync_erp_export_data',
                nonce: syncErpAdmin.nonce,
                format: format
            },
            success: function (response) {
                if (response.success && response.data.url) {
                    // Crear enlace de descarga temporal
                    const link = document.createElement('a');
                    link.href = response.data.url;
                    link.download = response.data.filename;
                    link.click();

                    showNotification(syncErpAdmin.strings.exportCompleted, 'success');
                } else {
                    showNotification(syncErpAdmin.strings.exportError, 'error');
                }
            },
            error: function () {
                showNotification(syncErpAdmin.strings.connectionError, 'error');
            },
            complete: function () {
                btn.prop('disabled', false).text(originalText);
            }
        });
    }

    // Exponer funciones públicas
    window.syncErpAdmin = window.syncErpAdmin || {};
    window.syncErpAdmin.triggerManualSync = triggerManualSync;
    window.syncErpAdmin.testConnection = testBackendConnection;
    window.syncErpAdmin.refreshStats = refreshStats;
    window.syncErpAdmin.refreshLogs = refreshLogs;
    window.syncErpAdmin.exportData = exportData;
    window.syncErpAdmin.showNotification = showNotification;

    // Event listeners globales
    $(window).on('beforeunload', function () {
        if (syncInProgress) {
            return syncErpAdmin.strings.syncInProgressWarning;
        }
    });

    // Cleanup al salir
    $(window).on('unload', function () {
        stopStatsAutoRefresh();
    });

})(jQuery);