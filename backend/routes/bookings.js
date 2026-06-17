const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    createBooking, 
    getMyBookings, 
    updateBookingStatus, 
    addVisitNote 
} = require('../controllers/bookingController');

router.post('/', protect(['patient']), createBooking);
router.get('/', protect(['patient', 'nurse', 'admin']), getMyBookings);
router.patch('/:id/status', protect(['patient', 'nurse', 'admin']), updateBookingStatus);
router.post('/:id/notes', protect(['nurse']), addVisitNote);

module.exports = router;
