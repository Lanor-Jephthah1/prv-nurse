const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
    
    // Password Reset
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
