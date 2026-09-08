const admin = require('../config/firebase');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Nurse = require('../models/Nurse');

// Middleware to protect routes and enforce role-based access control
const verifyFirebaseToken = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no Firebase token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // STRICT EMAIL VERIFICATION CHECK
        if (decodedToken.email && !decodedToken.email_verified) {
            return res.status(403).json({ 
                message: 'Email not verified. Please verify your email address before continuing.',
                code: 'EMAIL_NOT_VERIFIED'
            });
        }

        req.firebaseUser = decodedToken; // Attach token payload
        next();
    } catch (error) {
        console.error('Firebase Auth Error:', error);
        return res.status(401).json({ message: 'Not authorized, Firebase token failed or expired' });
    }
};

const protect = (roles = []) => {
    return async (req, res, next) => {
        let token;

        // Check if authorization header exists and starts with Bearer
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no Firebase token provided' });
        }

        try {
            // Verify Firebase token
            const decodedToken = await admin.auth().verifyIdToken(token);
            
            // STRICT EMAIL VERIFICATION CHECK
            if (decodedToken.email && !decodedToken.email_verified) {
                return res.status(403).json({ 
                    message: 'Email not verified. Please verify your email address before continuing.',
                    code: 'EMAIL_NOT_VERIFIED'
                });
            }
            
            // Find the MongoDB user corresponding to this Firebase UID
            const user = await User.findOne({ firebaseUid: decodedToken.uid });
            if (!user) {
                return res.status(401).json({ 
                    message: 'User authenticated in Firebase but not found in Database',
                    code: 'USER_NOT_REGISTERED'
                });
            }

            // Attach user payload to request
            req.user = {
                id: user._id,
                firebaseUid: user.firebaseUid,
                role: user.role
            };

            // Look up the specific profile ID based on role and attach it
            if (user.role === 'patient') {
                const profile = await Patient.findOne({ userId: user._id });
                if (profile) req.user.profileId = profile._id.toString();
            } else if (user.role === 'nurse') {
                const profile = await Nurse.findOne({ userId: user._id });
                if (profile) req.user.profileId = profile._id.toString();
            }
            
            // Check if the user's role is allowed to access this route
            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions to access this resource' });
            }
            
            next();
        } catch (error) {
            console.error('Firebase Auth Error:', error);
            return res.status(401).json({ message: 'Not authorized, Firebase token failed or expired' });
        }
    };
};

module.exports = { protect, verifyFirebaseToken };
