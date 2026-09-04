const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'nurse', 'patient'], required: true },
    
    // Firebase handles Password Resets and Email Verification internally
    // We only need to track the status if desired
    emailVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
