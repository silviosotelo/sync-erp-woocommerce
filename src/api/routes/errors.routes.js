const express = require('express');
const router = express.Router();

module.exports = (errorsController) => {
  router.get('/recent', errorsController.getRecent.bind(errorsController));
  router.post('/:errorId/resolve', errorsController.markResolved.bind(errorsController));

  return router;
};
