const express = require('express');
const router = express.Router();

module.exports = (statsController) => {
  router.get('/today', statsController.getToday.bind(statsController));
  router.get('/last-7-days', statsController.getLast7Days.bind(statsController));
  router.get('/history', statsController.getHistory.bind(statsController));

  return router;
};
