const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// @desc    Mock credential document upload endpoint (S3 Mock)
// @route   POST /api/upload
// @access  Private (Nurse only)
router.post('/', protect(['nurse']), (req, res) => {
    const { type } = req.query;
    
    // By default, return a valid placeholder image URL so frontend <img> tags don't break
    let mockFilename = `photo-${Date.now()}.jpg`;
    let mockUrl = `https://ui-avatars.com/api/?name=Nurse&background=random&size=200`;
    
    // If explicitly requesting a document type
    if (type === 'document' || type === 'pdf') {
        mockFilename = `doc-${Date.now()}.pdf`;
        mockUrl = `https://prv-nurse-bucket.s3.amazonaws.com/credentials/${mockFilename}`;
    }
    
    console.log(`[AWS S3 Mock] Uploading file for nurse ${req.user.id}, returning mock URL`);
    
    res.status(201).json({
        message: 'File uploaded successfully (Mock)',
        fileName: mockFilename,
        fileUrl: mockUrl
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
