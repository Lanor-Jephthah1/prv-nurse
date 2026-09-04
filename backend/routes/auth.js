const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    registerNurse, 
    registerPatient, 
    registerAdmin,
    getMe
} = require('../controllers/authController');

// Registration Routes (Sync Firebase UID to MongoDB)
router.post('/register/nurse', registerNurse);
router.post('/register/patient', registerPatient);
router.post('/register/admin', registerAdmin);

// Fetch Profile Route (Requires Firebase Token)
router.get('/me', protect(['patient', 'nurse', 'admin']), getMe);

module.exports = router;
