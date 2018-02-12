'use strict';

/**
 * Module Dependencies
 */

const User          = require('../models/User');
const config        = require('../config/config');
const passportConf  = require('../config/passport');
const debug         = require('debug')('lapo_demo');
const nodemailer    = require('nodemailer');

/**
 * Admin Pages Controller
 */

module.exports.controller = function (app) {

  /**
   * GET /dashboard
   * Render Dashboard Page
   */

  app.get('/dashboard', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {
    User.count({}, function (err, count) {
      if (err) {
        return (err, null);
      }
      res.render('admin/dashboard', {
        url: '/administration',  // to set navbar active state
        accounts: count
      });
    });
  });

  /**
   * GET /accounts
   * Render accounts page
   */

  app.get('/accounts', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {
    res.render('admin/accounts', {
      url: '/administration', // to set navbar active state
      token: res.locals.token
    });
  });

  /**
   * GET /accountlist
   * JSON accounts api
   */

  app.get('/accountlist', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {
    User.find({}, function (err, items) {
      if (err) {
        return (err, null);
      }
      res.json(items);
    });
  });


  /**
   * GET /newaccount
   * Render admin page for new account
   */

  app.get('/newaccount', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {
    res.render('admin/newaccount');
  });


  /**
   * POST /newaccount
   * Create new account with admin privilege
   */

  app.post('/newaccount', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {

    // Create a workflow (here you could also use the async waterfall pattern)
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the form data
     */

    workflow.on('validate', function () {
      debug('Validating....');

      req.assert('name', 'Name cannot be empty.').notEmpty();
      req.assert('email', 'Email cannot be empty.').notEmpty();
      req.assert('email', 'Email is not valid.').isEmail();
      req.assert('password', 'Password cannot be empty.').notEmpty();
      req.assert('confirmPassword', 'Password confirmation cannot be empty.').notEmpty();
      req.assert('password', 'Password must be at least 4 characters long.').len(4);
      req.assert('confirmPassword', 'Passwords do not match.').equals(req.body.password);

      var errors = req.validationErrors();

      if (errors) {
        req.flash('error', errors);
        return res.redirect('back');
      }

      // next step
      workflow.emit('createUser');
    });

    /**
     * Step 2: Create a new account
     */

    workflow.on('createUser', function () {

      // create user
      var user = new User({
        'profile.name': req.body.name.trim(),
        email:          req.body.email.toLowerCase(),
        password:       req.body.password,
        verifyToken:    true,
        verified:       null
      });

      // save user
      user.save(function (err) {
        if (err) {
          if (err.code === 11000) {
            req.flash('error', { msg: 'An account with that email address already exists!' });
            req.flash('info', { msg: 'You should sign in with that account.' });
          }
          return res.redirect('back');
        } else {
            // next step (4)
            workflow.emit('sendWelcomeEmail', user);
        }
      });

    });


    /**
     * Step 3: Send them a welcome email
     */

    workflow.on('sendWelcomeEmail', function (user) {

      // Create reusable transporter object using SMTP transport
      var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
      });

      // Render HTML to send using .jade mail template (just like rendering a page)
      res.render('mail/welcome', {
        name:          user.profile.name,
        mailtoName:    config.smtp.name,
        mailtoAddress: config.smtp.address,
        blogLink:      req.protocol + '://' + req.headers.host, // + '/blog',
        forumLink:     req.protocol + '://' + req.headers.host  // + '/forum'
      }, function (err, html) {
        if (err) {
          return (err, null);
        }
        else {

          // Now create email text (multiline string as array FTW)
          var text = [
            'Hello ' + user.profile.name + '!',
            'We would like to welcome you as our newest member!',
            'Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at ' + config.smtp.address + '.',
            'If you want to get the latest scoop check out our <a href="' +
            req.protocol + '://' + req.headers.host + '/blog' +
            '">blog</a> and our <a href="' +
            req.protocol + '://' + req.headers.host + '/forums">forums</a>.',
            '  - The ' + config.smtp.name + ' team'
          ].join('\n\n');

          // Create email
          var mailOptions = {
            to:       user.profile.name + ' <' + user.email + '>',
            from:     config.smtp.name + ' <' + config.smtp.address + '>',
            subject:  'Welcome to ' + app.locals.application + '!',
            text:     text,
            html:     html
          };

          // Send email
          transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
              req.flash('error', { msg: JSON.stringify(err) });
              debug(JSON.stringify(err));
            } else {
              debug('Message response: ' + info.response);
            }
          });

        }
      });

      // next step
      req.flash('info', {msg: 'Account ' + user.email + ' successfully created!'});
      res.redirect('/accounts');
    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');

  });


  /**
   * DEL /accountlist/:id
   * JSON accounts delete api
   */

  app.delete('/accountlist/:id', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {
    /*User.remove({ _id : req.params.id }, function (err, result) {
      debug('Delete result:');
      debug(result);
      res.send((result.n === 1 && result.ok === 1) ? { msg: '' } : { msg: 'error: ' + err });
    });*/
    User.findOneAndRemove({ _id : req.params.id })
    .exec(function(err, item) {
        var errMsg = '';
        if (err) {
          errMsg = 'Cannot remove user';
        }
        if (!item) {
          errMsg = 'User not found';
        }
        res.send({ msg: errMsg });
    });
  });

  /**
   * GET /dashboard
   * Render Dashboard Page
   */

  app.get('/colors', passportConf.isAuthenticated, passportConf.isAdministrator, function (req, res) {
    res.render('admin/colors', {
      url: '/administration'  // to set navbar active state
    });
  });

};
