const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    getDashboardMetrics,
    getTrends,
    getHeatmap,
    getPendingVerifications, 
    updateVerificationStatus,
    getAllBookings,
    updateBooking,
    cancelBooking,
    flagPatient,
    getIncidents,
    getPatientDetails,
    escalateIncident,
    getSystemHealth,
    getAuditLogs,
    getActiveEmergencies,
    escalateEmergency,
    forceSyncUsers,
    initDb
} = require('../controllers/adminController');

// 0. Database Maintenance
router.post('/force-sync', forceSyncUsers);
router.post('/init-db', initDb);

// 1. Dashboard & Metrics
router.get('/metrics', protect(['admin']), getDashboardMetrics);
router.get('/metrics/trends', protect(['admin']), getTrends);
router.get('/metrics/heatmap', protect(['admin']), getHeatmap);

// 2. Verification Management
router.get('/verifications', protect(['admin']), getPendingVerifications);
router.patch('/verifications/:id', protect(['admin']), updateVerificationStatus);

// 3. Booking Management
router.get('/bookings', protect(['admin']), getAllBookings);
router.put('/bookings/:id', protect(['admin']), updateBooking);
router.patch('/bookings/:id/cancel', protect(['admin']), cancelBooking);

// 4. Patient Safety & Moderation
router.get('/patients/:id', protect(['admin']), getPatientDetails);
router.patch('/patients/:id/flag', protect(['admin']), flagPatient);
router.get('/incidents', protect(['admin']), getIncidents);
router.patch('/incidents/:id/escalate', protect(['admin']), escalateIncident);

// 5. System Health
router.get('/health', protect(['admin']), getSystemHealth);

// 6. Audit Logs
router.get('/audit-logs', protect(['admin']), getAuditLogs);

// 7. Emergency Monitoring
router.get('/emergencies', protect(['admin']), getActiveEmergencies);
router.patch('/emergencies/:id/escalate', protect(['admin']), escalateEmergency);

// 8. User Management (Deletion)
const { deleteNurse, deletePatient } = require('../controllers/adminController');
router.delete('/nurses/:id', protect(['admin']), deleteNurse);
router.delete('/patients/:id', protect(['admin']), deletePatient);

module.exports = router;
