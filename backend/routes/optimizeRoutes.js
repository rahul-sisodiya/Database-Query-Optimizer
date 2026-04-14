const express = require('express');
const router = express.Router();
const { optimizeQuery, resetIndexes, createIndex } = require('../controllers/optimizeController');

/**
 * Endpoint for optimizing MongoDB queries.
 */
router.post('/optimize', optimizeQuery);

/**
 * Endpoint for resetting collection indexes.
 */
router.post('/reset-indexes', resetIndexes);

/**
 * Endpoint for creating a new index.
 */
router.post('/create-index', createIndex);

module.exports = router;
