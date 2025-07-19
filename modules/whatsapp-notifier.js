/**
 * modules/whatsapp-notifier.js
 * Módulo de notificaciones WhatsApp con soporte para QR en dashboard
 */

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

class WhatsAppNotifier {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.authDir = path.join(__dirname, '..', 'tmp', 'whatsapp-auth');
        this.recipientNumber = process.env.WHATSAPP_RECIPIENT || null;
        this.maxRetries = 3;
        this.reconnectAttempts = 0;
        this.currentQR = null;
        this.qrUpdateCallbacks = new Set();
        this.statusUpdateCallbacks = new Set();
        
        // Crear directorio de autenticación si no existe
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    // Método para registrar callbacks de actualización de QR
    onQRUpdate(callback) {
        this.qrUpdateCallbacks.add(callback);
        return () => this.qrUpdateCallbacks.delete(callback);
    }

    // Método para registrar callbacks de actualización de estado
    onStatusUpdate(callback) {
        this.statusUpdateCallbacks.add(callback);
        return () => this.statusUpdateCallbacks.delete(callback);
    }

    // Notificar a todos los callbacks sobre cambios de QR
    notifyQRUpdate(qr) {
        this.currentQR = qr;
        this.qrUpdateCallbacks.forEach(callback => {
            try {
                callback(qr);
            } catch (error) {
                console.error('Error en QR callback:', error);
            }
        });
    }

    // Notificar a todos los callbacks sobre cambios de estado
    notifyStatusUpdate(status) {
        this.statusUpdateCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Error en status callback:', error);
            }
        });
    }

    async initialize() {
        try {
            if (this.isConnecting) {
                console.log('⚠️ WhatsApp ya se está inicializando...');
                return;
            }

            console.log('📱 Inicializando WhatsApp...');
            this.isConnecting = true;
            this.notifyStatusUpdate({ status: 'connecting', message: 'Inicializando WhatsApp...' });
            
            if (!this.recipientNumber) {
                throw new Error('WHATSAPP_RECIPIENT no configurado en .env');
            }
            
            // Configurar autenticación multi-archivo
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            // Crear socket de WhatsApp
            this.sock = makeWASocket({
                auth: state,
                logger: this.createLogger(),
                browser: ['Sincronizador ERP', 'Chrome', '1.0.0']
            });
            
            // Configurar eventos
            this.setupEventHandlers(saveCreds);
            
            console.log('✅ WhatsApp inicializado - Esperando conexión...');
            
        } catch (error) {
            this.isConnecting = false;
            console.error('❌ Error inicializando WhatsApp:', error.message);
            this.notifyStatusUpdate({ status: 'error', message: error.message });
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        // Evento de actualización de credenciales
        this.sock.ev.on('creds.update', saveCreds);
        
        // Evento de actualización de conexión
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 QR Code generado para WhatsApp');
                this.notifyQRUpdate(qr);
                this.notifyStatusUpdate({ 
                    status: 'qr_ready', 
                    message: 'Escanea el código QR con tu WhatsApp',
                    qr: qr 
                });
            }
            
            if (connection === 'close') {
                this.isConnecting = false;
                let shouldReconnect = false;
                
                if (lastDisconnect && lastDisconnect.error) {
                    if (lastDisconnect.error instanceof Boom) {
                        shouldReconnect = lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
                    } else if (lastDisconnect.error.output && lastDisconnect.error.output.statusCode) {
                        shouldReconnect = lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
                    } else {
                        shouldReconnect = true;
                    }
                } else {
                    shouldReconnect = true;
                }
                
                console.log('📱 WhatsApp desconectado:', lastDisconnect?.error?.message || 'Razón desconocida');
                this.isConnected = false;
                this.currentQR = null;
                
                if (shouldReconnect && this.reconnectAttempts < this.maxRetries) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Reintentando conexión WhatsApp (${this.reconnectAttempts}/${this.maxRetries})...`);
                    this.notifyStatusUpdate({ 
                        status: 'reconnecting', 
                        message: `Reintentando conexión... (${this.reconnectAttempts}/${this.maxRetries})` 
                    });
                    setTimeout(() => this.initialize(), 5000);
                } else {
                    console.log('❌ WhatsApp: Máximo de reintentos alcanzado o sesión cerrada');
                    this.notifyStatusUpdate({ 
                        status: 'disconnected', 
                        message: 'Máximo de reintentos alcanzado o sesión cerrada' 
                    });
                    if (lastDisconnect?.error) {
                        console.log('❌ Detalles del error:', lastDisconnect.error.message);
                    }
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado exitosamente');
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.currentQR = null;
                
                this.notifyStatusUpdate({ 
                    status: 'connected', 
                    message: 'WhatsApp conectado exitosamente' 
                });
                
                // Enviar mensaje de confirmación
                this.sendNotification('🎉 Sincronizador ERP conectado a WhatsApp\n\nSistema listo para enviar notificaciones.')
                    .catch(err => console.log('⚠️ Error enviando mensaje de confirmación:', err.message));
            }
        });
        
        // Evento de mensajes (opcional - para responder a comandos)
        this.sock.ev.on('messages.upsert', async (m) => {
            if (process.env.WHATSAPP_RESPOND_COMMANDS === 'true') {
                await this.handleIncomingMessage(m);
            }
        });
    }

    async handleIncomingMessage(messageUpdate) {
        try {
            const messages = messageUpdate.messages;
            
            for (const message of messages) {
                // Solo procesar mensajes de texto y que no sean del bot
                if (message.key.fromMe || !message.message?.conversation) continue;
                
                const text = message.message.conversation.toLowerCase();
                const from = message.key.remoteJid;
                
                // Solo responder al número configurado como destinatario
                if (from !== this.formatPhoneNumber(this.recipientNumber)) continue;
                
                let response = null;
                
                switch (text) {
                    case '/status':
                    case 'status':
                        response = await this.generateStatusMessage();
                        break;
                    case '/help':
                    case 'help':
                        response = this.generateHelpMessage();
                        break;
                    case '/sync':
                    case 'sync':
                        response = '🔄 Iniciando sincronización manual...\n\nPuedes ver el progreso en el dashboard.';
                        // Aquí podrías triggear una sincronización manual
                        break;
                    default:
                        if (text.startsWith('/')) {
                            response = '❓ Comando no reconocido. Envía "help" para ver comandos disponibles.';
                        }
                        break;
                }
                
                if (response) {
                    await this.sock.sendMessage(from, { text: response });
                }
            }
        } catch (error) {
            console.error('❌ Error procesando mensaje WhatsApp:', error.message);
        }
    }

    async sendNotification(message, phoneNumber = null) {
        try {
            if (!this.isConnected || !this.sock) {
                throw new Error('WhatsApp no está conectado');
            }
            
            const recipient = phoneNumber || this.recipientNumber;
            if (!recipient) {
                throw new Error('Número de destinatario no configurado');
            }
            
            const formattedNumber = this.formatPhoneNumber(recipient);
            
            // Agregar timestamp al mensaje
            const timestamp = new Date().toLocaleString('es-PY', { 
                timeZone: 'America/Asuncion',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const fullMessage = `${message}\n\n🕒 ${timestamp}`;
            
            await this.sock.sendMessage(formattedNumber, { text: fullMessage });
            
            console.log('📱 Notificación WhatsApp enviada exitosamente');
            return { success: true, message: 'Mensaje enviado' };
            
        } catch (error) {
            console.error('❌ Error enviando notificación WhatsApp:', error.message);
            throw error;
        }
    }

    async sendSyncReport(stats) {
        try {
            const { productsCreated, productsUpdated, productsDeleted, errors, durationMs } = stats;
            
            const message = `📊 REPORTE DE SINCRONIZACIÓN\n\n` +
                          `✅ Productos creados: ${productsCreated}\n` +
                          `🔄 Productos actualizados: ${productsUpdated}\n` +
                          `🗑️ Productos eliminados: ${productsDeleted}\n` +
                          `❌ Errores: ${errors}\n` +
                          `⏱️ Duración: ${Math.round(durationMs / 1000)}s\n\n` +
                          `🎯 Sincronización ${errors > 0 ? 'completada con errores' : 'exitosa'}`;
            
            await this.sendNotification(message);
            
        } catch (error) {
            console.error('❌ Error enviando reporte de sincronización:', error.message);
        }
    }

    async sendErrorAlert(errorMessage, context = '') {
        try {
            const message = `🚨 ALERTA DE ERROR\n\n` +
                          `📍 Contexto: ${context}\n` +
                          `❌ Error: ${errorMessage}\n\n` +
                          `🔧 Revisa el dashboard para más detalles`;
            
            await this.sendNotification(message);
            
        } catch (error) {
            console.error('❌ Error enviando alerta de error:', error.message);
        }
    }

    async generateStatusMessage() {
        try {
            // Verificar si el módulo sync-enhanced existe antes de importarlo
            let cronStatus = { active: false, interval: 'N/A' };
            
            try {
                const { getCronStatus } = require('../sync-enhanced');
                cronStatus = getCronStatus();
            } catch (importError) {
                console.log('⚠️ No se pudo importar sync-enhanced:', importError.message);
            }
            
            const features = {
                multiInventory: process.env.MULTI_INVENTORY_ENABLED === 'true',
                autoSync: process.env.AUTO_SYNC_ENABLED !== 'false',
                email: process.env.SMTP_ENABLED === 'true'
            };
            
            const message = `📊 ESTADO DEL SISTEMA\n\n` +
                          `🔄 Auto-Sync: ${cronStatus.active ? '✅ ACTIVO' : '❌ INACTIVO'}\n` +
                          `📦 Multi-Inventario: ${features.multiInventory ? '✅' : '❌'}\n` +
                          `📧 Email: ${features.email ? '✅' : '❌'}\n` +
                          `⏰ Intervalo: ${cronStatus.interval || 10} minutos\n\n` +
                          `🌐 Dashboard: http://localhost:${process.env.PORT || 3001}`;
            
            return message;
            
        } catch (error) {
            return `❌ Error obteniendo estado del sistema: ${error.message}`;
        }
    }

    generateHelpMessage() {
        return `📱 COMANDOS DISPONIBLES\n\n` +
               `📊 status - Estado del sistema\n` +
               `🔄 sync - Iniciar sincronización manual\n` +
               `❓ help - Mostrar esta ayuda\n\n` +
               `🤖 Respondo automáticamente a estos comandos.\n` +
               `También recibirás notificaciones automáticas de sincronizaciones y errores.`;
    }

    formatPhoneNumber(phoneNumber) {
        // Limpiar y formatear número de teléfono
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Si no empieza con código de país, asumir Paraguay (+595)
        if (!cleaned.startsWith('595') && cleaned.length <= 10) {
            cleaned = '595' + cleaned;
        }
        
        return cleaned + '@s.whatsapp.net';
    }

    createLogger() {
        // Logger personalizado para Baileys con todos los métodos necesarios
        const baseLogger = {
            level: 'error', // Solo mostrar errores por defecto
            trace: () => {},
            debug: () => {},
            info: (msg) => {
                if (typeof msg === 'string' && (msg.includes('connection') || msg.includes('auth'))) {
                    console.log('📱 WhatsApp:', msg);
                }
            },
            warn: (msg) => console.log('⚠️ WhatsApp:', msg),
            error: (msg) => console.log('❌ WhatsApp:', msg),
            fatal: (msg) => console.log('💥 WhatsApp:', msg),
            
            // Método child necesario para Baileys
            child: (bindings) => {
                // Retornar el mismo logger pero con contexto adicional
                return {
                    ...baseLogger,
                    trace: () => {},
                    debug: () => {},
                    info: (msg) => {
                        if (typeof msg === 'string' && (msg.includes('connection') || msg.includes('auth'))) {
                            console.log('📱 WhatsApp [' + (bindings.class || 'unknown') + ']:', msg);
                        }
                    },
                    warn: (msg) => console.log('⚠️ WhatsApp [' + (bindings.class || 'unknown') + ']:', msg),
                    error: (msg) => console.log('❌ WhatsApp [' + (bindings.class || 'unknown') + ']:', msg),
                    fatal: (msg) => console.log('💥 WhatsApp [' + (bindings.class || 'unknown') + ']:', msg),
                    child: (childBindings) => baseLogger.child({...bindings, ...childBindings})
                };
            }
        };
        
        return baseLogger;
    }

    async getStatus() {
        try {
            return {
                enabled: true,
                connected: this.isConnected,
                connecting: this.isConnecting,
                status: this.isConnected ? 'connected' : (this.isConnecting ? 'connecting' : 'disconnected'),
                recipient: this.recipientNumber ? `${this.recipientNumber.substring(0, 3)}***${this.recipientNumber.slice(-2)}` : null,
                reconnectAttempts: this.reconnectAttempts,
                maxRetries: this.maxRetries,
                hasQR: !!this.currentQR,
                qr: this.currentQR,
                message: this.isConnected ? 'WhatsApp conectado y listo' : 
                        (this.isConnecting ? 'Conectando a WhatsApp...' : 'WhatsApp desconectado')
            };
        } catch (error) {
            return {
                enabled: true,
                connected: false,
                connecting: false,
                status: 'error',
                message: error.message
            };
        }
    }

    async disconnect() {
        try {
            if (this.sock) {
                console.log('📱 Desconectando WhatsApp...');
                await this.sock.logout();
                this.sock = null;
                this.isConnected = false;
                this.isConnecting = false;
                this.currentQR = null;
                this.notifyStatusUpdate({ status: 'disconnected', message: 'WhatsApp desconectado' });
                console.log('✅ WhatsApp desconectado');
            }
        } catch (error) {
            console.error('❌ Error desconectando WhatsApp:', error.message);
        }
    }

    // Método para limpiar archivos de sesión (útil para reiniciar conexión)
    async clearSession() {
        try {
            await this.disconnect();
            
            if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
                console.log('🧹 Sesión WhatsApp limpiada');
            }
            
            // Recrear directorio
            fs.mkdirSync(this.authDir, { recursive: true });
            this.notifyStatusUpdate({ status: 'session_cleared', message: 'Sesión limpiada, listo para nueva conexión' });
            
        } catch (error) {
            console.error('❌ Error limpiando sesión WhatsApp:', error.message);
            throw error;
        }
    }

    // Método para obtener QR como data URL para mostrar en el dashboard
    async getQRDataURL() {
        if (!this.currentQR) {
            return null;
        }

        try {
            // Usar qrcode para generar imagen base64
            const QRCode = require('qrcode');
            const qrDataURL = await QRCode.toDataURL(this.currentQR, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            return qrDataURL;
        } catch (error) {
            console.error('Error generando QR data URL:', error.message);
            return null;
        }
    }
}

// Instancia singleton
let whatsappInstance = null;

module.exports = {
    async initialize() {
        if (!whatsappInstance) {
            whatsappInstance = new WhatsAppNotifier();
            await whatsappInstance.initialize();
        }
        return whatsappInstance;
    },
    
    getInstance() {
        return whatsappInstance;
    },
    
    async sendNotification(message, phoneNumber = null) {
        if (!whatsappInstance) {
            whatsappInstance = new WhatsAppNotifier();
            await whatsappInstance.initialize();
        }
        return whatsappInstance.sendNotification(message, phoneNumber);
    },
    
    async sendSyncReport(stats) {
        if (!whatsappInstance) return;
        return whatsappInstance.sendSyncReport(stats);
    },
    
    async sendErrorAlert(errorMessage, context = '') {
        if (!whatsappInstance) return;
        return whatsappInstance.sendErrorAlert(errorMessage, context);
    },
    
    async getStatus() {
        if (!whatsappInstance) {
            return {
                enabled: false,
                connected: false,
                connecting: false,
                status: 'not_initialized',
                message: 'WhatsApp no inicializado'
            };
        }
        return whatsappInstance.getStatus();
    },
    
    async disconnect() {
        if (whatsappInstance) {
            await whatsappInstance.disconnect();
            whatsappInstance = null;
        }
    },
    
    async clearSession() {
        if (whatsappInstance) {
            await whatsappInstance.clearSession();
            whatsappInstance = null;
        }
    }
};