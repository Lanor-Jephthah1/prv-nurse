const Nurse = require('../models/Nurse');
const Patient = require('../models/Patient');
const Booking = require('../models/Booking');

// @desc    Get dashboard metrics
// @route   GET /api/admin/metrics
// @access  Private (Admin only)
exports.getDashboardMetrics = async (req, res) => {
    try {
        const totalNurses = await Nurse.countDocuments({ status: 'Active' });
        const pendingNurses = await Nurse.countDocuments({ status: 'Pending' });
        const totalPatients = await Patient.countDocuments();
        const activeBookings = await Booking.countDocuments({ status: 'In Progress' });
        const totalBookings = await Booking.countDocuments();

        res.json({
            nurses: { active: totalNurses, pending: pendingNurses },
            patients: { total: totalPatients },
            bookings: { active: activeBookings, total: totalBookings }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all pending nurse verifications
// @route   GET /api/admin/verifications
// @access  Private (Admin only)
exports.getPendingVerifications = async (req, res) => {
    try {
        const pendingNurses = await Nurse.find({ 
            status: { $in: ['Pending', 'Docs Verified'] } 
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
        const { status } = req.body; // e.g., 'Docs Verified', 'Background Cleared', 'Active'
        const nurseId = req.params.id;

        const nurse = await Nurse.findById(nurseId);
        if (!nurse) return res.status(404).json({ message: 'Nurse not found' });

        nurse.status = status;
        await nurse.save();

        res.json({ message: `Nurse status updated to ${status}`, nurse });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
