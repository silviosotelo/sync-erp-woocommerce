/**
 * modules/whatsapp-notifier.js
 * Módulo de notificaciones WhatsApp usando @whiskeysockets/baileys
 * Configuración modular para el Sincronizador ERP
 */

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

class WhatsAppNotifier {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.authDir = path.join(__dirname, '..', 'tmp', 'whatsapp-auth');
        this.recipientNumber = process.env.WHATSAPP_RECIPIENT || null;
        this.maxRetries = 3;
        this.reconnectAttempts = 0;
        
        // Crear directorio de autenticación si no existe
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    async initialize() {
        try {
            console.log('📱 Inicializando WhatsApp...');
            
            if (!this.recipientNumber) {
                throw new Error('WHATSAPP_RECIPIENT no configurado en .env');
            }
            
            // Configurar autenticación multi-archivo
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            // Crear socket de WhatsApp
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true, // Mostrar QR en terminal para primera configuración
                logger: this.createLogger(),
                browser: ['Sincronizador ERP', 'Chrome', '1.0.0']
            });
            
            // Configurar eventos
            this.setupEventHandlers(saveCreds);
            
            console.log('✅ WhatsApp inicializado - Esperando conexión...');
            
        } catch (error) {
            console.error('❌ Error inicializando WhatsApp:', error.message);
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
                console.log('\n📱 CÓDIGO QR PARA WHATSAPP:');
                console.log('   1. Abre WhatsApp en tu teléfono');
                console.log('   2. Ve a Configuración > Dispositivos vinculados');
                console.log('   3. Escanea el código QR que aparece arriba');
                console.log('   4. Espera la confirmación de conexión\n');
            }
            
            if (connection === 'close') {
                // Corrección: Usar JavaScript puro en lugar de TypeScript assertion
                let shouldReconnect = false;
                
                if (lastDisconnect && lastDisconnect.error) {
                    // Verificar si es una instancia de Boom y obtener el statusCode
                    if (lastDisconnect.error instanceof Boom) {
                        shouldReconnect = lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
                    } else if (lastDisconnect.error.output && lastDisconnect.error.output.statusCode) {
                        // Fallback para otros tipos de error que tengan la estructura similar
                        shouldReconnect = lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
                    } else {
                        // Si no podemos determinar el tipo de error, intentar reconectar
                        shouldReconnect = true;
                    }
                } else {
                    shouldReconnect = true;
                }
                
                console.log('📱 WhatsApp desconectado:', lastDisconnect?.error?.message || 'Razón desconocida');
                this.isConnected = false;
                
                if (shouldReconnect && this.reconnectAttempts < this.maxRetries) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Reintentando conexión WhatsApp (${this.reconnectAttempts}/${this.maxRetries})...`);
                    setTimeout(() => this.initialize(), 5000);
                } else {
                    console.log('❌ WhatsApp: Máximo de reintentos alcanzado o sesión cerrada');
                    if (lastDisconnect?.error) {
                        console.log('❌ Detalles del error:', lastDisconnect.error.message);
                    }
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado exitosamente');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
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
        // Logger personalizado para Baileys (menos verboso)
        return {
            trace: () => {},
            debug: () => {},
            info: (msg) => {
                if (typeof msg === 'string' && (msg.includes('connection') || msg.includes('auth'))) {
                    console.log('📱 WhatsApp:', msg);
                }
            },
            warn: (msg) => console.log('⚠️ WhatsApp:', msg),
            error: (msg) => console.log('❌ WhatsApp:', msg),
            fatal: (msg) => console.log('💥 WhatsApp:', msg)
        };
    }

    async getStatus() {
        try {
            return {
                enabled: true,
                connected: this.isConnected,
                status: this.isConnected ? 'connected' : 'disconnected',
                recipient: this.recipientNumber ? `${this.recipientNumber.substring(0, 3)}***${this.recipientNumber.slice(-2)}` : null,
                reconnectAttempts: this.reconnectAttempts,
                maxRetries: this.maxRetries,
                message: this.isConnected ? 'WhatsApp conectado y listo' : 'WhatsApp desconectado'
            };
        } catch (error) {
            return {
                enabled: true,
                connected: false,
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
            
        } catch (error) {
            console.error('❌ Error limpiando sesión WhatsApp:', error.message);
            throw error;
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