const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProfile, updateProfile, getActiveNurses } = require('../controllers/nurseController');

// Public or Patient routes
router.get('/', getActiveNurses);

// Protected Nurse routes
router.get('/profile', protect(['nurse']), getProfile);
router.put('/profile', protect(['nurse']), updateProfile);

module.exports = router;
