const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    nurseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nurse', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    status: { 
        type: String, 
        enum: ['Requested', 'Accepted', 'In Progress', 'Completed', 'Cancelled', 'Disputed'],
        default: 'Requested'
    },
    
    // The specific details of the care request
    careDetails: {
        typeOfCare: String,
        specificTasks: [String],
        medicalNotes: String
    },
    
    // Timing
    schedule: {
        startDate: { type: Date, required: true },
        duration: { type: Number }, // in hours or days depending on type
        timeSlots: [String] // e.g. Morning, Afternoon
    },
    
    // Visit Documentation
    visitNotes: [{
        date: { type: Date, default: Date.now },
        vitals: {
            bloodPressure: String,
            temperature: Number,
            pulseRate: Number,
            spo2: Number
        },
        medicationsAdministered: [String],
        observations: String,
        concernsFlagged: Boolean
    }],
    
    // Pricing attached at time of booking
    agreedRate: { type: Number, required: true },
    totalAmount: { type: Number, required: true }

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
