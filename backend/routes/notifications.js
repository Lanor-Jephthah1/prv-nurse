const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Both patients and nurses can access their notifications
router.get('/', protect(['patient', 'nurse', 'admin']), getNotifications);
router.patch('/:id/read', protect(['patient', 'nurse', 'admin']), markAsRead);

module.exports = router;
