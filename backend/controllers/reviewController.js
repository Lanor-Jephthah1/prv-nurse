const Review = require('../models/Review');
const Nurse = require('../models/Nurse');
const Booking = require('../models/Booking');

// @desc    Submit a review for a nurse
// @route   POST /api/reviews
// @access  Private (Patient only)
exports.createReview = async (req, res) => {
    try {
        const { nurseId, bookingId, rating, comment } = req.body;

        // Ensure booking belongs to patient and is completed
        const booking = await Booking.findOne({ _id: bookingId, patientId: req.user.id });
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        if (booking.status !== 'Completed') {
            return res.status(400).json({ message: 'You can only review completed visits' });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({ bookingId });
        if (existingReview) {
            return res.status(400).json({ message: 'Review already submitted for this booking' });
        }

        // Create review
        const review = await Review.create({
            nurseId,
            patientId: req.user.id,
            bookingId,
            rating,
            comment
        });

        // Update nurse average rating
        const reviews = await Review.find({ nurseId });
        const numReviews = reviews.length;
        const avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / numReviews;

        await Nurse.findByIdAndUpdate(nurseId, {
            ratings: {
                averageRating: avgRating,
                totalReviews: numReviews
            }
        });

        res.status(201).json(review);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all reviews for a specific nurse
// @route   GET /api/reviews/nurse/:nurseId
// @access  Public
exports.getNurseReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ nurseId: req.params.nurseId })
            .populate('patientId', 'fullName')
            .sort({ createdAt: -1 });
            
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
