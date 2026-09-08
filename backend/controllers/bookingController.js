const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');

// @desc    Create a new booking request (Handles Recurring Bookings)
// @route   POST /api/bookings
// @access  Private (Patient only)
exports.createBooking = async (req, res) => {
    try {
        const { nurseId, careDetails, schedule, agreedRate, totalAmount } = req.body;
        
        // Defensive checks to prevent 500 crashes from malformed frontend payloads
        if (!nurseId || !schedule || !schedule.startDate || agreedRate === undefined || totalAmount === undefined) {
            return res.status(400).json({ 
                message: 'Missing required fields. Ensure nurseId, schedule (with startDate), agreedRate, and totalAmount are provided.' 
            });
        }

        // Map frontend "One-time visit" to "Once" securely, catching any case or typo
        if (schedule && schedule.frequency) {
            if (!['Daily', 'Weekly', 'Monthly'].includes(schedule.frequency)) {
                schedule.frequency = 'Once';
            }
        }
        
        if (!schedule.timeSlots || !Array.isArray(schedule.timeSlots) || schedule.timeSlots.length === 0) {
            return res.status(400).json({ 
                message: 'Validation Error: schedule.timeSlots must be a non-empty array of requested slots.' 
            });
        }
        
        // Find the nurse profile to get the userId for notification
        const nurse = await Nurse.findById(nurseId);
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }

        // Helper to match slot names flexibly
        const slotsMatch = (s1, s2) => {
            if (!s1 || !s2) return false;
            const a = s1.toLowerCase().trim();
            const b = s2.toLowerCase().trim();
            return a === b || a.includes(b) || b.includes(a);
        };

        // Prevent booking a slot that has already been accepted by this nurse
        const requestedSlots = Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [];
        if (requestedSlots.length > 0) {
            const targetDate = new Date(schedule.startDate);
            const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
            const dayEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

            const existingAccepted = await Booking.find({
                nurseId,
                status: { $in: ['Accepted', 'In Progress'] },
                'schedule.startDate': { $gte: dayStart, $lte: dayEnd }
            }).select('schedule.timeSlots');

            const allBookedSlots = existingAccepted.flatMap(b => (b.schedule && b.schedule.timeSlots) || []);
            const conflict = requestedSlots.find(reqSlot => allBookedSlots.some(booked => slotsMatch(booked, reqSlot)));

            if (conflict) {
                return res.status(409).json({
                    message: `This time slot (${conflict}) is already booked and accepted for this nurse on this date. Please choose another available slot.`,
                    conflictingSlot: conflict
                });
            }
        }
        
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
                userId: nurse.userId,
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
                userId: nurse.userId,
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

        const bookings = await Booking.find(filter).sort({ createdAt: -1 }).populate('patientId', 'fullName phone address')
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

        // Handle dual-approval for 'Completed' status
        if (status === 'Completed') {
            if (req.user.role === 'nurse') booking.completionApprovals.nurseApproved = true;
            if (req.user.role === 'patient') booking.completionApprovals.patientApproved = true;

            // Only mark as fully 'Completed' if both parties have approved
            if (booking.completionApprovals.nurseApproved && booking.completionApprovals.patientApproved) {
                booking.status = 'Completed';
            } else {
                // Return early if we are just marking approval but it's not fully completed yet.
                // The frontend can read `booking.totalAmount` and `booking.completionApprovals` from this response.
                await booking.save();
                return res.json({ 
                    message: `Approval recorded. Waiting for the other party. Total Amount: ${booking.totalAmount}`, 
                    booking 
                });
            }
        } else if (status === 'Accepted') {
            // Check if this nurse already accepted another booking for the same date & time slot
            const slotsMatch = (s1, s2) => {
                if (!s1 || !s2) return false;
                const a = s1.toLowerCase().trim();
                const b = s2.toLowerCase().trim();
                return a === b || a.includes(b) || b.includes(a);
            };

            const targetDate = new Date(booking.schedule.startDate);
            const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
            const dayEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

            const existingAccepted = await Booking.find({
                _id: { $ne: booking._id },
                nurseId: booking.nurseId,
                status: { $in: ['Accepted', 'In Progress'] },
                'schedule.startDate': { $gte: dayStart, $lte: dayEnd }
            }).select('schedule.timeSlots');

            const allBookedSlots = existingAccepted.flatMap(b => (b.schedule && b.schedule.timeSlots) || []);
            const conflict = (booking.schedule && booking.schedule.timeSlots || []).find(ts =>
                allBookedSlots.some(booked => slotsMatch(booked, ts))
            );

            if (conflict) {
                return res.status(409).json({
                    message: `Conflict: You have already accepted another booking for the '${conflict}' slot on this date.`
                });
            }

            booking.status = 'Accepted';
            booking.matchedAt = new Date();
        } else {
            // For other statuses (Declined, Cancelled, In Progress), set it directly
            booking.status = status;
        }

        const updatedBooking = await booking.save();
        
        // Notify the OTHER party
        let recipientUserId;
        if (req.user.role === 'nurse') {
            const patient = await Patient.findById(booking.patientId);
            recipientUserId = patient ? patient.userId : null;
        } else {
            const nurse = await Nurse.findById(booking.nurseId);
            recipientUserId = nurse ? nurse.userId : null;
        }

        if (recipientUserId) {
            await Notification.create({
                userId: recipientUserId,
                title: `Booking Status Updated`,
                message: `Booking status changed to ${status}.`,
                type: 'Booking',
                link: `/bookings/${booking._id}`
            });
        }

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

