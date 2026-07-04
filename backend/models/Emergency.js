const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    nurseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nurse' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    description: { type: String },
    status: { 
        type: String, 
        enum: ['Active', 'Assigned', 'Escalated to Services', 'Resolved'], 
        default: 'Active' 
    },
    resolutionNotes: { type: String }
}, { timestamps: true });

emergencySchema.index({ location: '2dsphere' });
emergencySchema.index({ status: 1 });
emergencySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Emergency', emergencySchema);
