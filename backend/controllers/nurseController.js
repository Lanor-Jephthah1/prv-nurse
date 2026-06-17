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
