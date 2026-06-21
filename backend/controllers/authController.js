const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Admin = require('../models/Admin');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Generate Access and Refresh Tokens
const generateTokens = (id, role, profileId) => {
    const accessToken = jwt.sign({ id, role, profileId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id, role, profileId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

// Generic Registration Handler
const registerUser = async (req, res, role) => {
    const { fullName, email, password, phone } = req.body;
    
    // Start session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Check if user already exists
        const userExists = await User.findOne({ email }).session(session);
        if (userExists) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password with bcrypt work factor of 12
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            role
        });
        await user.save({ session });

        // Create specific profile
        let profile;
        if (role === 'nurse') {
            profile = new Nurse({ userId: user._id, fullName, phone });
        } else if (role === 'patient') {
            profile = new Patient({ userId: user._id, fullName, phone });
        } else if (role === 'admin') {
            profile = new Admin({ userId: user._id, fullName });
        }
        await profile.save({ session });

        await session.commitTransaction();
        session.endSession();

        const tokens = generateTokens(user._id, role, profile._id);
        res.status(201).json({
            _id: user._id,
            profileId: profile._id,
            fullName: profile.fullName,
            email: user.email,
            role,
            status: profile.status || 'Active', // Nurses have status
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Server error during registration', error: error.message });
    }
};

// Consolidated Login Handler
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        
        // Compare passwords
        if (user && (await bcrypt.compare(password, user.password))) {
            // Get profile depending on role
            let profile;
            if (user.role === 'nurse') profile = await Nurse.findOne({ userId: user._id });
            else if (user.role === 'patient') profile = await Patient.findOne({ userId: user._id });
            else if (user.role === 'admin') profile = await Admin.findOne({ userId: user._id });

            const tokens = generateTokens(user._id, user.role, profile ? profile._id : null);
            
            res.json({
                _id: user._id,
                profileId: profile ? profile._id : null,
                fullName: profile ? profile.fullName : '',
                email: user.email,
                role: user.role,
                status: profile ? profile.status : 'Active',
                onboardingComplete: profile && profile.status ? profile.status !== 'Pending' : true,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }
};

// Exported Registration Handlers
exports.registerNurse = (req, res) => registerUser(req, res, 'nurse');
exports.registerPatient = (req, res) => registerUser(req, res, 'patient');
exports.registerAdmin = (req, res) => registerUser(req, res, 'admin');

// Refresh Token Handler
exports.refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Refresh token required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tokens = generateTokens(decoded.id, decoded.role, decoded.profileId);
        res.json(tokens);
    } catch (error) {
        res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Please provide an email' });

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'There is no user with that email' });
        }

        // Generate token
        const resetToken = crypto.randomBytes(20).toString('hex');
        
        // Hash token and set to resetPasswordToken field
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        // Set expire (10 minutes)
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save({ validateBeforeSave: false });

        // Create reset url (frontend URL)
        const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}&role=${user.role}`;
        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

        await sendEmail({
            email: user.email,
            subject: 'Password Reset Token',
            message
        });

        res.status(200).json({ message: 'Email sent' });
    } catch (error) {
        const user = await User.findOne({ email: req.body.email });
        if (user) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
        }
        res.status(500).json({ message: 'Email could not be sent', error: error.message });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;
    
    try {
        // Get hashed token
        const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
        
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        // Set new password
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during password reset', error: error.message });
    }
};
