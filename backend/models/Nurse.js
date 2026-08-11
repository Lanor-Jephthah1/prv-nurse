const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Basic Identity & Auth
    fullName: { type: String, required: true },
    email: { type: String },
    gender: { type: String },
    dob: { type: Date },
    phone: { type: String, required: true },
    profilePhoto: { type: String },
    photoUrl: { type: String }, // CDN URL
    
    // Identity Verification & Documents
    nationalId: { type: String },
    idPhotoUrl: { type: String },
    address: { type: String },
    documents: {
        nationalIdUrl: { type: String },
        passportPhotoUrl: { type: String },
        addressProofUrl: { type: String }
    },
    
    // Qualifications & Professional Info
    highestQualification: { type: String },
    graduationYear: { type: String },
    institution: { type: String },
    licensingBody: { type: String },
    certificateUrls: [{ type: String }],
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
    equipment: [{ type: String }],
    
    workHistory: [{
        title: String,
        facility: String,
        duration: String
    }],
    
    bio: { type: String },
    willingToTravel: { type: Boolean, default: false },
    travelDistance: { type: Number },
    
    // Availability & Location
    availability: {
        days: [{ type: String }],
        timeSlots: [{ type: String }],
        emergencyAvailable: { type: Boolean, default: false }
    },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
        address: { type: String }
    },
    
    // Pricing
    pricing: {
        hourlyRate: Number,
        dailyRate: Number,
        weeklyRate: Number,
        emergencyRate: Number,
        currency: { type: String, default: 'GHS' }
    },
    
    // Onboarding Status
    onboardingStep: { type: Number, default: 1 },
    onboardingComplete: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: true },
    
    // Platform Status
    status: { type: String, enum: ['Pending', 'Docs Verified', 'Background Cleared', 'Active', 'Suspended'], default: 'Pending' },
    ratings: {
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 }
    }
}, { timestamps: true });

nurseSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Nurse', nurseSchema);
