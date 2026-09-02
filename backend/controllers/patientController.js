const Patient = require('../models/Patient');
const User = require('../models/User');

// @desc    Get current patient profile
// @route   GET /api/patients/profile
// @access  Private (Patient only)
exports.getProfile = async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.profileId).select('-password');
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update patient profile (5-Step Onboarding Flow)
// @route   PUT/PATCH /api/patients/profile
// @access  Private (Patient only)
exports.updateProfile = async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.profileId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const updates = req.body;

        // Step 1: Personal
        if (updates.fullName !== undefined) patient.fullName = updates.fullName;
        if (updates.dob !== undefined) patient.dob = updates.dob;
        if (updates.gender !== undefined) patient.gender = updates.gender;
        if (updates.photoUrl !== undefined) patient.photoUrl = updates.photoUrl;
        if (updates.bookingRelationship !== undefined) patient.bookingRelationship = updates.bookingRelationship;

        // Step 2: Contact & Location
        if (updates.phone !== undefined) patient.phone = updates.phone;
        if (updates.email !== undefined) patient.email = updates.email;
        if (updates.address !== undefined) patient.address = updates.address;
        if (updates.region !== undefined) patient.region = updates.region;
        if (updates.city !== undefined) patient.city = updates.city;
        if (updates.landmark !== undefined) patient.landmark = updates.landmark;
        if (updates.ghanaPostGps !== undefined) patient.ghanaPostGps = updates.ghanaPostGps;
        if (updates.emergencyContact !== undefined) patient.emergencyContact = updates.emergencyContact;

        // Geospatial Location mapping
        if (updates.location && updates.location.coordinates) {
            patient.location = {
                type: 'Point',
                coordinates: updates.location.coordinates
            };
        }

        // Step 3: Medical Background
        if (updates.medicalBackground !== undefined) patient.medicalBackground = updates.medicalBackground;
        if (updates.medicalInfo !== undefined) patient.medicalInfo = updates.medicalInfo; // Legacy support

        // Step 4: Care Needs
        if (updates.careNeeds !== undefined) patient.careNeeds = updates.careNeeds;

        // Step 5: Preferences & Status
        if (updates.preferences !== undefined) patient.preferences = updates.preferences;
        
        if (updates.onboardingComplete === true && patient.onboardingComplete !== true) {
            patient.onboardingComplete = true;
            // Also update the User auth document if they track onboarding there
            await User.findByIdAndUpdate(req.user.id, { status: 'Active' });
        }

        const updatedPatient = await patient.save();
        
        const patientResponse = updatedPatient.toObject();
        delete patientResponse.password; // Safeguard

        res.json(patientResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
