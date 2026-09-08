require('dotenv').config({ path: './backend/.env.local' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Admin = require('../models/Admin');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('MONGO_URI environment variable is not defined.');
    process.exit(1);
}

const createAdmin = async () => {
    // Pass email as an argument: node createAdmin.js <email>
    const emailArg = process.argv[2];

    if (!emailArg) {
        console.error('Please provide an email. Usage: node createAdmin.js <email>');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected.');

        const email = emailArg.toLowerCase();
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email ${email} not found in database. Ensure they have registered first.`);
            process.exit(1);
        }

        if (user.role === 'admin') {
            console.log(`User ${email} is already an admin.`);
            process.exit(0);
        }

        // Update role
        user.role = 'admin';
        await user.save();

        // Create Admin profile if it doesn't exist
        const adminProfileExists = await Admin.findOne({ userId: user._id });
        if (!adminProfileExists) {
            const newAdmin = new Admin({
                userId: user._id,
                fullName: email.split('@')[0], // placeholder name
                email: email
            });
            await newAdmin.save();
        }

        console.log(`Successfully elevated ${email} to admin.`);
    } catch (error) {
        console.error('Error promoting admin:', error);
    } finally {
        mongoose.connection.close();
    }
};

createAdmin();
