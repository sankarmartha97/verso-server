// Nodemailer transport pointed at the local dev SMTP (Mailhog) by default.
// Real SMTP providers reject mail from a domain you haven't verified with
// them -- 'verso.local' isn't a real domain, so it only works against
// Mailhog. MAIL_FROM overrides it once there's a real sender to use (e.g.
// Resend's no-verification-needed onboarding@resend.dev for a quick start,
// or your own domain after verifying it with your SMTP provider).
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport(process.env.SMTP_URL);
const FROM = process.env.MAIL_FROM || 'Verso <no-reply@verso.local>';

async function sendMail({ to, subject, html }) {
  await transport.sendMail({ from: FROM, to, subject, html });
}

module.exports = { sendMail };
