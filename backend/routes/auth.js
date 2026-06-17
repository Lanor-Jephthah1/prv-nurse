const express = require('express');
const router = express.Router();
const { 
    registerNurse, 
    registerPatient, 
    registerAdmin,
    loginNurse, 
    loginPatient, 
    loginAdmin,
    refreshToken,
    forgotPassword,
    resetPassword
} = require('../controllers/authController');

// Registration Routes
router.post('/register/nurse', registerNurse);
router.post('/register/patient', registerPatient);
router.post('/register/admin', registerAdmin);

// Login Routes
router.post('/login/nurse', loginNurse);
router.post('/login/patient', loginPatient);
router.post('/login/admin', loginAdmin);

// Refresh Token Route
router.post('/refresh', refreshToken);

// Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
