'use strict';

/**
 * Module Dependencies
 */

const User = require('../models/User');
const config = require('../config/config');
const utils = require('../config/utils');
const passportConf = require('../config/passport');
const debug = require('debug')('lapo_demo');
//const nodemailer = require('nodemailer');
const knexdb = require('../config/knexdb');

/**
 * Admin Pages Controller
 */

module.exports.controller = function(app) {

  /**
   * GET /dashboard
   * Render Dashboard Page
   */

  app.get('/dashboard', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    User.count({}, function(err, count) {
      if (err) {
        return (err, null);
      }
      res.render('admin/dashboard', {
        url: '/administration', // to set navbar active state
        accounts: count
      });
    });
  });

  /**
   * GET /accounts
   * Render accounts page
   */

  app.get('/accounts', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    knexdb.testInsert('GET /accounts');
    res.render('admin/accounts', {
      url: '/administration', // to set navbar active state
      token: res.locals.token
    });
  });

  /**
   * GET /accountlist
   * JSON accounts api
   */

  app.get('/accountlist', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    User.find({}, function(err, items) {
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

  app.get('/newaccount', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    res.render('admin/newaccount');
  });


  /**
   * POST /newaccount
   * Create new account with admin privilege
   */

  app.post('/newaccount', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    manageAccount(req, res, 'new');
  });


  /**
   * GET /modaccount
   * Render admin page for modify account
   */

  app.get('/modaccount/:id', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    var query = User.findOne({
      _id: req.params.id
    });

    query.exec(function(err, user) {
      if (err) {
        req.flash('error', err);
        res.render('admin/accounts');
      }
      //debug(user);
      res.render('admin/newaccount', {
        userM: user
      });
    });

  });

  /**
   * POST /modaccount
   * Modify account with admin privilege
   */

  app.post('/modaccount', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    manageAccount(req, res, 'mod');
  });

  function manageAccount(req, res, typ) {
    let hasPassword = (typ === 'new' || req.body.password || req.body.confirmPassword);

    // Create a workflow (here you could also use the async waterfall pattern)
    var workflow = new(require('events').EventEmitter)();

    /**
     * Step 1: Validate the form data
     */

    workflow.on('validate', function() {
      //debug('Validating....');

      req.assert('name', 'Name cannot be empty.').notEmpty();
      req.assert('surname', 'Surname cannot be empty.').notEmpty();
      if (typ === 'new') {
        req.assert('email', 'Email cannot be empty.').notEmpty();
        req.assert('email', 'Email is not valid.').isEmail();
      }
      if (hasPassword) {
        req.assert('password', 'Password cannot be empty.').notEmpty();
        req.assert('confirmPassword', 'Password confirmation cannot be empty.').notEmpty();
        req.assert('password', 'Password must be at least 4 characters long.').len(4);
        req.assert('confirmPassword', 'Passwords do not match.').equals(req.body.password);
      }
      if (typ === 'mod') {
        req.assert('id', 'Id cannot be empty.').notEmpty();
      }

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

    workflow.on('createUser', function() {

      // create user
      var user = new User({
        'profile.name': req.body.name.trim(),
        'profile.surname': req.body.surname.trim(),
        email: ((req.body.email) ? req.body.email.toLowerCase() : req.body.emailAccount),
        password: req.body.password,
        verifyToken: null,
        verified: true,
        type: ((req.body.admin) ? "admin" : "user")
      });

      if (typ === 'new') {
        // save user
        user.save(function(err) {
          if (err) {
            if (err.code === 11000) {
              req.flash('error', {
                msg: 'An account with that email address already exists!'
              });
              req.flash('info', {
                msg: 'You should sign in with that account.'
              });
            }
            return res.redirect('back');
          } else {
            // next step (4)
            workflow.emit('sendWelcomeEmail', user);
          }
        });
      } else {
        let updateData = {
          profile: {
            name: user.profile.name,
            surname: user.profile.surname
          }
        };

        if (hasPassword) {
          updateData.password = user.password;
        }

        User.update({
            _id: req.body.id
          }, updateData, {
            upsert: true
          },
          function(err) {
            if (err) {
              debug(err);
              req.flash('error', {
                msg: err
              });
              return res.redirect('back');
            } else {
              // next step (4)
              workflow.emit('sendWelcomeEmail', user);
            }
          });
      }
    });


    /**
     * Step 3: Send them a welcome email
     */

    workflow.on('sendWelcomeEmail', function(user) {

      // Create reusable transporter object using SMTP transport
      let transporter = utils.getEmailTransporter();

      // Render HTML to send using .jade mail template (just like rendering a page)
      res.render('mail/welcome', {
        typ: typ,
        name: user.profile.name,
        mailtoName: config.smtp.name,
        mailtoAddress: config.smtp.address,
        blogLink: req.protocol + '://' + req.headers.host, // + '/blog',
        forumLink: req.protocol + '://' + req.headers.host // + '/forum'
      }, function(err, html) {
        if (err) {
          return (err, null);
        } else {

          // Now create email text (multiline string as array FTW)
          let text;
          if (typ === 'new') {
            text = 'We would like to welcome you as our newest member!';
          } else {
            text = 'We would like to inform you that your data were updated from our administration team!';

          }
          text = [
            'Hello ' + user.profile.name + '!',
            text,
            'Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at ' + config.smtp.address + '.',
            'If you want to get the latest scoop check out our <a href="' +
            req.protocol + '://' + req.headers.host + '/blog' +
            '">blog</a> and our <a href="' +
            req.protocol + '://' + req.headers.host + '/forums">forums</a>.',
            '  - The ' + config.smtp.name + ' team'
          ].join('\n\n');

          // Create email
          let subject;
          if (typ === 'new') {
            subject = 'Welcome to ' + app.locals.application + '!';
          } else {
            subject = 'Your ' + app.locals.application + ' profile was updated';
          }
          var mailOptions = utils.getEmailOptions(user, subject, text, html);

          // Send email
          transporter.sendMail(mailOptions, function(err, info) {
            if (err) {
              req.flash('error', {
                msg: JSON.stringify(err)
              });
              debug(JSON.stringify(err));
            } else {
              debug('Message response: ' + info.response);
            }
          });

        }
      });

      // next step
      if (typ === 'new') {
        req.flash('info', {
          msg: 'Account ' + user.email + ' successfully created!'
        });
      } else {
        // next step
        req.flash('info', {
          msg: 'Account ' + user.email + ' successfully updated!'
        });
      }

      res.redirect('/accounts');

    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');
  }


  /**
   * DEL /accountlist/:id
   * JSON accounts delete api
   */

  app.delete('/accountlist/:id', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    /*User.remove({ _id : req.params.id }, function (err, result) {
      debug('Delete result:');
      debug(result);
      res.send((result.n === 1 && result.ok === 1) ? { msg: '' } : { msg: 'error: ' + err });
    });*/
    if (req.user._id.toString() !== req.params.id) {
      User.findOneAndRemove({
          _id: req.params.id,
          $or: [{
              superadmin: {
                $exists: false
              }
            },
            {
              superadmin: false
            }
          ]
        })
        .exec(function(err, item) {
          var errMsg = '';
          if (err) {
            errMsg = 'Cannot remove user';
          }
          if (!item) {
            errMsg = 'User not found';
          }
          res.send({
            msg: errMsg
          });
        });
    } else {
      res.send({
        msg: 'Cannot remove your user'
      });
    }
  });

  /**
   * GET /dashboard
   * Render Dashboard Page
   */

  app.get('/colors', passportConf.isAuthenticated, passportConf.isAdministrator, function(req, res) {
    res.render('admin/colors', {
      url: '/administration' // to set navbar active state
    });
  });

};