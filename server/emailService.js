const nodemailer = require('nodemailer');

require('dotenv').config();

const createTransporter = async () => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        return transporter;
    } catch (error) {
        console.error("Error creating transporter:", error);
        throw error;
    }
};

const buildFromHeader = (fromName) => {
    if (!fromName || !String(fromName).trim()) return process.env.EMAIL_USER;
    const safeName = String(fromName).replace(/"/g, '').trim();
    return `"${safeName}" <${process.env.EMAIL_USER}>`;
};

const sendEmail = async (to, subject, html, fromName = '') => {
    try {
        const transporter = await createTransporter();

        const mailOptions = {
            from: buildFromHeader(fromName),
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: ", info.response);
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};

module.exports = { sendEmail };
