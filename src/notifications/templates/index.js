function syncStarted(batchId, totalProducts) {
  const now = new Date();
  const time = now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return `🔄 SINCRONIZACIÓN INICIADA
━━━━━━━━━━━━━━━━━━━━
📦 Batch: #${batchId}
🕐 Inicio: ${time}
📊 Total productos: ${totalProducts}

Procesando...`;
}

function syncCompleted(batchId, stats) {
  const { total, successful, failed, duration, avgDuration, errorBreakdown } = stats;

  const startTime = new Date(stats.startTime);
  const endTime = new Date(stats.endTime);
  const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : 0;

  const durationFormatted = formatDuration(duration);
  const avgFormatted = avgDuration ? `${avgDuration}ms` : 'N/A';

  let errorSection = '';
  if (failed > 0 && errorBreakdown) {
    errorSection = '\n❌ ERRORES:\n';
    Object.entries(errorBreakdown).forEach(([type, count]) => {
      errorSection += `- ${type}: ${count}\n`;
    });
  }

  return `✅ SINCRONIZACIÓN COMPLETADA
━━━━━━━━━━━━━━━━━━━━
📦 Batch: #${batchId}
🕐 Inicio: ${startTime.toLocaleTimeString('es-PY')}
🕑 Fin: ${endTime.toLocaleTimeString('es-PY')}
⏱️ Duración: ${durationFormatted}

📊 RESULTADOS:
✅ Exitosos: ${successful}/${total} (${successRate}%)
❌ Fallidos: ${failed}/${total}
⏳ Pendientes: 0

🎯 PROMEDIO:
⚡ ${avgFormatted} por producto${errorSection}
Ver detalles: ${process.env.DASHBOARD_URL || 'http://localhost:3001'}`;
}

function syncError(batchId, errorInfo) {
  const { message, failedCount, totalProcessed } = errorInfo;
  const failureRate = totalProcessed > 0 ? ((failedCount / totalProcessed) * 100).toFixed(1) : 0;

  return `⚠️ ERROR EN SINCRONIZACIÓN
━━━━━━━━━━━━━━━━━━━━
📦 Batch: #${batchId}
🕐 Hora: ${new Date().toLocaleTimeString('es-PY')}

❌ ERROR:
${message}

📊 ESTADO:
Procesados: ${totalProcessed}
Fallidos: ${failedCount} (${failureRate}%)

⚠️ Requiere atención inmediata

Ver detalles: ${process.env.DASHBOARD_URL || 'http://localhost:3001'}`;
}

function criticalError(errorInfo) {
  const { message, stack, context } = errorInfo;

  return `🚨 ERROR CRÍTICO
━━━━━━━━━━━━━━━━━━━━
🕐 Hora: ${new Date().toLocaleString('es-PY')}

❌ ERROR:
${message}

📍 CONTEXTO:
${context || 'N/A'}

⚠️ ACCIÓN REQUERIDA INMEDIATAMENTE

Ver detalles: ${process.env.DASHBOARD_URL || 'http://localhost:3001'}`;
}

function queueBlocked(stuckProducts) {
  const count = stuckProducts.length;
  const products = stuckProducts.slice(0, 5).map(p => `- ${p.art_cod_int}`).join('\n');

  return `⏸️ COLA BLOQUEADA
━━━━━━━━━━━━━━━━━━━━
🕐 Hora: ${new Date().toLocaleTimeString('es-PY')}

⚠️ ALERTA:
${count} productos atascados en estado "procesando" por más de 10 minutos

📦 PRODUCTOS AFECTADOS:
${products}
${count > 5 ? `...y ${count - 5} más` : ''}

🔧 ACCIÓN SUGERIDA:
Revisar procesos y reiniciar si es necesario

Ver detalles: ${process.env.DASHBOARD_URL || 'http://localhost:3001'}`;
}

function dailyReport(reportData) {
  const {
    date,
    totalBatches,
    totalProducts,
    successful,
    failed,
    totalDuration,
    avgDuration,
    topErrors,
    hourlyDistribution,
    weeklyComparison
  } = reportData;

  const successRate = totalProducts > 0 ? ((successful / totalProducts) * 100).toFixed(2) : 0;
  const formattedDate = new Date(date).toLocaleDateString('es-PY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let errorsSection = '';
  if (topErrors && topErrors.length > 0) {
    errorsSection = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ TOP 5 ERRORES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    topErrors.slice(0, 5).forEach((error, index) => {
      errorsSection += `${index + 1}. ${error.type} (${error.count} ocurrencias)\n`;
    });
  }

  let hourlySection = '';
  if (hourlyDistribution && hourlyDistribution.length > 0) {
    hourlySection = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🕐 DISTRIBUCIÓN POR HORA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    hourlyDistribution.forEach(item => {
      hourlySection += `${item.hour} - ${item.count} productos\n`;
    });
  }

  let weeklySection = '';
  if (weeklyComparison && weeklyComparison.length > 0) {
    weeklySection = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 COMPARATIVA SEMANAL:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    weeklyComparison.forEach(item => {
      const marker = item.isToday ? ' ← HOY' : '';
      weeklySection += `${item.day}: ${item.products} productos (${item.successRate}% éxito)${marker}\n`;
    });
  }

  return `📊 REPORTE DIARIO - FARMATOTAL SYNC
Fecha: ${formattedDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 SINCRONIZACIONES DEL DÍA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total de batches: ${totalBatches}
Total productos procesados: ${totalProducts.toLocaleString('es-PY')}
✅ Exitosos: ${successful.toLocaleString('es-PY')} (${successRate}%)
❌ Fallidos: ${failed.toLocaleString('es-PY')}
⏱️ Tiempo total: ${formatDuration(totalDuration)}
⚡ Promedio: ${avgDuration}ms/producto${hourlySection}${errorsSection}${weeklySection}

Ver más detalles: ${process.env.DASHBOARD_URL || 'http://localhost:3001'}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  syncStarted,
  syncCompleted,
  syncError,
  criticalError,
  queueBlocked,
  dailyReport
};
