const mongoose = require('mongoose');

let cachedConnection = null;

module.exports = async (req, res, next) => {
    try {
        if (mongoose.connection.readyState === 1) {
            return next();
        }

        if (!cachedConnection) {
            console.log('Connecting to MongoDB (Serverless)...');
            cachedConnection = mongoose.connect(process.env.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000 // fail fast if connection fails
            });
        }

        await cachedConnection;
        next();
    } catch (err) {
        console.error('Database connection error in middleware:', err);
        cachedConnection = null; // Clear cache on error so we retry next time
        res.status(500).json({ message: 'Database connection failed', error: err.message });
    }
};
