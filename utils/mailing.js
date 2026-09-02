const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.email,
    pass: process.env.email_password,
  },
});

let sendMailasync = async (email, subject, html) => {
  const info = await transporter.sendMail({
    from: process.env.email,
    to: email,
    subject: subject,
    html: html,
  });
  console.log("Message sent:", info.messageId);
};
module.exports = sendMailasync;
