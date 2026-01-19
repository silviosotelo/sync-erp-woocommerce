const express = require('express');
const router = express.Router();

module.exports = (queueController) => {
  router.get('/stats', queueController.getStats.bind(queueController));
  router.get('/', queueController.getQueue.bind(queueController));
  router.post('/retry-failed', queueController.retryFailed.bind(queueController));
  router.post('/:artCodInt/retry', queueController.retrySingle.bind(queueController));
  router.delete('/completed', queueController.cleanCompleted.bind(queueController));

  return router;
};
