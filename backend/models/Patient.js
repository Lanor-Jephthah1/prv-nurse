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
    
    // Medical Info (Encrypted at rest)
    medicalInfo: {
        type: String,
        get: function(data) {
            try {
                if (!data || !data.includes(':')) return data ? JSON.parse(data) : {}; // Fallback for unencrypted old data
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
    
    // Emergency Contact
    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        phone: { type: String }
    },

    // Mobile Money Details
    mobileMoneyNumber: { type: String },

    // Password Reset
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

patientSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Patient', patientSchema);
