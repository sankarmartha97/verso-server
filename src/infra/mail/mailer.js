// Nodemailer transport pointed at the local dev SMTP (Mailhog).
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport(process.env.SMTP_URL);

async function sendMail({ to, subject, html }) {
  await transport.sendMail({ from: 'Verso <no-reply@verso.local>', to, subject, html });
}

module.exports = { sendMail };
