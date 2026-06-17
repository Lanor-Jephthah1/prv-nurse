const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

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
        const { transactionId, status, bookingId, amount } = req.body;

        console.log(`[MoMo Webhook] Received status update for transaction ${transactionId}: ${status}`);

        if (status === 'SUCCESSFUL') {
            const booking = await Booking.findById(bookingId);
            if (booking) {
                const serviceFee = amount * 0.10; // 10% platform fee
                const heldUntil = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
                
                const payment = new Payment({
                    bookingId,
                    patientId: booking.patientId,
                    nurseId: booking.nurseId,
                    amount,
                    serviceFee,
                    momoRef: transactionId,
                    status: 'Held',
                    heldUntil
                });
                await payment.save();

                booking.status = 'Completed'; // Medical service done
                await booking.save();
                console.log(`[MoMo Webhook] Payment ${payment._id} held until ${heldUntil}`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};

// @desc    Simulate Cron Job to release held payments
// @route   POST /api/payments/release-holds
// @access  Private (Admin only)
exports.releaseHeldPayments = async (req, res) => {
    try {
        const now = new Date();
        const paymentsToRelease = await Payment.find({ status: 'Held', heldUntil: { $lte: now } });
        
        let releasedCount = 0;
        for (let payment of paymentsToRelease) {
            payment.status = 'Disbursed';
            await payment.save();
            // In reality, this triggers MoMo disbursement to Nurse wallet
            console.log(`[MoMo API] Disbursed GHS ${payment.amount - payment.serviceFee} to Nurse ${payment.nurseId}`);
            releasedCount++;
        }
        
        res.json({ message: `Released ${releasedCount} payments` });
    } catch (error) {
        res.status(500).json({ message: 'Release failed', error: error.message });
    }
};
