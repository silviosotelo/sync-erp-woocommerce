const express = require('express');
const router = express.Router();

module.exports = (syncController) => {
  router.post('/start', syncController.startSync.bind(syncController));
  router.post('/reindex', syncController.triggerReindex.bind(syncController));
  router.get('/status', syncController.getStatus.bind(syncController));

  return router;
};
