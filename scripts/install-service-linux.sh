#!/bin/bash

# ===================================================================
# Script de instalación de servicio systemd para Linux
# Farmatotal Sync ERP v2.0
# ===================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="farmatotal-sync"
SERVICE_FILE="$SCRIPT_DIR/$SERVICE_NAME.service"
SYSTEMD_DIR="/etc/systemd/system"
INSTALL_DIR="/opt/sync-erp-woocommerce"

echo ""
echo "============================================================"
echo "  INSTALANDO SERVICIO SYSTEMD - FARMATOTAL SYNC"
echo "============================================================"
echo ""

# Verificar permisos de root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Este script debe ejecutarse como root"
  echo "   Usa: sudo bash scripts/install-service-linux.sh"
  exit 1
fi

# Verificar que existe Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no está instalado"
  echo "   Instala Node.js 16+ antes de continuar"
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js encontrado: $NODE_VERSION"

# Verificar que existe el archivo .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "❌ Archivo .env no encontrado"
  echo "   Copia .env.example a .env y configura tus credenciales"
  exit 1
fi

echo "✅ Archivo .env encontrado"

# Preguntar directorio de instalación
echo ""
read -p "📁 Directorio de instalación [$INSTALL_DIR]: " USER_INSTALL_DIR
INSTALL_DIR="${USER_INSTALL_DIR:-$INSTALL_DIR}"

# Crear directorio de instalación si no existe
if [ ! -d "$INSTALL_DIR" ]; then
  echo "📦 Creando directorio $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
fi

# Copiar archivos
echo "📦 Copiando archivos al directorio de instalación..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'logs/*' \
  "$PROJECT_DIR/" "$INSTALL_DIR/"

# Instalar dependencias
echo "📦 Instalando dependencias de producción..."
cd "$INSTALL_DIR"
npm install --production

# Crear directorios necesarios
echo "📁 Creando directorios de datos..."
mkdir -p "$INSTALL_DIR/logs/errors"
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/backups"
mkdir -p "$INSTALL_DIR/reports/csv"
mkdir -p "$INSTALL_DIR/reports/daily"

# Configurar permisos
echo "🔐 Configurando permisos..."
chown -R www-data:www-data "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/.env"

# Actualizar archivo de servicio con el directorio correcto
echo "⚙️  Configurando servicio systemd..."
sed "s|/opt/sync-erp-woocommerce|$INSTALL_DIR|g" "$SERVICE_FILE" > /tmp/farmatotal-sync.service

# Copiar archivo de servicio
cp /tmp/farmatotal-sync.service "$SYSTEMD_DIR/$SERVICE_NAME.service"
rm /tmp/farmatotal-sync.service

# Recargar systemd
echo "🔄 Recargando systemd..."
systemctl daemon-reload

# Habilitar servicio
echo "✅ Habilitando servicio para inicio automático..."
systemctl enable "$SERVICE_NAME.service"

# Iniciar servicio
echo "🚀 Iniciando servicio..."
systemctl start "$SERVICE_NAME.service"

# Esperar un momento para que inicie
sleep 2

# Verificar estado
if systemctl is-active --quiet "$SERVICE_NAME.service"; then
  echo ""
  echo "✅ ¡Servicio instalado e iniciado correctamente!"
  echo ""
  echo "📊 Dashboard: http://localhost:3001"
  echo ""
  echo "📋 Comandos útiles:"
  echo "   - Ver estado:    systemctl status $SERVICE_NAME"
  echo "   - Ver logs:      journalctl -u $SERVICE_NAME -f"
  echo "   - Reiniciar:     systemctl restart $SERVICE_NAME"
  echo "   - Detener:       systemctl stop $SERVICE_NAME"
  echo "   - Deshabilitar:  systemctl disable $SERVICE_NAME"
  echo "   - Desinstalar:   sudo bash scripts/uninstall-service-linux.sh"
  echo ""
  echo "📁 Logs de aplicación:"
  echo "   - General: $INSTALL_DIR/logs/"
  echo "   - Errores: $INSTALL_DIR/logs/errors/"
  echo ""
else
  echo ""
  echo "❌ El servicio no pudo iniciarse"
  echo "   Verifica los logs: journalctl -u $SERVICE_NAME -n 50"
  echo ""
  exit 1
fi
