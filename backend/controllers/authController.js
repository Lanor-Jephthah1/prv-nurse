const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Admin = require('../models/Admin');

// Generate JWT Token with 24-hour expiration
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });
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

        // Return user data and JWT
        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role,
            token: generateToken(user._id, role)
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
            res.json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role,
                token: generateToken(user._id, role)
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
