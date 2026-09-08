const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Nurse = require('../models/Nurse');
const Admin = require('../models/Admin');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mclanorjeff_db_user:YlpWleWEYVGmKDbJ@prn-nurse-db.gesn8uo.mongodb.net/prvnurse?appName=prn-nurse-db';

const cleanup = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected.');

        // Find users without firebaseUid or where it is null/undefined
        const legacyUsers = await User.find({
            $or: [
                { firebaseUid: { $exists: false } },
                { firebaseUid: null }
            ]
        });

        console.log(`Found ${legacyUsers.length} legacy users without firebaseUid. Proceeding to delete...`);

        for (const user of legacyUsers) {
            console.log(`Deleting user: ${user.email} (Role: ${user.role})`);
            
            // Delete associated profiles
            if (user.role === 'nurse') {
                await Nurse.deleteOne({ userId: user._id });
            } else if (user.role === 'patient') {
                await Patient.deleteOne({ userId: user._id });
            } else if (user.role === 'admin') {
                await Admin.deleteOne({ userId: user._id });
            }

            // Delete the user
            await User.deleteOne({ _id: user._id });
        }

        console.log('Cleanup completed successfully.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        mongoose.connection.close();
    }
};

cleanup();
