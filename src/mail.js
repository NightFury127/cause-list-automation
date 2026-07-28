import nodemailer from 'nodemailer';

function createTransporter({ gmailUser, gmailAppPassword }) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });
}

/**
 * Sends the generated PDF via Gmail.
 *
 * @param {object} options - Mail options.
 * @param {string} options.gmailUser - Gmail sender address.
 * @param {string} options.gmailAppPassword - Gmail App Password.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Message subject.
 * @param {string} options.text - Message body.
 * @param {string} options.attachmentPath - PDF attachment path.
 * @param {object} [options.logger] - Logger instance.
 * @returns {Promise<void>}
 */
export async function sendMail({
  gmailUser,
  gmailAppPassword,
  to,
  subject,
  text,
  attachmentPath,
  logger
}) {
  const transporter = createTransporter({ gmailUser, gmailAppPassword });

  await transporter.verify();

  await transporter.sendMail({
    from: gmailUser,
    to,
    subject,
    text,
    attachments: [
      {
        filename: attachmentPath.split(/[\\/]/).pop(),
        path: attachmentPath
      }
    ]
  });

  logger?.info('Email sent', { to, subject });
}