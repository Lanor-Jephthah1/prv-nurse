const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  nurseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nurse', required: true },
  amount: { type: Number, required: true },
  serviceFee: { type: Number, required: true },
  momoRef: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Held', 'Disbursed', 'Disputed', 'Failed'], default: 'Pending' },
  heldUntil: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
