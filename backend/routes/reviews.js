const express = require('express');
const router = express.Router();
const { createReview, getNurseReviews, getReviewStatus } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect(['patient']), createReview);
router.get('/status/:id', protect(['patient', 'nurse', 'admin']), getReviewStatus);
router.get('/nurse/:nurseId', getNurseReviews);

module.exports = router;
