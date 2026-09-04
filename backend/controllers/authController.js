const mongoose = require('mongoose');
const User = require('../models/User');
const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Admin = require('../models/Admin');
const admin = require('../config/firebase');

// @desc    Register a new user after successful Firebase Auth
// @route   POST /api/auth/register/:role (e.g., /api/auth/register/patient)
// @access  Public
const registerUser = async (req, res, role) => {
    const { email, firebaseUid, fullName, phone } = req.body;
    
    // Start session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Check if user already exists
        const userExists = await User.findOne({ firebaseUid }).session(session);
        if (userExists) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'User already exists in database' });
        }

        // Create user linking to Firebase UID
        const user = new User({
            email,
            firebaseUid,
            role
        });
        await user.save({ session });

        // Create specific profile
        let profile;
        if (role === 'nurse') {
            profile = new Nurse({ userId: user._id, fullName, phone, email });
        } else if (role === 'patient') {
            profile = new Patient({ userId: user._id, fullName, phone, email });
        } else if (role === 'admin') {
            profile = new Admin({ userId: user._id, fullName, email });
        }
        await profile.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            _id: user._id,
            profileId: profile._id,
            fullName: profile.fullName,
            email: user.email,
            role,
            status: profile.status || 'Active', // Nurses have status
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Server error during database registration', error: error.message });
    }
};

// @desc    Fetch Profile Data after Firebase Login
// @route   GET /api/auth/me
// @access  Private (Requires valid Firebase Token in header)
exports.getMe = async (req, res) => {
    try {
        // req.user is populated by the authMiddleware using the Firebase Token
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found in Database' });

        let profile;
        if (user.role === 'nurse') {
            profile = await Nurse.findOne({ userId: user._id });
        } else if (user.role === 'patient') {
            profile = await Patient.findOne({ userId: user._id });
        } else if (user.role === 'admin') {
            profile = await Admin.findOne({ userId: user._id });
        }

        res.json({
            _id: user._id,
            profileId: profile ? profile._id : null,
            fullName: profile ? profile.fullName : '',
            email: user.email,
            role: user.role,
            status: profile ? profile.status : 'Active',
            onboardingComplete: profile && profile.onboardingComplete !== undefined ? profile.onboardingComplete : true
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching user profile', error: error.message });
    }
};

// Exported Registration Handlers
exports.registerNurse = (req, res) => registerUser(req, res, 'nurse');
exports.registerPatient = (req, res) => registerUser(req, res, 'patient');
exports.registerAdmin = (req, res) => registerUser(req, res, 'admin');

// Note: login, refreshToken, forgotPassword, resetPassword, and verifyEmail 
// have been removed because Firebase Authentication handles them entirely on the frontend!
