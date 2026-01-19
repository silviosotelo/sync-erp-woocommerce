const fs = require('fs');
const path = require('path');

class CSVExporter {
  constructor(logger) {
    this.logger = logger;
  }

  async exportDailyReport(reportData, outputPath) {
    try {
      const {
        date,
        totalBatches,
        totalProducts,
        successful,
        failed,
        avgDuration,
        topErrors,
        hourlyDistribution
      } = reportData;

      const successRate = totalProducts > 0
        ? ((successful / totalProducts) * 100).toFixed(2)
        : 0;

      const rows = [
        ['Reporte Diario - Farmatotal Sync'],
        ['Fecha', date],
        [''],
        ['Resumen General'],
        ['Métrica', 'Valor'],
        ['Total Batches', totalBatches],
        ['Total Productos', totalProducts],
        ['Exitosos', successful],
        ['Fallidos', failed],
        ['Tasa de Éxito (%)', successRate],
        ['Duración Promedio (ms)', avgDuration],
        [''],
        ['Distribución por Hora'],
        ['Hora', 'Productos'],
        ...hourlyDistribution.map(item => [item.hour, item.count]),
        [''],
        ['Top Errores'],
        ['Tipo', 'Cantidad'],
        ...topErrors.map(error => [error.type, error.count])
      ];

      const csv = rows.map(row => row.join(',')).join('\n');

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, csv, 'utf8');

      this.logger.info(`CSV report exported to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('Error exporting CSV report:', error);
      throw error;
    }
  }

  async exportQueueSnapshot(queueData, outputPath) {
    try {
      const rows = [
        ['SKU', 'Producto', 'Estado', 'Intentos', 'Max Intentos', 'Error', 'Creado', 'Actualizado'],
        ...queueData.map(item => [
          item.art_cod_int,
          item.product_name || '',
          item.status,
          item.attempts,
          item.max_attempts,
          item.error_message || '',
          item.created_at,
          item.updated_at
        ])
      ];

      const csv = rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, csv, 'utf8');

      this.logger.info(`Queue snapshot exported to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('Error exporting queue snapshot:', error);
      throw error;
    }
  }
}

module.exports = CSVExporter;
