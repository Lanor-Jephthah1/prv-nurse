const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    type: { 
        type: String, 
        enum: ['Complaint', 'Safety', 'Dispute'], 
        required: true 
    },
    description: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Open', 'Under Review', 'Escalated', 'Resolved', 'Closed'], 
        default: 'Open' 
    },
    resolutionNotes: { type: String }
}, { timestamps: true });

incidentSchema.index({ status: 1 });
incidentSchema.index({ type: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
