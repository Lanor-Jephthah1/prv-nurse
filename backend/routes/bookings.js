const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    createBooking, 
    getMyBookings, 
    updateBookingStatus, 
    addVisitNote,
    cancelBooking
} = require('../controllers/bookingController');

router.post('/', protect(['patient']), createBooking);
router.get('/', protect(['patient', 'nurse', 'admin']), getMyBookings);
router.patch('/:id/status', protect(['patient', 'nurse', 'admin']), updateBookingStatus);
router.patch('/:id/cancel', protect(['patient', 'nurse', 'admin']), cancelBooking);
router.post('/:id/cancel', protect(['patient', 'nurse', 'admin']), cancelBooking);
router.delete('/:id', protect(['patient', 'nurse', 'admin']), cancelBooking);
router.post('/:id/notes', protect(['nurse']), addVisitNote);

module.exports = router;
