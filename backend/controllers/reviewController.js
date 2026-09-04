const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Nurse = require('../models/Nurse');
const { analyzeFeedback } = require('../utils/sentimentAnalyzer');

// @desc    Submit a review for a completed booking
// @route   POST /api/reviews
// @access  Private (Patient only)
exports.createReview = async (req, res) => {
    try {
        const { bookingId, feedbackArray, rating } = req.body;

        if (!bookingId || !feedbackArray || !Array.isArray(feedbackArray)) {
            return res.status(400).json({ message: 'Booking ID and feedback array are required.' });
        }

        // Verify the booking
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
        if (booking.patientId.toString() !== req.user.profileId) {
            return res.status(403).json({ message: 'Not authorized to review this booking.' });
        }
        if (booking.status !== 'Completed') {
            return res.status(400).json({ message: 'You can only review completed visits.' });
        }
        if (booking.hasReviewed) {
            return res.status(400).json({ message: 'You have already reviewed this visit.' });
        }

        // Perform Standard Model Sentiment Analysis on each sentence/category!
        const analysis = analyzeFeedback(feedbackArray);
        
        // Decide final rating
        const finalRating = rating ? rating : analysis.rating;

        // Create the review
        const review = await Review.create({
            bookingId,
            patientId: req.user.profileId, // We store this internally, but never expose it
            nurseId: booking.nurseId,
            feedback: analysis.feedbackDetails,
            rating: finalRating,
            overallSentimentScore: analysis.overallScore,
            tags: analysis.tags,
            status: analysis.status
        });

        // Mark booking as reviewed
        booking.hasReviewed = true;
        await booking.save();

        // Update Nurse's overall stats
        const nurse = await Nurse.findById(booking.nurseId);
        if (nurse) {
            const currentTotal = nurse.ratings.totalReviews || 0;
            const currentAverage = nurse.ratings.averageRating || 0;
            
            const newTotal = currentTotal + 1;
            const newAverage = ((currentAverage * currentTotal) + finalRating) / newTotal;
            
            nurse.ratings.totalReviews = newTotal;
            nurse.ratings.averageRating = Number(newAverage.toFixed(1));

            // Add extracted tags to nurse's skills list
            if (analysis.tags && analysis.tags.length > 0) {
                const uniqueTags = new Set([...(nurse.skills || []), ...analysis.tags]);
                nurse.skills = Array.from(uniqueTags);
            }

            await nurse.save();
        }

        res.status(201).json({
            message: analysis.status === 'Flagged' 
                ? 'Review submitted. It has been flagged for admin review.' 
                : 'Review submitted successfully! Your feedback is completely anonymous.',
            review
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You have already reviewed this visit.' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all reviews for a specific nurse (ANONYMIZED & THRESHOLD MASKED)
// @route   GET /api/nurses/:nurseId/reviews
// @access  Public
exports.getNurseReviews = async (req, res) => {
    try {
        const nurseId = req.params.nurseId;
        
        // 1. Check if the nurse has enough reviews (The "Small N" privacy solution)
        const nurse = await Nurse.findById(nurseId);
        if (!nurse) return res.status(404).json({ message: 'Nurse not found' });

        const THRESHOLD = 3;
        if (nurse.ratings.totalReviews < THRESHOLD) {
            // Return empty array with a special message if below threshold to protect patient identity
            return res.json({
                hidden: true,
                message: `Reviews are hidden until this nurse receives at least ${THRESHOLD} reviews to protect patient anonymity.`,
                reviews: []
            });
        }

        // 2. Fetch reviews BUT DO NOT populate 'patientId'. Keep it totally anonymous.
        // We only return the feedback content, ratings, and tags.
        const reviews = await Review.find({ nurseId, status: 'Published' })
            .select('-patientId -bookingId') // Explicitly hide identifying IDs
            .sort({ createdAt: -1 });

        res.json({
            hidden: false,
            message: 'Anonymized reviews fetched successfully',
            reviews
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
