import 'dotenv/config';
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
  console.error('SMTP is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
});

try {
  await transporter.verify();
  console.info(`SMTP connection and authentication succeeded (${SMTP_HOST}).`);
} catch (error) {
  console.error(`SMTP check failed (${error.code || 'connection error'}): ${error.message}`);
  process.exitCode = 1;
} finally {
  transporter.close();
}