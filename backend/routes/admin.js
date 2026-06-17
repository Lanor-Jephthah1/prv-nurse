const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    getDashboardMetrics, 
    getPendingVerifications, 
    updateVerificationStatus 
} = require('../controllers/adminController');

router.get('/metrics', protect(['admin']), getDashboardMetrics);
router.get('/verifications', protect(['admin']), getPendingVerifications);
router.patch('/verifications/:id', protect(['admin']), updateVerificationStatus);

module.exports = router;
