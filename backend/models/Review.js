const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  nurseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nurse', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  
  // Sentence-by-sentence / Category-by-category feedback
  feedback: [{
      category: { type: String, required: true }, // e.g., 'Punctuality', 'Professionalism'
      text: { type: String, required: true },
      sentimentScore: { type: Number } // The individual score for this category
  }],
  
  // Final calculated or user-provided rating
  rating: { type: Number, required: true, min: 1, max: 5 },
  overallSentimentScore: { type: Number, default: 0 },
  tags: [{ type: String }],
  
  status: { type: String, enum: ['Published', 'Flagged'], default: 'Published' },
  
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure one review per booking
reviewSchema.index({ bookingId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
