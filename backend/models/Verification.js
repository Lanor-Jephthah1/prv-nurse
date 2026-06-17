const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  nurseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nurse', required: true },
  docUrls: {
    license: { type: String, required: true },
    idCard: { type: String, required: true }
  },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  adminNotes: { type: String },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Verification', verificationSchema);
