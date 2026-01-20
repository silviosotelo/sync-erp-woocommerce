#!/bin/bash

# ===================================================================
# Script de restauración desde backup
# Farmatotal Sync ERP v2.0
# ===================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "============================================================"
echo "  RESTAURACIÓN DESDE BACKUP - FARMATOTAL SYNC"
echo "============================================================"
echo ""

# Verificar que existan backups
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
  echo -e "${RED}❌ No hay backups disponibles en $BACKUP_DIR${NC}"
  exit 1
fi

# Listar backups disponibles
echo "Backups disponibles:"
echo ""
select BACKUP_FILE in "$BACKUP_DIR"/sync-backup-*.tar.gz "Cancelar"; do
  if [ "$BACKUP_FILE" == "Cancelar" ]; then
    echo "Operación cancelada"
    exit 0
  elif [ -n "$BACKUP_FILE" ]; then
    break
  fi
done

echo ""
echo -e "${YELLOW}⚠️  ADVERTENCIA${NC}"
echo "Esta operación sobrescribirá:"
echo "  - Base de datos SQLite (data/sync_queue.db)"
echo "  - Archivo de configuración (.env)"
echo "  - Logs y reportes"
echo ""
read -p "¿Estás seguro de continuar? (escribe 'SI' para confirmar): " CONFIRM

if [ "$CONFIRM" != "SI" ]; then
  echo "Operación cancelada"
  exit 0
fi

echo ""
echo "📦 Restaurando desde: $(basename $BACKUP_FILE)"
echo ""

# Detener servicio si está corriendo
echo "🛑 Deteniendo servicio (si está corriendo)..."
if command -v systemctl &> /dev/null; then
  sudo systemctl stop farmatotal-sync 2>/dev/null || true
fi
if command -v pm2 &> /dev/null; then
  pm2 stop farmatotal-sync 2>/dev/null || true
fi

# Crear backup de seguridad del estado actual
echo "📦 Creando backup de seguridad del estado actual..."
SAFETY_BACKUP="$BACKUP_DIR/pre-restore-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SAFETY_BACKUP"
[ -f "$PROJECT_DIR/data/sync_queue.db" ] && cp "$PROJECT_DIR/data/sync_queue.db" "$SAFETY_BACKUP/"
[ -f "$PROJECT_DIR/.env" ] && cp "$PROJECT_DIR/.env" "$SAFETY_BACKUP/"
echo "✅ Backup de seguridad creado en: $SAFETY_BACKUP"

# Extraer backup
echo "📦 Extrayendo backup..."
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_CONTENT=$(ls "$TEMP_DIR")

# Restaurar base de datos
if [ -f "$TEMP_DIR/$BACKUP_CONTENT/sync_queue.db" ]; then
  echo "💾 Restaurando base de datos..."
  cp "$TEMP_DIR/$BACKUP_CONTENT/sync_queue.db" "$PROJECT_DIR/data/sync_queue.db"
  echo "✅ Base de datos restaurada"
else
  echo -e "${YELLOW}⚠️  Base de datos no encontrada en el backup${NC}"
fi

# Restaurar .env
if [ -f "$TEMP_DIR/$BACKUP_CONTENT/.env" ]; then
  echo "⚙️  Restaurando configuración..."
  cp "$TEMP_DIR/$BACKUP_CONTENT/.env" "$PROJECT_DIR/.env"
  echo "✅ Configuración restaurada"
else
  echo -e "${YELLOW}⚠️  Archivo .env no encontrado en el backup${NC}"
fi

# Restaurar logs (opcional)
if [ -d "$TEMP_DIR/$BACKUP_CONTENT/logs" ]; then
  read -p "¿Restaurar logs también? (s/N): " RESTORE_LOGS
  if [[ "$RESTORE_LOGS" =~ ^[SsYy]$ ]]; then
    echo "📋 Restaurando logs..."
    cp -r "$TEMP_DIR/$BACKUP_CONTENT/logs/"* "$PROJECT_DIR/logs/" 2>/dev/null || true
    echo "✅ Logs restaurados"
  fi
fi

# Restaurar reportes (opcional)
if [ -d "$TEMP_DIR/$BACKUP_CONTENT/reports" ]; then
  read -p "¿Restaurar reportes también? (s/N): " RESTORE_REPORTS
  if [[ "$RESTORE_REPORTS" =~ ^[SsYy]$ ]]; then
    echo "📊 Restaurando reportes..."
    cp -r "$TEMP_DIR/$BACKUP_CONTENT/reports/"* "$PROJECT_DIR/reports/" 2>/dev/null || true
    echo "✅ Reportes restaurados"
  fi
fi

# Limpiar archivos temporales
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}✅ Restauración completada${NC}"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Verificar que .env tenga las credenciales correctas"
echo "  2. Reiniciar el servicio:"
echo "     - systemd: sudo systemctl start farmatotal-sync"
echo "     - PM2: pm2 start farmatotal-sync"
echo "  3. Verificar logs: tail -f logs/\$(date +%Y-%m-%d).log"
echo ""
echo "💾 Backup de seguridad del estado anterior en: $SAFETY_BACKUP"
echo ""
