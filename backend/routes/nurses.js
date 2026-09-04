const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    getProfile, 
    updateProfile, 
    getActiveNurses, 
    updateAvailability, 
    getNearbyNurses,
    getNurseById,
    getNurseAvailability
} = require('../controllers/nurseController');

// Public or Patient routes
router.get('/', getActiveNurses);
router.get('/nearby', protect(['patient']), getNearbyNurses);

// Protected Nurse routes
router.get('/profile', protect(['nurse']), getProfile);
router.put('/profile', protect(['nurse']), updateProfile);
router.put('/availability', protect(['nurse']), updateAvailability);

// Availability & Profile routes for booking (with booked slot indicators)
router.get('/:id/availability', getNurseAvailability);
router.get('/:id', getNurseById);

module.exports = router;
