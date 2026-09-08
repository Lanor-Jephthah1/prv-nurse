const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Payment = require('../models/Payment');

// Helper to determine if two bookings overlap in date, time, or shift slot for a nurse
const checkBookingOverlap = (b1Schedule, b2Schedule) => {
    if (!b1Schedule || !b2Schedule || !b1Schedule.startDate || !b2Schedule.startDate) {
        return false;
    }

    const d1 = new Date(b1Schedule.startDate);
    const d2 = new Date(b2Schedule.startDate);

    // Check same calendar day in UTC
    const sameCalendarDay = (
        d1.getUTCFullYear() === d2.getUTCFullYear() &&
        d1.getUTCMonth() === d2.getUTCMonth() &&
        d1.getUTCDate() === d2.getUTCDate()
    );

    // Duration calculation in ms (default to 4 hours if not explicitly specified)
    const duration1 = (b1Schedule.duration || 4) * 3600 * 1000;
    const duration2 = (b2Schedule.duration || 4) * 3600 * 1000;
    const end1 = d1.getTime() + duration1;
    const end2 = d2.getTime() + duration2;

    const timeOverlaps = (d1.getTime() < end2 && end1 > d2.getTime());

    // If clock times directly overlap across dates/hours:
    if (timeOverlaps && !sameCalendarDay) {
        return true;
    }

    // If on the same calendar day:
    if (sameCalendarDay) {
        const slots1 = Array.isArray(b1Schedule.timeSlots) ? b1Schedule.timeSlots : [];
        const slots2 = Array.isArray(b2Schedule.timeSlots) ? b2Schedule.timeSlots : [];

        // If either booking has no specific time slots defined, the entire day/shift is occupied
        if (slots1.length === 0 || slots2.length === 0) {
            return true;
        }

        // Helper to match slot names
        const slotsOverlap = (s1, s2) => {
            if (!s1 || !s2) return false;
            const a = s1.toLowerCase().trim();
            const b = s2.toLowerCase().trim();
            if (a === b || a.includes(b) || b.includes(a)) return true;

            const morningAliases = ['morning', 'am', '8am', '9am', '10am', '11am', '12pm'];
            const afternoonAliases = ['afternoon', 'pm', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'];
            const eveningAliases = ['evening', 'night', '6pm', '7pm', '8pm', '9pm'];

            const isMorningA = morningAliases.some(alias => a.includes(alias));
            const isMorningB = morningAliases.some(alias => b.includes(alias));
            if (isMorningA && isMorningB) return true;

            const isAfternoonA = afternoonAliases.some(alias => a.includes(alias));
            const isAfternoonB = afternoonAliases.some(alias => b.includes(alias));
            if (isAfternoonA && isAfternoonB) return true;

            const isEveningA = eveningAliases.some(alias => a.includes(alias));
            const isEveningB = eveningAliases.some(alias => b.includes(alias));
            if (isEveningA && isEveningB) return true;

            if (a.includes('full') || b.includes('full') || a.includes('24') || b.includes('24') || a.includes('all day') || b.includes('all day')) {
                return true;
            }

            return false;
        };

        for (const s1 of slots1) {
            for (const s2 of slots2) {
                if (slotsOverlap(s1, s2)) return true;
            }
        }

        return false;
    }

    return false;
};

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
        
        // Find the nurse profile to get the userId for notification
        const nurse = await Nurse.findById(nurseId);
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }

        // Prevent booking a nurse if the nurse already has an accepted booking overlapping with this schedule
        const targetDate = new Date(schedule.startDate);
        const searchStart = new Date(targetDate.getTime() - 24 * 3600 * 1000);
        const searchEnd = new Date(targetDate.getTime() + 24 * 3600 * 1000);

        const existingAccepted = await Booking.find({
            nurseId,
            status: { $regex: /^(accepted|in progress)$/i },
            'schedule.startDate': { $gte: searchStart, $lte: searchEnd }
        });

        const conflict = existingAccepted.find(existing => 
            checkBookingOverlap(existing.schedule, schedule)
        );

        if (conflict) {
            const conflictSlots = (conflict.schedule && conflict.schedule.timeSlots && conflict.schedule.timeSlots.length > 0)
                ? conflict.schedule.timeSlots.join(', ')
                : 'this time';
            return res.status(409).json({
                message: `This nurse already has an accepted booking for ${conflictSlots} on this date. Please choose another available slot or another nurse.`,
                conflictingBookingId: conflict._id
            });
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

        const normalizedStatus = status ? status.trim().toLowerCase() : '';

        // Handle dual-approval for 'Completed' status
        if (normalizedStatus === 'completed') {
            if (req.user.role === 'nurse') booking.completionApprovals.nurseApproved = true;
            if (req.user.role === 'patient') booking.completionApprovals.patientApproved = true;

            // Only mark as fully 'Completed' if both parties have approved
            if (booking.completionApprovals.nurseApproved && booking.completionApprovals.patientApproved) {
                const wasAlreadyCompleted = booking.status === 'Completed';
                booking.status = 'Completed';

                // Increase the nurse's earnings by the amount charged for this session
                if (!wasAlreadyCompleted) {
                    const sessionAmount = booking.totalAmount || booking.agreedRate || 0;
                    if (sessionAmount > 0) {
                        const nurse = await Nurse.findById(booking.nurseId);
                        if (nurse) {
                            nurse.earnings = (nurse.earnings || 0) + sessionAmount;
                            nurse.totalEarnings = (nurse.totalEarnings || 0) + sessionAmount;
                            await nurse.save();
                        }

                        // Record payment transaction for bookkeeping and metrics
                        const serviceFee = sessionAmount * 0.10; // 10% platform fee
                        await Payment.create({
                            bookingId: booking._id,
                            patientId: booking.patientId,
                            nurseId: booking.nurseId,
                            amount: sessionAmount,
                            serviceFee: serviceFee,
                            momoRef: 'COMPLETED-' + booking._id.toString().slice(-6),
                            status: 'Disbursed'
                        }).catch(err => console.error('Payment creation error on completion:', err));
                    }
                }
            } else {
                // Return early if we are just marking approval but it's not fully completed yet.
                await booking.save();
                return res.json({ 
                    message: `Approval recorded. Waiting for the other party. Total Amount: ${booking.totalAmount}`, 
                    booking 
                });
            }
        } else if (normalizedStatus === 'accepted') {
            // Check if this nurse already accepted another booking that overlaps with this booking
            const targetDate = new Date(booking.schedule.startDate);
            const searchStart = new Date(targetDate.getTime() - 24 * 3600 * 1000);
            const searchEnd = new Date(targetDate.getTime() + 24 * 3600 * 1000);

            const existingAccepted = await Booking.find({
                _id: { $ne: booking._id },
                nurseId: booking.nurseId,
                status: { $regex: /^(accepted|in progress)$/i },
                'schedule.startDate': { $gte: searchStart, $lte: searchEnd }
            });

            const conflictingBooking = existingAccepted.find(existing => 
                checkBookingOverlap(existing.schedule, booking.schedule)
            );

            if (conflictingBooking) {
                const conflictSlots = (conflictingBooking.schedule && conflictingBooking.schedule.timeSlots && conflictingBooking.schedule.timeSlots.length > 0)
                    ? conflictingBooking.schedule.timeSlots.join(', ')
                    : 'the requested shift';
                const conflictDate = new Date(conflictingBooking.schedule.startDate).toLocaleDateString();

                return res.status(409).json({
                    message: `Cannot accept booking: You have already accepted another booking on ${conflictDate} for ${conflictSlots}. Nurses cannot take overlapping bookings.`,
                    conflictingBookingId: conflictingBooking._id
                });
            }

            booking.status = 'Accepted';
            booking.matchedAt = new Date();
        } else {
            // For other statuses (Declined, Cancelled, In Progress), set proper casing
            if (normalizedStatus === 'declined') booking.status = 'Declined';
            else if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') booking.status = 'Cancelled';
            else if (normalizedStatus === 'in progress') booking.status = 'In Progress';
            else booking.status = status;
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

// @desc    Cancel a booking request or active booking (Patient, Nurse, Admin)
// @route   PATCH /api/bookings/:id/cancel or POST /api/bookings/:id/cancel or DELETE /api/bookings/:id
// @access  Private (Patient, Nurse, Admin)
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        // Authorization check: Must be the patient who created the booking, the assigned nurse, or an admin
        if (req.user.role === 'patient' && booking.patientId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized to cancel this booking' });
        }
        if (req.user.role === 'nurse' && booking.nurseId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized to cancel this booking' });
        }

        if (['Completed', 'Cancelled'].includes(booking.status)) {
            return res.status(400).json({ 
                message: `Cannot cancel a booking that is already ${booking.status.toLowerCase()}.` 
            });
        }

        booking.status = 'Cancelled';
        const updatedBooking = await booking.save();

        // Notify the OTHER party
        let recipientUserId = null;
        if (req.user.role === 'patient') {
            const nurse = await Nurse.findById(booking.nurseId);
            recipientUserId = nurse ? nurse.userId : null;
        } else {
            const patient = await Patient.findById(booking.patientId);
            recipientUserId = patient ? patient.userId : null;
        }

        if (recipientUserId) {
            await Notification.create({
                userId: recipientUserId,
                title: 'Booking Request Cancelled',
                message: `Booking request on ${new Date(booking.schedule.startDate).toLocaleDateString()} was cancelled.`,
                type: 'Booking',
                link: `/bookings/${booking._id}`
            }).catch(err => console.error('Notification error on cancel:', err));
        }

        res.json({
            message: 'Booking request successfully cancelled.',
            booking: updatedBooking
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error cancelling booking', error: error.message });
    }
};


