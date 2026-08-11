const Nurse = require('../models/Nurse');
const User = require('../models/User');

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
                                  .select('-password -nationalId -licenseNumber');
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
