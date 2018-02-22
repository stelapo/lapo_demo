var nodemailer = require('nodemailer');

let transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  //port: 587,
  auth: {
    user: 'aaa.bbbb@ccc.it',
    pass: ''
  }
});

let mailOptions = {
  from: 'user-alias <aaa.bbbb@ccc.it>', // sender address
  to: '', // list of receivers
  subject: 'Hello ✔ 2', // Subject line
  text: 'Hello world ?', // plain text body
  html: '<b>Hello world ?</b>' // html body
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log(error);
  }
  console.log('Message %s sent: %s', info.messageId, info.response);
});