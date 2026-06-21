const Message = require('../models/Message');
const Booking = require('../models/Booking');

// @desc    Get chat history for a booking
// @route   GET /api/messages/:bookingId
// @access  Private (Patient or Nurse involved in booking)
exports.getMessages = async (req, res) => {
    try {
        const { bookingId } = req.params;

        // Verify booking participation
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        
        if (booking.patientId.toString() !== req.user.profileId && booking.nurseId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized to view these messages' });
        }

        const messages = await Message.find({ bookingId }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Send a new message via REST (fallback if socket not used directly)
// @route   POST /api/messages/:bookingId
// @access  Private (Patient or Nurse involved in booking)
exports.sendMessage = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { text } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        
        if (booking.patientId.toString() !== req.user.profileId && booking.nurseId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized to send messages here' });
        }

        const message = await Message.create({
            bookingId,
            sender: req.user.profileId,
            senderModel: req.user.role === 'patient' ? 'Patient' : 'Nurse',
            text
        });

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
