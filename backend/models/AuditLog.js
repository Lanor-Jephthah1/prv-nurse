const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, enum: ['Nurse', 'Patient', 'Booking', 'Incident', 'Payment', 'System'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: Object }
}, { timestamps: true });

auditLogSchema.index({ adminId: 1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
