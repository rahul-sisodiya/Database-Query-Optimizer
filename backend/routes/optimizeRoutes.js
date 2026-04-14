const express = require('express');
const router = express.Router();
const { optimizeQuery, resetIndexes, createIndex } = require('../controllers/optimizeController');

router.post('/optimize', optimizeQuery);


router.post('/reset-indexes', resetIndexes);


router.post('/create-index', createIndex);

module.exports = router;
