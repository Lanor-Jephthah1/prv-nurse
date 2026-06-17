const express = require('express');
const router = express.Router();
const { createReview, getNurseReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect(['patient']), createReview);
router.get('/nurse/:nurseId', getNurseReviews);

module.exports = router;
