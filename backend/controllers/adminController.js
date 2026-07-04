const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Incident = require('../models/Incident');
const AuditLog = require('../models/AuditLog');
const Emergency = require('../models/Emergency');

// Utility to create an audit log
const createAuditLog = async (adminId, action, targetType, targetId, details) => {
    try {
        await AuditLog.create({ adminId, action, targetType, targetId, details });
    } catch (error) {
        console.error('Failed to create audit log', error);
    }
};

// ==========================================
// 1. DASHBOARD & METRICS
// ==========================================

// @desc    Get dashboard metrics
// @route   GET /api/admin/metrics
// @access  Private (Admin only)
exports.getDashboardMetrics = async (req, res) => {
    try {
        const totalNurses = await Nurse.countDocuments({ status: 'Active' });
        const pendingNurses = await Nurse.countDocuments({ status: 'Pending' });
        const totalPatients = await Patient.countDocuments();
        
        const activeBookings = await Booking.countDocuments({ status: 'In Progress' });
        
        // Today's bookings
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const todaysBookings = await Booking.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        const totalBookings = await Booking.countDocuments();

        // Revenue (sum of all disbursed or held payments)
        const payments = await Payment.find({ status: { $in: ['Disbursed', 'Held'] } });
        const totalRevenue = payments.reduce((acc, curr) => acc + (curr.serviceFee || 0), 0);

        // Emergency requests
        const activeEmergencies = await Emergency.countDocuments({ status: 'Active' });

        // Open Disputes
        const openDisputes = await Incident.countDocuments({ type: 'Dispute', status: 'Open' });

        res.json({
            nurses: { active: totalNurses, pending: pendingNurses },
            patients: { total: totalPatients },
            bookings: { active: activeBookings, today: todaysBookings, total: totalBookings },
            revenue: totalRevenue,
            emergencies: activeEmergencies,
            disputes: openDisputes
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get booking trends
// @route   GET /api/admin/metrics/trends
// @access  Private (Admin only)
exports.getTrends = async (req, res) => {
    try {
        // Simple aggregation for bookings per day over the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const trends = await Booking.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);
        res.json(trends);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get nurse availability heatmap
// @route   GET /api/admin/metrics/heatmap
// @access  Private (Admin only)
exports.getHeatmap = async (req, res) => {
    try {
        const nurses = await Nurse.find({ status: 'Active' }).select('location');
        const heatmapData = nurses.map(n => ({
            lat: n.location?.coordinates[1],
            lng: n.location?.coordinates[0]
        })).filter(loc => loc.lat && loc.lng);
        res.json(heatmapData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 2. VERIFICATION MANAGEMENT
// ==========================================

// @desc    Get all pending nurse verifications
// @route   GET /api/admin/verifications
// @access  Private (Admin only)
exports.getPendingVerifications = async (req, res) => {
    try {
        const pendingNurses = await Nurse.find({ 
            $or: [
                { status: { $in: ['Pending', 'Docs Verified', 'Background Cleared'] } },
                { status: { $exists: false } },
                { status: null }
            ]
        }).select('fullName email phone nationalId idPhotoUrl qualifications licenseNumber status');
        
        res.json(pendingNurses);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update nurse verification status
// @route   PATCH /api/admin/verifications/:id
// @access  Private (Admin only)
exports.updateVerificationStatus = async (req, res) => {
    try {
        const { status, comments } = req.body; // 'Docs Verified', 'Background Cleared', 'Active', 'Rejected', 'Suspended'
        const nurseId = req.params.id;

        const nurse = await Nurse.findById(nurseId);
        if (!nurse) return res.status(404).json({ message: 'Nurse not found' });

        const oldStatus = nurse.status;
        nurse.status = status;
        await nurse.save();

        // Log the action
        await createAuditLog(req.user.id, 'UPDATE_VERIFICATION_STATUS', 'Nurse', nurseId, { oldStatus, newStatus: status, comments });

        res.json({ message: `Nurse status updated from ${oldStatus} to ${status}`, nurse });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 3. BOOKING MANAGEMENT (GLOBAL)
// ==========================================

exports.getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('patientId', 'fullName phone')
            .populate('nurseId', 'fullName phone')
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateBooking = async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
        await createAuditLog(req.user.id, 'MODIFY_BOOKING', 'Booking', booking._id, { updates: req.body });
        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        booking.status = 'Cancelled';
        await booking.save();
        await createAuditLog(req.user.id, 'CANCEL_BOOKING', 'Booking', booking._id, { reason: req.body.reason });
        res.json({ message: 'Booking cancelled globally', booking });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 4. PATIENT SAFETY & MODERATION
// ==========================================

exports.flagPatient = async (req, res) => {
    try {
        // Since we didn't add flag to Patient, we can create an Incident for this patient
        const incident = await Incident.create({
            reportedBy: req.user.id,
            targetUser: req.params.id,
            type: 'Safety',
            description: req.body.reason || 'Flagged by Admin'
        });
        await createAuditLog(req.user.id, 'FLAG_PATIENT', 'Patient', req.params.id, { incidentId: incident._id });
        res.json({ message: 'Patient flagged successfully', incident });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getIncidents = async (req, res) => {
    try {
        const incidents = await Incident.find().populate('reportedBy targetUser bookingId');
        res.json(incidents);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getPatientDetails = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found' });
        
        // Log medical data access for accountability
        await createAuditLog(req.user.id, 'VIEW_MEDICAL_DATA', 'Patient', patient._id, { reason: 'Admin dashboard access' });
        
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.escalateIncident = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) return res.status(404).json({ message: 'Incident not found' });
        
        incident.status = req.body.status || 'Escalated';
        incident.resolutionNotes = req.body.resolutionNotes;
        await incident.save();

        await createAuditLog(req.user.id, 'ESCALATE_INCIDENT', 'Incident', incident._id, { newStatus: incident.status });
        res.json({ message: 'Incident escalated', incident });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 5. SYSTEM HEALTH
// ==========================================

exports.getSystemHealth = async (req, res) => {
    try {
        const paymentsTotal = await Payment.countDocuments();
        const paymentsSuccess = await Payment.countDocuments({ status: 'Disbursed' });
        const paymentsFailed = await Payment.countDocuments({ status: 'Failed' });

        const successRate = paymentsTotal === 0 ? 0 : (paymentsSuccess / paymentsTotal) * 100;

        // Calculate Average Match Time
        const matchedBookings = await Booking.find({ matchedAt: { $exists: true, $ne: null } });
        let totalMatchTime = 0;
        matchedBookings.forEach(b => {
            totalMatchTime += (new Date(b.matchedAt).getTime() - new Date(b.createdAt).getTime());
        });
        const avgMatchTimeMs = matchedBookings.length > 0 ? (totalMatchTime / matchedBookings.length) : 0;
        const avgMatchTimeMinutes = (avgMatchTimeMs / (1000 * 60)).toFixed(2);

        res.json({
            status: 'Operational',
            uptime: process.uptime(),
            payments: {
                total: paymentsTotal,
                successRate: successRate.toFixed(2) + '%',
                failed: paymentsFailed
            },
            averageMatchTimeMinutes: avgMatchTimeMinutes
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 6. AUDIT LOGS
// ==========================================

exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find().populate('adminId', 'fullName email').sort({ createdAt: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 7. EMERGENCY MONITORING
// ==========================================

exports.getActiveEmergencies = async (req, res) => {
    try {
        const emergencies = await Emergency.find({ status: { $ne: 'Resolved' } }).populate('patientId nurseId bookingId');
        res.json(emergencies);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.escalateEmergency = async (req, res) => {
    try {
        const emergency = await Emergency.findById(req.params.id);
        if (!emergency) return res.status(404).json({ message: 'Emergency not found' });

        emergency.status = req.body.status || 'Escalated to Services';
        emergency.resolutionNotes = req.body.resolutionNotes;
        await emergency.save();

        await createAuditLog(req.user.id, 'ESCALATE_EMERGENCY', 'System', emergency._id, { newStatus: emergency.status });
        res.json({ message: 'Emergency escalated', emergency });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ==========================================
// 8. MASTER SYNC (TEMPORARY MIGRATION)
// ==========================================
const User = require('../models/User');

exports.forceSyncUsers = async (req, res) => {
    try {
        const users = await User.find();
        let migrated = { nurses: 0, patients: 0, admins: 0 };
        
        for (const user of users) {
            if (user.role === 'nurse') {
                const exists = await Nurse.findOne({ userId: user._id });
                if (!exists) {
                    await Nurse.create({ userId: user._id, fullName: user.fullName || 'Legacy Nurse', phone: user.phone || '', status: 'Pending' });
                    migrated.nurses++;
                }
            } else if (user.role === 'patient') {
                const exists = await Patient.findOne({ userId: user._id });
                if (!exists) {
                    await Patient.create({ userId: user._id, fullName: user.fullName || 'Legacy Patient', phone: user.phone || '' });
                    migrated.patients++;
                }
            }
        }
        
        res.json({ message: 'Legacy users fully synced to new architecture!', migrated });
    } catch (error) {
        res.status(500).json({ message: 'Server error during sync', error: error.message });
    }
};
