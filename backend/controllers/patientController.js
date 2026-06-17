const Patient = require('../models/Patient');

// @desc    Get current patient profile
// @route   GET /api/patients/profile
// @access  Private (Patient only)
exports.getProfile = async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.id).select('-password');
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update patient profile (location, medical info, emergency contact)
// @route   PUT /api/patients/profile
// @access  Private (Patient only)
exports.updateProfile = async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const { 
            phone, address, landmark, 
            location, medicalInfo, emergencyContact, mobileMoneyNumber 
        } = req.body;

        if (phone) patient.phone = phone;
        if (address) patient.address = address;
        if (landmark) patient.landmark = landmark;
        if (medicalInfo) patient.medicalInfo = medicalInfo;
        if (emergencyContact) patient.emergencyContact = emergencyContact;
        if (mobileMoneyNumber) patient.mobileMoneyNumber = mobileMoneyNumber;

        // Location must be GeoJSON Point [lng, lat]
        if (location && location.coordinates) {
            patient.location = {
                type: 'Point',
                coordinates: location.coordinates
            };
        }

        const updatedPatient = await patient.save();
        
        const patientResponse = updatedPatient.toObject();
        delete patientResponse.password;

        res.json(patientResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
