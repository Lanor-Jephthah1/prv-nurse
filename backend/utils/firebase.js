const admin = require('firebase-admin');
const path = require('path');

const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;

if (credentialsPath) {
    try {
        const serviceAccount = require(path.resolve(process.cwd(), credentialsPath));
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin SDK:', error.message);
        console.log('Running Firebase in fallback/mock mode.');
    }
} else {
    console.log('FIREBASE_CREDENTIALS_PATH not defined. Running Firebase in mock mode.');
}

/**
 * Sends a push notification to a device token.
 * Falls back to console log if Firebase is not initialized.
 */
const sendPushNotification = async (token, title, body, data = {}) => {
    // If not initialized, mock it
    if (admin.apps.length === 0) {
        console.log(`[Mock Notification] To: ${token} | Title: ${title} | Body: ${body}`);
        return { success: true, messageId: 'mock-msg-id-' + Date.now() };
    }

    try {
        const message = {
            notification: { title, body },
            data: data,
            token: token
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('Error sending push notification via Firebase:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendPushNotification };
