#!/bin/bash

# ===================================================================
# Script de verificación de salud del sincronizador
# Farmatotal Sync ERP v2.0
# ===================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SUCCESS=0
WARNINGS=0
ERRORS=0

echo ""
echo "============================================================"
echo "  VERIFICACIÓN DE SALUD - FARMATOTAL SYNC v2.0"
echo "============================================================"
echo ""

# Función para imprimir mensajes
print_check() {
  local status=$1
  local message=$2

  if [ "$status" = "OK" ]; then
    echo -e "${GREEN}✓${NC} $message"
    ((SUCCESS++))
  elif [ "$status" = "WARN" ]; then
    echo -e "${YELLOW}⚠${NC} $message"
    ((WARNINGS++))
  else
    echo -e "${RED}✗${NC} $message"
    ((ERRORS++))
  fi
}

# 1. Verificar Node.js
echo "📦 Verificando dependencias..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  print_check "OK" "Node.js instalado: $NODE_VERSION"
else
  print_check "ERROR" "Node.js NO instalado"
fi

# 2. Verificar npm
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  print_check "OK" "npm instalado: $NPM_VERSION"
else
  print_check "ERROR" "npm NO instalado"
fi

# 3. Verificar archivo .env
echo ""
echo "⚙️  Verificando configuración..."
if [ -f ".env" ]; then
  print_check "OK" "Archivo .env existe"

  # Verificar variables críticas
  if grep -q "ERP_ENDPOINT=" .env && ! grep -q "ERP_ENDPOINT=$" .env; then
    print_check "OK" "ERP_ENDPOINT configurado"
  else
    print_check "ERROR" "ERP_ENDPOINT no configurado en .env"
  fi

  if grep -q "MYSQL_HOST=" .env && ! grep -q "MYSQL_HOST=$" .env; then
    print_check "OK" "MYSQL_HOST configurado"
  else
    print_check "ERROR" "MYSQL_HOST no configurado en .env"
  fi

  if grep -q "MYSQL_PASSWORD=" .env && ! grep -q "MYSQL_PASSWORD=$" .env; then
    print_check "OK" "MYSQL_PASSWORD configurado"
  else
    print_check "ERROR" "MYSQL_PASSWORD no configurado en .env"
  fi
else
  print_check "ERROR" "Archivo .env NO existe"
fi

# 4. Verificar node_modules
echo ""
echo "📦 Verificando dependencias instaladas..."
if [ -d "node_modules" ]; then
  print_check "OK" "Directorio node_modules existe"

  # Verificar paquetes críticos
  if [ -d "node_modules/express" ]; then
    print_check "OK" "Express instalado"
  else
    print_check "ERROR" "Express NO instalado"
  fi

  if [ -d "node_modules/mysql2" ]; then
    print_check "OK" "MySQL2 instalado"
  else
    print_check "ERROR" "MySQL2 NO instalado"
  fi

  if [ -d "node_modules/better-sqlite3" ]; then
    print_check "OK" "Better-sqlite3 instalado"
  else
    print_check "ERROR" "Better-sqlite3 NO instalado"
  fi
else
  print_check "ERROR" "node_modules NO existe - ejecuta: npm install"
fi

# 5. Verificar directorios
echo ""
echo "📁 Verificando estructura de directorios..."
for dir in "logs" "data" "backups" "reports" "reports/csv" "reports/daily"; do
  if [ -d "$dir" ]; then
    print_check "OK" "Directorio $dir existe"
  else
    print_check "WARN" "Directorio $dir NO existe (se creará automáticamente)"
  fi
done

# 6. Verificar permisos de escritura
echo ""
echo "🔐 Verificando permisos..."
for dir in "logs" "data" "backups" "reports"; do
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    print_check "OK" "Permisos de escritura en $dir"
  elif [ -d "$dir" ]; then
    print_check "ERROR" "Sin permisos de escritura en $dir"
  fi
done

# 7. Verificar conectividad MySQL
echo ""
echo "🗄️  Verificando conectividad..."
if command -v mysql &> /dev/null && [ -f ".env" ]; then
  source .env 2>/dev/null
  if [ -n "$MYSQL_HOST" ] && [ -n "$MYSQL_USER" ]; then
    if timeout 5 mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" &>/dev/null; then
      print_check "OK" "Conectividad MySQL OK"
    else
      print_check "WARN" "No se pudo conectar a MySQL (verifica credenciales)"
    fi
  fi
else
  print_check "WARN" "Cliente MySQL no disponible (saltando prueba)"
fi

# 8. Verificar si el servicio está corriendo
echo ""
echo "🚀 Verificando servicio..."

# Verificar PM2
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q "farmatotal-sync"; then
    print_check "OK" "Servicio corriendo en PM2"
  else
    print_check "WARN" "Servicio NO está corriendo en PM2"
  fi
fi

# Verificar systemd (Linux)
if command -v systemctl &> /dev/null; then
  if systemctl is-active --quiet farmatotal-sync 2>/dev/null; then
    print_check "OK" "Servicio systemd activo"
  else
    print_check "WARN" "Servicio systemd no está corriendo"
  fi
fi

# Verificar servicio Windows
if command -v sc &> /dev/null; then
  if sc query "Farmatotal Sync ERP" 2>/dev/null | grep -q "RUNNING"; then
    print_check "OK" "Servicio Windows corriendo"
  else
    print_check "WARN" "Servicio Windows no está corriendo"
  fi
fi

# 9. Verificar endpoint HTTP
echo ""
echo "🌐 Verificando endpoint HTTP..."
if command -v curl &> /dev/null; then
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null | grep -q "200"; then
    print_check "OK" "Endpoint HTTP responde correctamente"
  else
    print_check "WARN" "Endpoint HTTP no responde (¿servicio detenido?)"
  fi
else
  print_check "WARN" "curl no disponible (saltando prueba HTTP)"
fi

# 10. Verificar logs recientes
echo ""
echo "📋 Verificando logs..."
if [ -f "logs/$(date +%Y-%m-%d).log" ]; then
  LOG_LINES=$(wc -l < "logs/$(date +%Y-%m-%d).log")
  print_check "OK" "Log del día existe ($LOG_LINES líneas)"
else
  print_check "WARN" "No hay log del día (¿servicio sin iniciar?)"
fi

if [ -f "logs/errors/$(date +%Y-%m-%d)-errors.log" ]; then
  ERROR_LINES=$(wc -l < "logs/errors/$(date +%Y-%m-%d)-errors.log")
  if [ "$ERROR_LINES" -gt 0 ]; then
    print_check "WARN" "Hay $ERROR_LINES errores registrados hoy"
  else
    print_check "OK" "Sin errores registrados hoy"
  fi
fi

# 11. Verificar base de datos SQLite
echo ""
echo "💾 Verificando base de datos..."
if [ -f "data/sync_queue.db" ]; then
  DB_SIZE=$(du -h "data/sync_queue.db" | cut -f1)
  print_check "OK" "Base de datos SQLite existe ($DB_SIZE)"
else
  print_check "WARN" "Base de datos SQLite no existe (se creará en primera ejecución)"
fi

# Resumen
echo ""
echo "============================================================"
echo "  RESUMEN"
echo "============================================================"
echo ""
echo -e "${GREEN}Éxitos:        $SUCCESS${NC}"
echo -e "${YELLOW}Advertencias:  $WARNINGS${NC}"
echo -e "${RED}Errores:       $ERRORS${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ Sistema listo para producción${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ Sistema operativo con advertencias${NC}"
  exit 0
else
  echo -e "${RED}✗ Sistema tiene errores críticos - corrígelos antes de producción${NC}"
  exit 1
fi
