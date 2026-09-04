const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', err.message);
    }
} else {
    try {
        serviceAccount = require('../firebaseServiceAccountKey.json');
    } catch (err) {
        console.warn('firebaseServiceAccountKey.json not found locally:', err.message);
    }
}

if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully');
} else if (!serviceAccount) {
    console.warn('Firebase Admin running in mock/uninitialized mode (missing credentials)');
}

module.exports = admin;
