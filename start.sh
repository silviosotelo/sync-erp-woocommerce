#!/bin/bash

echo ""
echo "============================================="
echo "  Iniciando Farmatotal Sync v2.0"
echo "============================================="
echo ""
echo "✅ Verificando archivo .env..."
if [ ! -f ".env" ]; then
    echo "❌ ERROR: Archivo .env no encontrado"
    echo "📝 Ejecuta: cp .env.example .env"
    exit 1
fi

echo "✅ Archivo .env encontrado"
echo "🚀 Iniciando servidor..."
echo ""
echo "📊 Dashboard: http://localhost:3001"
echo "🔍 Health Check: http://localhost:3001/health"
echo ""
echo "⏳ Conectando a MySQL... (esto puede tomar unos segundos)"
echo ""

node server.js
