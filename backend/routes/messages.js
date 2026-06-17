const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:bookingId', protect(['patient', 'nurse']), getMessages);
router.post('/:bookingId', protect(['patient', 'nurse']), sendMessage);

module.exports = router;
