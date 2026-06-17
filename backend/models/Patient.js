const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    // Identity & Auth
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    dob: { type: Date },
    phone: { type: String, required: true },
    
    // Location
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },
    address: { type: String },
    landmark: { type: String },
    
    // Medical Info
    medicalInfo: {
        primaryCondition: { type: String },
        medications: [{ type: String }],
        allergies: [{ type: String }],
        mobilityStatus: { type: String, enum: ['Independent', 'Limited', 'Bedridden'] }
    },
    
    // Emergency Contact
    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        phone: { type: String }
    },

    // Mobile Money Details
    mobileMoneyNumber: { type: String }
}, { timestamps: true });

patientSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Patient', patientSchema);
