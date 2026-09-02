const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // STEP 1: Personal Details
    fullName: { type: String, required: true },
    dob: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'] },
    photoUrl: { type: String },
    bookingRelationship: { type: String },

    // STEP 2: Contact, Location & Emergency
    phone: { type: String, required: true },
    email: { type: String },
    
    address: { type: String },
    region: { type: String },
    city: { type: String },
    landmark: { type: String },
    ghanaPostGps: { type: String },
    
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },

    emergencyContact: {
        fullName: { type: String },
        relationship: { type: String },
        primaryPhone: { type: String },
        alternativePhone: { type: String }
    },
    
    // STEP 3: Medical Background
    medicalBackground: {
        primaryDiagnosis: { type: String },
        secondaryConditions: [{ type: String }],
        bloodType: { type: String },
        knownAllergies: [{ type: String }],
        mobilityStatus: { type: String },
        homeMedicalEquipment: [{ type: String }]
    },

    // STEP 4: Care Needs & Medications
    careNeeds: {
        typeOfCare: { type: String },
        specificClinicalTasks: [{ type: String }],
        schedule: {
            frequency: { type: String },
            preferredShiftSlots: [{ type: String }]
        },
        currentMedications: [{
            drugName: String,
            dosage: String,
            instructions: String
        }]
    },

    // STEP 5: Preferences
    preferences: {
        nurseGenderPreference: { type: String },
        preferredLanguage: [{ type: String }],
        budgetRange: { type: String },
        specialInstructions: { type: String }
    },

    // Status
    onboardingComplete: { type: Boolean, default: false },

    // Legacy (Encrypted at rest)
    medicalInfo: {
        type: String,
        get: function(data) {
            try {
                if (!data || !data.includes(':')) return data ? JSON.parse(data) : {};
                const crypto = require('crypto');
                const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
                const textParts = data.split(':');
                const iv = Buffer.from(textParts.shift(), 'hex');
                const encryptedText = Buffer.from(textParts.join(':'), 'hex');
                const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
                let decrypted = decipher.update(encryptedText);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return JSON.parse(decrypted.toString());
            } catch (err) {
                return {};
            }
        },
        set: function(data) {
            if (!data) return data;
            const crypto = require('crypto');
            const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
            const IV_LENGTH = 16;
            const text = typeof data === 'string' ? data : JSON.stringify(data);
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        }
    },

    mobileMoneyNumber: { type: String }
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

patientSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Patient', patientSchema);
