import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendInviteEmail = async (to, inviteLink, companyName, role) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

      const mailOptions = {
      from: '"Your App" <no-reply@yourapp.com>',
      to,
      subject: `Invitation to join ${companyName} as ${role}`,
      html: `
        <p>You have been invited to join ${companyName} as a ${role}.</p>
        <p>Please click the link below to accept the invitation:</p>
        <a href="${inviteLink}">${inviteLink}</a>
        <p>This link will expire on ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString()}.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Invite email sent to:', to, 'with link:', inviteLink);
    return true;
  } catch (error) {
    console.error('Error sending invite email:', error);
    return false;
  }
};

export { sendInviteEmail };