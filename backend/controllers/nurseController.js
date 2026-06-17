const Nurse = require('../models/Nurse');

// @desc    Get current nurse profile
// @route   GET /api/nurses/profile
// @access  Private (Nurse only)
exports.getProfile = async (req, res) => {
    try {
        const nurse = await Nurse.findById(req.user.id).select('-password');
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
        const nurse = await Nurse.findById(req.user.id);
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }

        // List of allowed fields to update
        const { 
            phone, address, nationalId, 
            qualifications, licenseNumber, certifications, 
            experienceYears, specializations, skills, 
            availability, pricing, location 
        } = req.body;

        // Update fields if they exist in request body
        if (phone) nurse.phone = phone;
        if (address) nurse.address = address;
        if (nationalId) nurse.nationalId = nationalId;
        if (qualifications) nurse.qualifications = qualifications;
        if (licenseNumber) nurse.licenseNumber = licenseNumber;
        if (certifications) nurse.certifications = certifications;
        if (experienceYears) nurse.experienceYears = experienceYears;
        if (specializations) nurse.specializations = specializations;
        if (skills) nurse.skills = skills;
        if (availability) nurse.availability = availability;
        if (pricing) nurse.pricing = pricing;
        
        // Location must be GeoJSON Point [lng, lat]
        if (location && location.coordinates) {
            nurse.location = {
                type: 'Point',
                coordinates: location.coordinates
            };
        }

        const updatedNurse = await nurse.save();
        
        // Don't send password back
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
        const nurse = await Nurse.findById(req.user.id);
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
