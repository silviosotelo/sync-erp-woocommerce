const path = require('path');

class ReportsController {
  constructor(reportGenerator, csvExporter, logger) {
    this.reportGenerator = reportGenerator;
    this.csvExporter = csvExporter;
    this.logger = logger;
  }

  async generateReport(req, res) {
    try {
      const { start_date, end_date, format } = req.body;

      const startDate = start_date ? new Date(start_date) : new Date();
      const endDate = end_date ? new Date(end_date) : new Date();

      const reportData = await this.reportGenerator.generateReport(startDate);

      if (format === 'csv') {
        const filename = `report_${this.formatDateForFilename(startDate)}.csv`;
        const outputPath = path.join(process.cwd(), 'reports', 'csv', filename);

        await this.csvExporter.exportDailyReport(reportData, outputPath);

        res.download(outputPath, filename);
      } else {
        res.json(reportData);
      }
    } catch (error) {
      this.logger.error('Error generating report:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getDailyReport(req, res) {
    try {
      const { date } = req.params;
      const targetDate = new Date(date);

      const reportData = await this.reportGenerator.generateReport(targetDate);

      res.json(reportData);
    } catch (error) {
      this.logger.error('Error getting daily report:', error);
      res.status(500).json({ error: error.message });
    }
  }

  formatDateForFilename(date) {
    return date.toISOString().split('T')[0];
  }
}

module.exports = ReportsController;
