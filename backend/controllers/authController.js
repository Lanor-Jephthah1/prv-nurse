const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Admin = require('../models/Admin');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Generate Access and Refresh Tokens
const generateTokens = (id, role) => {
    const accessToken = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

// Generic Registration Handler
const registerUser = async (req, res, role) => {
    const { fullName, email, password, phone } = req.body;
    
    try {
        let Model = role === 'nurse' ? Nurse : (role === 'patient' ? Patient : Admin);
        
        // Check if user already exists
        const userExists = await Model.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password with bcrypt work factor of 12 (as per thesis)
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await Model.create({
            fullName,
            email,
            password: hashedPassword,
            phone
        });

        const tokens = generateTokens(user._id, role);
        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during registration', error: error.message });
    }
};

// Generic Login Handler
const loginUser = async (req, res, role) => {
    const { email, password } = req.body;

    try {
        let Model = role === 'nurse' ? Nurse : (role === 'patient' ? Patient : Admin);
        
        // Find user by email
        const user = await Model.findOne({ email });
        
        // Compare passwords
        if (user && (await bcrypt.compare(password, user.password))) {
            const tokens = generateTokens(user._id, role);
            res.json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role,
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

// Exported Handlers
exports.registerNurse = (req, res) => registerUser(req, res, 'nurse');
exports.registerPatient = (req, res) => registerUser(req, res, 'patient');
exports.registerAdmin = (req, res) => registerUser(req, res, 'admin');

exports.loginNurse = (req, res) => loginUser(req, res, 'nurse');
exports.loginPatient = (req, res) => loginUser(req, res, 'patient');
exports.loginAdmin = (req, res) => loginUser(req, res, 'admin');

// Refresh Token Handler
exports.refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Refresh token required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tokens = generateTokens(decoded.id, decoded.role);
        res.json(tokens);
    } catch (error) {
        res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: 'Please provide email and role (patient/nurse/admin)' });

    try {
        let Model = role === 'nurse' ? Nurse : (role === 'patient' ? Patient : Admin);
        const user = await Model.findOne({ email });

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
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

        await sendEmail({
            email: user.email,
            subject: 'Password Reset Token',
            message
        });

        res.status(200).json({ message: 'Email sent' });
    } catch (error) {
        let Model = req.body.role === 'nurse' ? Nurse : (req.body.role === 'patient' ? Patient : Admin);
        const user = await Model.findOne({ email: req.body.email });
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
    const { token, role, password } = req.body;
    
    try {
        // Get hashed token
        const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
        
        let Model = role === 'nurse' ? Nurse : (role === 'patient' ? Patient : Admin);
        
        const user = await Model.findOne({
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
