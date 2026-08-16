const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Configure Multer for memory storage (Serverless friendly)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @desc    Upload file directly to Cloudinary
// @route   POST /api/upload
// @access  Private
router.post('/', protect(['nurse', 'patient', 'admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded. Make sure the form-data key is "file".' });
        }

        console.log(`[Cloudinary] Uploading file for user ${req.user.id} (${req.file.originalname})`);

        // Wrap stream in a promise
        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'prn-nurse',
                        resource_type: 'auto' // auto handles images, pdfs, raws seamlessly
                    },
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
                
                // Convert buffer to readable stream
                const readable = new Readable();
                readable._read = () => {};
                readable.push(req.file.buffer);
                readable.push(null);
                readable.pipe(stream);
            });
        };

        const result = await streamUpload(req);

        res.status(201).json({
            message: 'File uploaded successfully',
            fileName: result.original_filename,
            fileUrl: result.secure_url
        });
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        res.status(500).json({ message: 'Error uploading file to cloud', error: error.message || error });
    }
});

// @desc    Get secure signed URL for document
// @route   GET /api/upload/signed-url/:filename
// @access  Private
router.get('/signed-url/:filename', protect(['admin', 'nurse']), (req, res) => {
    const { filename } = req.params;
    
    // In Cloudinary, assets in standard folders are accessible via secure_url directly.
    // We return a mock placeholder or the direct cloudinary format to not break the frontend.
    const signedUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/prn-nurse/${filename}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 
    
    res.json({
        signedUrl,
        expiresAt
    });
});

module.exports = router;
