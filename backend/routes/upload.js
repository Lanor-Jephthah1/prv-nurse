const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// @desc    Mock credential document upload endpoint (S3 Mock)
// @route   POST /api/upload
// @access  Private (Nurse only)
router.post('/', protect(['nurse']), (req, res) => {
    // Generate a mock S3 url
    const mockFilename = `doc-${Date.now()}.pdf`;
    const mockS3Url = `https://prv-nurse-bucket.s3.amazonaws.com/credentials/${mockFilename}`;
    
    console.log(`[AWS S3 Mock] Uploading credentials file for nurse ${req.user.id}`);
    
    res.status(201).json({
        message: 'File uploaded successfully (Mock S3)',
        fileName: mockFilename,
        fileUrl: mockS3Url
    });
});

module.exports = router;
