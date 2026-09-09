const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Nurse = require('../models/Nurse');
const { processReviewAsync } = require('../events/reviewPipeline');

// @desc    Submit a review for a completed booking (Asynchronous Decoupled)
// @route   POST /api/reviews
// @access  Private (Patient only)
exports.createReview = async (req, res) => {
    try {
        let { bookingId, feedbackArray, rating } = req.body;

        // Support direct fields if frontend sends them outside feedbackArray
        let feedback = feedbackArray;
        if (!feedback || !Array.isArray(feedback)) {
            const categories = [
                { key: 'punctuality', name: 'Punctuality' },
                { key: 'professionalism', name: 'Professionalism' },
                { key: 'compassion', name: 'Compassion' },
                { key: 'communication', name: 'Communication' },
                { key: 'clinicalSkills', name: 'Clinical Skills' },
                { key: 'clinical_skills', name: 'Clinical Skills' }
            ];
            
            const constructed = [];
            categories.forEach(cat => {
                if (req.body[cat.key] && typeof req.body[cat.key] === 'string' && req.body[cat.key].trim()) {
                    constructed.push({ category: cat.name, text: req.body[cat.key].trim() });
                }
            });

            if (constructed.length > 0) {
                feedback = constructed;
            }
        }

        if (!bookingId || !feedback || !Array.isArray(feedback) || feedback.length === 0) {
            return res.status(400).json({ message: 'Booking ID and feedback (either feedbackArray or fields like punctuality, professionalism, compassion, communication, clinicalSkills) are required.' });
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

        // 14-Day Review Window Restriction
        const completionDate = booking.updatedAt;
        const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
        if (Date.now() - new Date(completionDate).getTime() > fourteenDaysInMs) {
            return res.status(403).json({ message: 'The 14-day review window for this booking has expired. Reviews must be submitted within 14 days of completion to prevent retrospective tampering.' });
        }

        if (booking.hasReviewed) {
            return res.status(400).json({ message: 'You have already reviewed this visit.' });
        }

        // 1. Create initial review record immediately (status: 'Processing')
        const review = await Review.create({
            bookingId,
            patientId: req.user.profileId,
            nurseId: booking.nurseId,
            feedback: feedback.map(f => ({ category: f.category, text: f.text, sentimentScore: 0 })),
            rating: rating || 0,
            status: 'Processing'
        });

        // 2. Mark booking as reviewed immediately so user cannot double-submit
        booking.hasReviewed = true;
        await booking.save();

        // 3. Trigger Decoupled Background Event Pipeline (AI analysis & Nurse ranking)
        // Fire-and-forget: Runs asynchronously without blocking the patient HTTP response!
        processReviewAsync({
            reviewId: review._id,
            nurseId: booking.nurseId,
            bookingId,
            feedback,
            explicitRating: rating,
            io: req.io
        });

        // 4. Return instant 202 Accepted response (<20ms latency)
        res.status(202).json({
            success: true,
            message: 'Review submitted successfully! AI analysis is being processed in the background.',
            status: 'Processing',
            reviewId: review._id
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You have already reviewed this visit.' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get status of an asynchronous processing review
// @route   GET /api/reviews/status/:id
// @access  Private (Patient, Nurse, Admin)
exports.getReviewStatus = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .select('status rating tags overallSentimentScore createdAt');
        if (!review) return res.status(404).json({ message: 'Review not found' });
        res.json(review);
    } catch (error) {
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
