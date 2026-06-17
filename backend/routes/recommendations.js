const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getRecommendations } = require('../controllers/recommendationController');

// Patient endpoint to get list of matches
router.post('/', protect(['patient']), getRecommendations);

module.exports = router;
