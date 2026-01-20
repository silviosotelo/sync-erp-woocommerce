#!/bin/bash

# ===================================================================
# Script de respaldo automático para producción
# Farmatotal Sync ERP v2.0
# ===================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="sync-backup-$DATE"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo ""
echo "============================================================"
echo "  RESPALDO AUTOMÁTICO - FARMATOTAL SYNC"
echo "============================================================"
echo ""
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Destino: $BACKUP_DIR/$BACKUP_NAME/"
echo ""

# Crear directorio de este backup
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# 1. Respaldar base de datos SQLite
echo "📦 Respaldando base de datos SQLite..."
if [ -f "$PROJECT_DIR/data/sync_queue.db" ]; then
  cp "$PROJECT_DIR/data/sync_queue.db" "$BACKUP_DIR/$BACKUP_NAME/sync_queue.db"
  echo "✅ Base de datos respaldada"
else
  echo "⚠️  Base de datos no encontrada"
fi

# 2. Respaldar archivo .env
echo "📦 Respaldando configuración .env..."
if [ -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env" "$BACKUP_DIR/$BACKUP_NAME/.env"
  echo "✅ Configuración respaldada"
else
  echo "⚠️  Archivo .env no encontrado"
fi

# 3. Respaldar logs recientes (últimos 7 días)
echo "📦 Respaldando logs recientes..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME/logs"
find "$PROJECT_DIR/logs" -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/$BACKUP_NAME/logs/" \; 2>/dev/null || true
echo "✅ Logs respaldados"

# 4. Respaldar reportes recientes (últimos 30 días)
echo "📦 Respaldando reportes..."
if [ -d "$PROJECT_DIR/reports" ]; then
  mkdir -p "$BACKUP_DIR/$BACKUP_NAME/reports"
  find "$PROJECT_DIR/reports" -type f -mtime -30 -exec cp --parents {} "$BACKUP_DIR/$BACKUP_NAME/reports/" \; 2>/dev/null || true
  echo "✅ Reportes respaldados"
fi

# 5. Crear archivo comprimido
echo "📦 Comprimiendo respaldo..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# Obtener tamaño del archivo
BACKUP_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)

echo ""
echo "✅ Respaldo completado exitosamente"
echo ""
echo "📁 Archivo: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "📊 Tamaño: $BACKUP_SIZE"
echo ""

# 6. Limpieza de backups antiguos (mantener últimos 30 días)
echo "🗑️  Limpiando backups antiguos (> 30 días)..."
find "$BACKUP_DIR" -name "sync-backup-*.tar.gz" -mtime +30 -delete 2>/dev/null || true

REMAINING=$(find "$BACKUP_DIR" -name "sync-backup-*.tar.gz" | wc -l)
echo "📦 Backups actuales: $REMAINING"
echo ""

# 7. Generar reporte de backup
cat > "$BACKUP_DIR/ultimo-backup.txt" <<EOF
Último backup realizado:
- Fecha: $(date '+%Y-%m-%d %H:%M:%S')
- Archivo: $BACKUP_NAME.tar.gz
- Tamaño: $BACKUP_SIZE
- Total backups: $REMAINING
EOF

echo "✅ Proceso de respaldo finalizado"
echo ""
