const nodemailer = require("nodemailer");
const twilio = require("twilio");

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail', // Defaulting to gmail, adjust if using different SMTP provider
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Reusable function to send messages via Email or SMS.
 * @param {string} contact - The destination phone number or email address.
 * @param {string} message - The message content.
 * @param {string} subject - The subject for email messages (default: "FONEST Notification").
 */
exports.sendMessage = async (contact, message, subject = "FONEST Notification") => {
    const isEmail = contact.includes("@");
    
    if (isEmail) {
        // Send Email using Nodemailer
        try {
            const transporter = createTransporter();
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: contact,
                subject: subject,
                text: message
            };
            
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email successfully sent to ${contact}`);
        } catch (error) {
            console.error(`❌ Failed to send email to ${contact}:`, error.message);
            throw new Error("Could not send email. Please check your email configuration.");
        }
    } else {
        // Send SMS using Twilio
        try {
            // Ensure phone number has country code for Twilio's E.164 format
            let formattedPhone = contact;
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = `+91${formattedPhone}`;
            }

            await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formattedPhone
            });
            console.log(`✅ SMS successfully sent to ${formattedPhone}`);
        } catch (error) {
            console.error(`❌ Failed to send SMS to ${contact}:`, error);
            throw new Error("Could not send SMS. Please check your Twilio configuration.");
        }
    }
};
