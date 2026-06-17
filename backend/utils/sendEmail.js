// Simulated email sender for development
const sendEmail = async (options) => {
    console.log('====================================');
    console.log('📧 MOCK EMAIL SENT 📧');
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
    console.log('====================================');
    return true;
};

module.exports = sendEmail;
