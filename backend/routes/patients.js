const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProfile, updateProfile } = require('../controllers/patientController');

// Protected Patient routes
router.get('/profile', protect(['patient']), getProfile);
router.put('/profile', protect(['patient']), updateProfile);

module.exports = router;
