const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
    // Basic Identity & Auth
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    dob: { type: Date },
    phone: { type: String, required: true },
    photoUrl: { type: String }, // CDN URL
    
    // Identity Verification
    nationalId: { type: String },
    idPhotoUrl: { type: String },
    address: { type: String },
    
    // Qualifications & Professional Info
    qualifications: [{
        degree: String,
        institution: String,
        year: Number
    }],
    licenseNumber: { type: String },
    licenseExpiry: { type: Date },
    certifications: [{ type: String }], // e.g. RN, Midwifery, ICU
    experienceYears: { type: Number, default: 0 },
    specializations: [{ type: String }],
    skills: [{ type: String }], // e.g. Medication admin, wound dressing
    
    // Availability & Location
    availability: {
        days: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
        timeSlots: [{ type: String, enum: ['Morning', 'Afternoon', 'Night'] }],
        emergencyAvailable: { type: Boolean, default: false }
    },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },
    
    // Pricing
    pricing: {
        hourlyRate: Number,
        dailyRate: Number,
        emergencyRate: Number
    },
    
    // Platform Status
    status: { type: String, enum: ['Pending', 'Docs Verified', 'Background Cleared', 'Active', 'Suspended'], default: 'Pending' },
    ratings: {
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 }
    }
}, { timestamps: true });

nurseSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Nurse', nurseSchema);
