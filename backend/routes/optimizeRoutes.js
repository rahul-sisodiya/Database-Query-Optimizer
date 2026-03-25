const express = require('express');
const router = express.Router();
const { optimizeQuery } = require('../controllers/optimizeController');

/**
 * Endpoint for optimizing MongoDB queries.
 */
router.post('/optimize', optimizeQuery);

module.exports = router;
