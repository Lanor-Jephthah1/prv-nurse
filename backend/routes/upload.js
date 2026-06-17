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
// @desc    Get secure signed URL for S3 document (Mock)
// @route   GET /api/upload/signed-url/:filename
// @access  Private (Nurse/Admin)
router.get('/signed-url/:filename', protect(['admin', 'nurse']), (req, res) => {
    const { filename } = req.params;
    
    // Simulate AWS signature generation
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret')
                            .update(`${filename}-${Date.now()}`)
                            .digest('hex');
                            
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    
    const signedUrl = `https://prv-nurse-bucket.s3.amazonaws.com/credentials/${filename}?expires=${expiresAt.getTime()}&signature=${signature}`;
    
    console.log(`[AWS S3 Mock] Generated signed URL for ${filename} requested by ${req.user.role}`);
    
    res.json({
        signedUrl,
        expiresAt
    });
});

module.exports = router;
