const express = require('express');

module.exports = function(systemController) {
  const router = express.Router();

  router.get('/config', (req, res) => systemController.getConfig(req, res));
  router.get('/status', (req, res) => systemController.getStatus(req, res));
  router.get('/test-connections', (req, res) => systemController.testConnections(req, res));
  router.get('/last-sync', (req, res) => systemController.getLastSync(req, res));

  return router;
};
