const express = require('express');
const router = express.Router();

module.exports = (reportsController) => {
  router.post('/generate', reportsController.generateReport.bind(reportsController));
  router.get('/daily/:date', reportsController.getDailyReport.bind(reportsController));

  return router;
};
