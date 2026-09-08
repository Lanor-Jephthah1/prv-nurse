const express = require('express');
const router = express.Router();
const { protect, verifyFirebaseToken } = require('../middleware/authMiddleware');
const { 
    registerNurse, 
    registerPatient, 
    registerAdmin,
    getMe
} = require('../controllers/authController');

// Registration Routes (Sync Firebase UID to MongoDB)
router.post('/register/nurse', verifyFirebaseToken, registerNurse);
router.post('/register/patient', verifyFirebaseToken, registerPatient);
router.post('/register/admin', verifyFirebaseToken, registerAdmin);

// Fetch Profile Route (Requires Firebase Token)
router.get('/me', protect(['patient', 'nurse', 'admin']), getMe);

module.exports = router;
