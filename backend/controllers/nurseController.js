const Nurse = require('../models/Nurse');
const User = require('../models/User');
const Booking = require('../models/Booking');

const flattenObject = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k]) && !(obj[k] instanceof Date)) {
            Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
};
// @desc    Get current nurse profile
// @route   GET /api/nurses/profile
// @access  Private (Nurse only)
exports.getProfile = async (req, res) => {
    try {
        const nurse = await Nurse.findById(req.user.profileId).select('-password');
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }
        res.json(nurse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update nurse profile (qualifications, skills, availability, pricing)
// @route   PUT /api/nurses/profile
// @access  Private (Nurse only)
exports.updateProfile = async (req, res) => {
    try {
        const allowedFields = [
            'fullName', 'email', 'gender', 'dob', 'phone', 'profilePhoto', 'photoUrl',
            'nationalId', 'idPhotoUrl', 'address', 'documents',
            'highestQualification', 'graduationYear', 'institution', 'licensingBody', 'certificateUrls',
            'qualifications', 'licenseNumber', 'licenseExpiry', 'certifications',
            'experienceYears', 'specializations', 'skills', 'equipment', 'workHistory',
            'willingToTravel', 'travelDistance', 'bio',
            'availability', 'location', 'pricing',
            'onboardingStep', 'onboardingComplete', 'isDraft'
        ];

        const filteredBody = {};
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) {
                filteredBody[key] = req.body[key];
            }
        }

        const flatData = flattenObject(filteredBody);

        const updatedNurse = await Nurse.findByIdAndUpdate(
            req.user.profileId, 
            { $set: flatData }, 
            { new: true, runValidators: true }
        );

        if (!updatedNurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }

        // Sync auth model if needed
        if (filteredBody.fullName || filteredBody.email || filteredBody.phone) {
            const userUpdates = {};
            if (filteredBody.fullName) userUpdates.fullName = filteredBody.fullName;
            if (filteredBody.email) userUpdates.email = filteredBody.email;
            if (filteredBody.phone) userUpdates.phone = filteredBody.phone;
            await User.findByIdAndUpdate(req.user.id, { $set: userUpdates });
        }

        const nurseResponse = updatedNurse.toObject();
        delete nurseResponse.password;

        res.json(nurseResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all active nurses (for public/patient viewing)
// @route   GET /api/nurses
// @access  Public or Patient
exports.getActiveNurses = async (req, res) => {
    try {
        const nurses = await Nurse.find({ status: 'Active' })
                                  .select('-password -nationalId -licenseNumber')
                                  .sort({ 'ratings.weightedRating': -1, 'ratings.averageRating': -1, createdAt: -1 });
        res.json(nurses);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update nurse availability
// @route   PUT /api/nurses/availability
// @access  Private (Nurse only)
exports.updateAvailability = async (req, res) => {
    try {
        const nurse = await Nurse.findById(req.user.profileId);
        if (!nurse) return res.status(404).json({ message: 'Nurse not found' });

        const { days, timeSlots, emergencyAvailable } = req.body;

        if (days) nurse.availability.days = days;
        if (timeSlots) nurse.availability.timeSlots = timeSlots;
        if (emergencyAvailable !== undefined) nurse.availability.emergencyAvailable = emergencyAvailable;

        await nurse.save();
        res.json(nurse.availability);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Find nearby active nurses based on patient coordinates
// @route   GET /api/nurses/nearby?lng=...&lat=...&distance=...
// @access  Private (Patient only)
exports.getNearbyNurses = async (req, res) => {
    try {
        const { lng, lat, distance } = req.query;

        if (!lng || !lat) {
            return res.status(400).json({ message: 'Please provide longitude and latitude' });
        }

        // Default distance to 10km (in meters)
        const maxDistance = distance ? parseInt(distance, 10) * 1000 : 10000;

        const nurses = await Nurse.aggregate([
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    distanceField: 'distance',
                    maxDistance: maxDistance,
                    spherical: true,
                    query: { status: 'Active' } // Only show active nurses
                }
            },
            {
                $addFields: {
                    // m = 3 (Minimum reviews to be considered established)
                    // C = 4.0 (Global mean average rating assumption)
                    // v = totalReviews, R = averageRating
                    // Bayesian Average Formula: (v / (v+m)) * R + (m / (v+m)) * C
                    bayesianScore: {
                        $let: {
                            vars: {
                                v: { $ifNull: ["$ratings.totalReviews", 0] },
                                R: { $ifNull: ["$ratings.averageRating", 0] },
                                m: 3,
                                C: 4.0
                            },
                            in: {
                                $add: [
                                    { $multiply: [ { $divide: ["$$v", { $add: ["$$v", "$$m"] }] }, "$$R" ] },
                                    { $multiply: [ { $divide: ["$$m", { $add: ["$$v", "$$m"] }] }, "$$C" ] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    // Distance penalty: reduce the score slightly the further away they are (e.g., -0.05 per km)
                    // distance is returned in meters, so divide by 1000 for km
                    finalRankingScore: {
                        $subtract: [
                            "$bayesianScore",
                            { $multiply: [ { $divide: ["$distance", 1000] }, 0.05 ] }
                        ]
                    }
                }
            },
            {
                $sort: { finalRankingScore: -1 } // Highest unbiased score first
            },
            {
                $project: {
                    password: 0,
                    nationalId: 0,
                    licenseNumber: 0
                }
            }
        ]);

        res.json({ count: nurses.length, nurses });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching nearby nurses', error: error.message });
    }
};

// @desc    Get single nurse profile along with upcoming booked slots
// @route   GET /api/nurses/:id
// @access  Public or Patient
exports.getNurseById = async (req, res) => {
    try {
        const nurse = await Nurse.findById(req.params.id)
            .select('-password -nationalId -licenseNumber');
            
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }

        // Fetch upcoming accepted or in-progress bookings for next 30 days
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const thirtyDaysAhead = new Date(todayStart);
        thirtyDaysAhead.setUTCDate(thirtyDaysAhead.getUTCDate() + 30);

        const upcomingBookings = await Booking.find({
            nurseId: nurse._id,
            status: { $in: ['Accepted', 'In Progress'] },
            'schedule.startDate': { $gte: todayStart, $lte: thirtyDaysAhead }
        }).select('schedule.startDate schedule.timeSlots');

        const bookedByDate = {};
        upcomingBookings.forEach(b => {
            if (b.schedule && b.schedule.startDate) {
                const dStr = new Date(b.schedule.startDate).toISOString().split('T')[0];
                if (!bookedByDate[dStr]) bookedByDate[dStr] = [];
                if (Array.isArray(b.schedule.timeSlots)) {
                    b.schedule.timeSlots.forEach(ts => {
                        if (!bookedByDate[dStr].includes(ts)) bookedByDate[dStr].push(ts);
                    });
                }
            }
        });

        const nurseData = nurse.toObject();
        nurseData.upcomingBookedSlots = Object.keys(bookedByDate).map(d => ({
            date: d,
            bookedSlots: bookedByDate[d]
        }));

        res.json(nurseData);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching nurse details', error: error.message });
    }
};

// @desc    Get nurse availability & check which time slots are booked (faded out) for a specific date
// @route   GET /api/nurses/:id/availability?date=YYYY-MM-DD
// @access  Public or Patient
exports.getNurseAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        const nurse = await Nurse.findById(id).select('fullName availability pricing status');
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }

        const defaultSlots = ['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Night (7pm–7am)'];
        const baseSlots = (nurse.availability && Array.isArray(nurse.availability.timeSlots) && nurse.availability.timeSlots.length > 0)
            ? nurse.availability.timeSlots
            : defaultSlots;

        const baseDays = (nurse.availability && Array.isArray(nurse.availability.days) && nurse.availability.days.length > 0)
            ? nurse.availability.days
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        const slotsMatch = (s1, s2) => {
            if (!s1 || !s2) return false;
            const a = s1.toLowerCase().trim();
            const b = s2.toLowerCase().trim();
            return a === b || a.includes(b) || b.includes(a);
        };

        if (date) {
            const targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
            }

            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayOfWeek = dayNames[targetDate.getUTCDay()];
            const isWorkingDay = baseDays.some(d => d.toLowerCase() === dayOfWeek.toLowerCase());

            const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
            const dayEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

            // Find all accepted or in-progress bookings on this date for this nurse
            const acceptedBookings = await Booking.find({
                nurseId: nurse._id,
                status: { $in: ['Accepted', 'In Progress'] },
                'schedule.startDate': { $gte: dayStart, $lte: dayEnd }
            }).select('schedule status');

            const bookedSlotsList = [];
            acceptedBookings.forEach(b => {
                if (b.schedule && Array.isArray(b.schedule.timeSlots)) {
                    b.schedule.timeSlots.forEach(ts => bookedSlotsList.push(ts));
                }
            });

            // Map each slot with isAvailable, isBooked, and a status label (for frontend fade-out)
            const timeSlots = baseSlots.map(slot => {
                const isBooked = bookedSlotsList.some(booked => slotsMatch(booked, slot));
                return {
                    slot,
                    isAvailable: !isBooked && isWorkingDay,
                    isBooked: isBooked,
                    status: isBooked ? 'Booked' : (isWorkingDay ? 'Available' : 'Day Off')
                };
            });

            return res.json({
                nurseId: nurse._id,
                nurseName: nurse.fullName,
                date: targetDate.toISOString().split('T')[0],
                dayOfWeek,
                isWorkingDay,
                emergencyAvailable: nurse.availability ? !!nurse.availability.emergencyAvailable : false,
                timeSlots,
                bookedSlots: bookedSlotsList,
                availableSlots: timeSlots.filter(t => t.isAvailable).map(t => t.slot)
            });
        }

        // If no date query, return calendar overview of all booked slots for the next 30 days
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const thirtyDaysAhead = new Date(todayStart);
        thirtyDaysAhead.setUTCDate(thirtyDaysAhead.getUTCDate() + 30);

        const upcomingBookings = await Booking.find({
            nurseId: nurse._id,
            status: { $in: ['Accepted', 'In Progress'] },
            'schedule.startDate': { $gte: todayStart, $lte: thirtyDaysAhead }
        }).select('schedule.startDate schedule.timeSlots');

        const bookedByDate = {};
        upcomingBookings.forEach(b => {
            if (b.schedule && b.schedule.startDate) {
                const dStr = new Date(b.schedule.startDate).toISOString().split('T')[0];
                if (!bookedByDate[dStr]) bookedByDate[dStr] = [];
                if (Array.isArray(b.schedule.timeSlots)) {
                    b.schedule.timeSlots.forEach(ts => {
                        if (!bookedByDate[dStr].includes(ts)) bookedByDate[dStr].push(ts);
                    });
                }
            }
        });

        const upcomingBookedSlots = Object.keys(bookedByDate).map(d => ({
            date: d,
            bookedSlots: bookedByDate[d]
        }));

        res.json({
            nurseId: nurse._id,
            nurseName: nurse.fullName,
            baseDays: baseDays,
            baseTimeSlots: baseSlots,
            emergencyAvailable: nurse.availability ? !!nurse.availability.emergencyAvailable : false,
            upcomingBookedSlots
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching availability', error: error.message });
    }
};

