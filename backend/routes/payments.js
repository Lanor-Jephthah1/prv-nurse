const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { initiateCollection, momoWebhook } = require('../controllers/paymentController');

// Patient initiates collection
router.post('/collect', protect(['patient']), initiateCollection);

// MTN Webhook receiver (no authentication middleware as it's called by MTN)
router.post('/webhook', momoWebhook);

module.exports = router;
