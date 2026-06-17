const Booking = require('../models/Booking');

// @desc    Create a new booking request
// @route   POST /api/bookings
// @access  Private (Patient only)
exports.createBooking = async (req, res) => {
    try {
        const { nurseId, careDetails, schedule, agreedRate, totalAmount } = req.body;
        
        const booking = await Booking.create({
            patientId: req.user.id,
            nurseId,
            careDetails,
            schedule,
            agreedRate,
            totalAmount,
            status: 'Requested'
        });

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get bookings for logged in user (Patient or Nurse)
// @route   GET /api/bookings
// @access  Private (Patient, Nurse)
exports.getMyBookings = async (req, res) => {
    try {
        let filter = {};
        if (req.user.role === 'patient') filter.patientId = req.user.id;
        else if (req.user.role === 'nurse') filter.nurseId = req.user.id;
        else return res.status(403).json({ message: 'Unauthorized role' });

        const bookings = await Booking.find(filter)
            .populate('patientId', 'fullName phone address')
            .populate('nurseId', 'fullName phone photoUrl ratings');
            
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update booking status (Accept, Start, Complete, Cancel, Dispute)
// @route   PATCH /api/bookings/:id/status
// @access  Private (Patient, Nurse, Admin)
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const bookingId = req.params.id;
        
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        
        // Basic check: A nurse can only accept/progress their own booking
        if (req.user.role === 'nurse' && booking.nurseId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        // Basic check: A patient can only cancel/dispute their own booking
        if (req.user.role === 'patient' && booking.patientId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        booking.status = status;
        const updatedBooking = await booking.save();
        
        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Add a visit note to an active booking
// @route   POST /api/bookings/:id/notes
// @access  Private (Nurse only)
exports.addVisitNote = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.nurseId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        booking.visitNotes.push(req.body);
        await booking.save();

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
