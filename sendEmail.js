'use strict'

var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: '', //config.mail.user,
    pass: '' //config.mail.password
  }
});

// Now create email text (multiline string as array FTW)
var text = [
  'Hello!',
  'This is a courtesy message to confirm that your profile information was just updated.',
  'Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at .....',
  '  - The team'
].join('\n\n');

// Create email
var mailOptions = {
  to: 'name <a.b@pippo.com>',
  from: ' <pippo@gmail.com>',
  subject: 'Your profile was updated',
  text: text //,
  //html: html
};

// verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.log(error);
  } else {
    console.log('Server is ready to take our messages');
    // Send email
    transporter.sendMail(mailOptions, function(err, info) {
      if (err) {
        console.log(JSON.stringify(err));
      } else {
        console.log('Message response: ' + info.response);
      }
    });
  }
});