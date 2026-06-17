const Booking = require('../models/Booking');

// @desc    Initiate a MoMo payment collection for a booking
// @route   POST /api/payments/collect
// @access  Private (Patient only)
exports.initiateCollection = async (req, res) => {
    try {
        const { bookingId, mobileNumber, amount } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        // Simulate MTN MoMo Collection API Request
        console.log(`[MoMo API] Initiating collection of GHS ${amount} from ${mobileNumber} for booking ${bookingId}`);

        // Mock response representing successful trigger (transaction pending user approval on phone)
        res.json({
            status: 'SUCCESS',
            message: 'Payment collection prompt sent to phone',
            transactionId: 'momo-tx-' + Math.random().toString(36).substring(7),
            amount,
            currency: 'GHS'
        });
    } catch (error) {
        res.status(500).json({ message: 'Payment collection failed', error: error.message });
    }
};

// @desc    MTN MoMo Callback webhook receiver
// @route   POST /api/payments/webhook
// @access  Public (Called by MTN servers)
exports.momoWebhook = async (req, res) => {
    try {
        const { transactionId, status, bookingId } = req.body;

        console.log(`[MoMo Webhook] Received status update for transaction ${transactionId}: ${status}`);

        if (status === 'SUCCESSFUL') {
            // Update booking status or record payment status in booking
            const booking = await Booking.findById(bookingId);
            if (booking) {
                booking.status = 'Completed'; // release hold
                await booking.save();
                console.log(`[MoMo Webhook] Booking ${bookingId} marked as completed after successful payment`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};
