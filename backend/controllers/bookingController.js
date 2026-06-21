const Booking = require('../models/Booking');
const Notification = require('../models/Notification');

// @desc    Create a new booking request (Handles Recurring Bookings)
// @route   POST /api/bookings
// @access  Private (Patient only)
exports.createBooking = async (req, res) => {
    try {
        const { nurseId, careDetails, schedule, agreedRate, totalAmount } = req.body;
        
        if (schedule && schedule.frequency && schedule.frequency !== 'Once') {
            const mongoose = require('mongoose');
            const seriesId = new mongoose.Types.ObjectId();
            const bookings = [];
            
            // For thesis alignment simulation, we create a set number of sessions (e.g. 4)
            const sessionsToCreate = 4;
            let currentStartDate = new Date(schedule.startDate);
            
            for (let i = 0; i < sessionsToCreate; i++) {
                bookings.push({
                    patientId: req.user.profileId,
                    nurseId,
                    careDetails,
                    schedule: { ...schedule, startDate: new Date(currentStartDate) },
                    agreedRate,
                    totalAmount: totalAmount / sessionsToCreate, // Divide cost per session
                    status: 'Requested',
                    seriesId
                });
                
                if (schedule.frequency === 'Daily') currentStartDate.setDate(currentStartDate.getDate() + 1);
                else if (schedule.frequency === 'Weekly') currentStartDate.setDate(currentStartDate.getDate() + 7);
                else if (schedule.frequency === 'Monthly') currentStartDate.setMonth(currentStartDate.getMonth() + 1);
            }
            
            const createdBookings = await Booking.insertMany(bookings);

            // Notify Nurse
            await Notification.create({
                recipient: nurseId,
                title: 'New Booking Request',
                message: `You have a new recurring booking request for ${sessionsToCreate} sessions.`,
                type: 'Booking',
                link: `/bookings/${seriesId}`
            });

            return res.status(201).json(createdBookings);
        } else {
            const booking = await Booking.create({
                patientId: req.user.profileId,
                nurseId,
                careDetails,
                schedule,
                agreedRate,
                totalAmount,
                status: 'Requested'
            });

            // Notify Nurse
            await Notification.create({
                recipient: nurseId,
                title: 'New Booking Request',
                message: `You have a new booking request.`,
                type: 'Booking',
                link: `/bookings/${booking._id}`
            });

            return res.status(201).json(booking);
        }
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
        if (req.user.role === 'patient') filter.patientId = req.user.profileId;
        else if (req.user.role === 'nurse') filter.nurseId = req.user.profileId;
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
        if (req.user.role === 'nurse' && booking.nurseId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        // Basic check: A patient can only cancel/dispute their own booking
        if (req.user.role === 'patient' && booking.patientId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        booking.status = status;
        const updatedBooking = await booking.save();
        
        // Notify the OTHER party
        const recipientId = req.user.role === 'nurse' ? booking.patientId : booking.nurseId;
        await Notification.create({
            recipient: recipientId,
            title: `Booking Status Updated`,
            message: `Booking status changed to ${status}.`,
            type: 'Booking',
            link: `/bookings/${booking._id}`
        });

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

        if (booking.nurseId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        booking.visitNotes.push(req.body);
        await booking.save();

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
