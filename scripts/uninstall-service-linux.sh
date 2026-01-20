#!/bin/bash

# ===================================================================
# Script de desinstalación de servicio systemd para Linux
# Farmatotal Sync ERP v2.0
# ===================================================================

set -e

SERVICE_NAME="farmatotal-sync"
SYSTEMD_DIR="/etc/systemd/system"
INSTALL_DIR="/opt/sync-erp-woocommerce"

echo ""
echo "============================================================"
echo "  DESINSTALANDO SERVICIO SYSTEMD - FARMATOTAL SYNC"
echo "============================================================"
echo ""

# Verificar permisos de root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Este script debe ejecutarse como root"
  echo "   Usa: sudo bash scripts/uninstall-service-linux.sh"
  exit 1
fi

# Verificar si el servicio existe
if [ ! -f "$SYSTEMD_DIR/$SERVICE_NAME.service" ]; then
  echo "⚠️  El servicio no está instalado"
  exit 0
fi

# Detener servicio si está corriendo
echo "🛑 Deteniendo servicio..."
systemctl stop "$SERVICE_NAME.service" 2>/dev/null || true

# Deshabilitar servicio
echo "🔓 Deshabilitando servicio..."
systemctl disable "$SERVICE_NAME.service" 2>/dev/null || true

# Eliminar archivo de servicio
echo "🗑️  Eliminando archivo de servicio..."
rm -f "$SYSTEMD_DIR/$SERVICE_NAME.service"

# Recargar systemd
echo "🔄 Recargando systemd..."
systemctl daemon-reload
systemctl reset-failed

echo ""
echo "✅ Servicio desinstalado correctamente"
echo ""

# Preguntar si eliminar archivos de instalación
read -p "¿Deseas eliminar los archivos de instalación en $INSTALL_DIR? (s/N): " REMOVE_FILES
if [[ "$REMOVE_FILES" =~ ^[SsYy]$ ]]; then
  read -p "⚠️  ¿Estás seguro? Se eliminarán TODOS los datos, logs y configuración (s/N): " CONFIRM
  if [[ "$CONFIRM" =~ ^[SsYy]$ ]]; then
    echo "🗑️  Eliminando $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    echo "✅ Archivos eliminados"
  else
    echo "ℹ️  Archivos NO eliminados: $INSTALL_DIR"
  fi
else
  echo "ℹ️  Archivos de instalación conservados en: $INSTALL_DIR"
  echo "   Para eliminarlos manualmente: sudo rm -rf $INSTALL_DIR"
fi

echo ""
echo "✅ Desinstalación completada"
echo ""
