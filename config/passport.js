'use strict';

/**
 * Module dependencies.
 */

const _ = require('lodash');
const User = require('../models/User');
const utils = require('./utils');
const config = require('./config');
const passport = require('passport');
const TotpStrategy = require('passport-totp').Strategy;
const LocalStrategy = require('passport-local').Strategy;
//const OAuthStrategy     = require('passport-oauth').OAuthStrategy;
//const OAuth2Strategy    = require('passport-oauth').OAuth2Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

/**
 * Serialize and Deserialize the User
 */

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

/**
 * Local authentication
 */

// Use the LocalStrategy within Passport.
//   Strategies in passport accept credentials (in this case, a username and password),
//   and invoke a callback with a user object.

passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
  User.findOne({ email: email }, function(err, user) {
    if(!user) {
      return done(null, false, { message: 'Invalid email or password.' });
    }

    // Only authenticate if the user is verified
    if(user.verified) {
      user.comparePassword(password, function(err, isMatch) {
        if(isMatch) {

          // update the user's record with login timestamp
          user.activity.last_logon = Date.now();
          user.save(function(err) {
            if(err) {
              return(err);
            }
          });

          return done(null, user);
        } else {
          return done(null, false, { message: 'Invalid email or password.' });
        }
      });
    } else {
      return done(null, false, { message: 'Your account must be verified first!' });
    }
  });
}));

// The TOTP authentication strategy authenticates a user using a TOTP value
// generated by a hardware device or software application (known as a token).
// The strategy requires a setup callback. The setup callback accepts a previously
// authenticated user and calls done providing a key and period used to verify
// the HOTP value. Authentication fails if the value is not verified.

passport.use(new TotpStrategy(function(user, done) {
  // setup function, supply key and period to done callback
  User.findById(user.id, function(err, user) {
    if(err) {
      return done(err);
    }
    if(!user) {
      return done(null, false, { message: 'User not found' });
    } else {
      return done(null, user.enhancedSecurity.token, user.enhancedSecurity.period);
    }
  });
}));

/**
 * Sign in with Facebook.
 */

passport.use('facebook', new FacebookStrategy({
  clientID: config.facebook.clientID,
  clientSecret: config.facebook.clientSecret,
  scope: ['email', 'user_location']
}, function(accessToken, refreshToken, profile, done) {
  done(null, false, {
    accessToken: accessToken,
    refreshToken: refreshToken,
    profile: profile
  });
}));

/**
 * Sign in with GitHub.
 */

passport.use('github', new GitHubStrategy({
  clientID: config.github.clientID,
  clientSecret: config.github.clientSecret,
  customHeaders: { 'User-Agent': config.name }
}, function(accessToken, refreshToken, profile, done) {
  done(null, false, {
    accessToken: accessToken,
    refreshToken: refreshToken,
    profile: profile
  });
}));

/**
 * Sign in with Twitter. (OAuth 1.0a)
 * NOTE: different function args!
 */

passport.use('twitter', new TwitterStrategy({
  consumerKey: config.twitter.consumerKey,
  consumerSecret: config.twitter.consumerSecret
}, function(token, tokenSecret, profile, done) {
  done(null, false, {
    token: token,
    tokenSecret: tokenSecret,
    profile: profile
  });
}));

/**
 * Sign in with Google. (OAuth 2.0)
 */

passport.use('google', new GoogleStrategy({
  clientID: config.google.clientID,
  clientSecret: config.google.clientSecret,
  scope: ['profile email'] // get the user's email address
}, function(accessToken, refreshToken, profile, done) {
  done(null, false, {
    accessToken: accessToken,
    refreshToken: refreshToken,
    profile: profile
  });
}));

/**
 * Tumblr API
 * Uses OAuth 1.0a Strategy.
 */
/*
passport.use('tumblr', new OAuthStrategy({
  requestTokenURL: 'http://www.tumblr.com/oauth/request_token',
  accessTokenURL: 'http://www.tumblr.com/oauth/access_token',
  userAuthorizationURL: 'http://www.tumblr.com/oauth/authorize',
  consumerKey: config.tumblr.key,
  consumerSecret: config.tumblr.secret,
  callbackURL: config.tumblr.callbackURL,
  passReqToCallback: true
}, function (req, token, tokenSecret, profile, done) {
  User.findById(req.user._id, function (err, user) {
    user.tokens.push({ kind: 'tumblr', token: token, tokenSecret: tokenSecret });
    user.save(function (err) {
      done(err, user);
    });
  });
}));
*/
/**
 * Foursquare API
 * Uses OAuth 2.0 Strategy.
 */
/*
passport.use('foursquare', new OAuth2Strategy({
  authorizationURL: 'https://foursquare.com/oauth2/authorize',
  tokenURL: 'https://foursquare.com/oauth2/access_token',
  clientID: config.foursquare.clientId,
  clientSecret: config.foursquare.clientSecret,
  callbackURL: config.foursquare.redirectUrl,
  passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
  User.findById(req.user._id, function (err, user) {
    user.tokens.push({ kind: 'foursquare', accessToken: accessToken });
    user.save(function (err) {
      done(err, user);
    });
  });
}));
*/
/**
 * Login Required middleware.
 */

exports.isAuthenticated = function(req, res, next) {
  // Is the user authenticated?
  if(req.isAuthenticated()) {
    // Does the user have enhanced security enabled?
    if(req.user.enhancedSecurity.enabled) {
      // If we already have validated the second factor it's
      // a noop, otherwise redirect to capture the OTP.
      if(req.session.passport.secondFactor === 'validated') {
        return next();
      } else {
        // Verify their OTP code
        res.redirect('/verify-setup');
      }
    } else {
      // If enhanced security is disabled just continue.
      return next();
    }
  } else {
    req.session.attemptedURL = req.url; // Save URL so we can redirect to it after authentication
    res.set('X-Auth-Required', 'true');
    req.flash('error', { msg: 'You must be logged in to reach that page.' });
    res.redirect('/login');
  }
};

/**
 * Authorization Required middleware.
 */

exports.isAuthorized = function(req, res, next) {
  var provider = req.path.split('/').slice(-1)[0];
  if(_.find(req.user.tokens, { kind: provider })) {
    // we found the provider so just continue
    next();
  } else {
    // we have to get authorized first
    if(provider === 'facebook' || provider === 'twitter' || provider === 'github' || provider === 'google') {
      req.flash('info', { msg: 'You must connect ' + utils.capitalize(provider) + ' first!' });
      res.redirect('/account');
    } else {
      res.redirect('/auth/' + provider);
    }
  }
};

/**
 * Check if the account is an Administrator
 */

exports.isAdministrator = function(req, res, next) {
  // make sure we are logged in first
  if(req.isAuthenticated()) {
    // user must be be an administrator
    if(req.user.type !== 'admin') {
      req.flash('error', { msg: 'You must be an Administrator reach that page.' });
      return res.redirect('/api');
    } else {
      return next();
    }
  } else {
    req.flash('error', { msg: 'You must be logged in to reach that page.' });
    res.redirect('/login');
  }
};

/**
 * Redirect to HTTPS (SSL) connection
 *
 * Good middleware for login forms, etc.
 * Not currently used since we are directing
 * *all* traffic to ssl in production
 */

exports.isSecure = function(req, res, next) {
  // Reroute HTTP traffic to HTTPS
  if((req.secure) || (req.headers['x-forwarded-proto'] === 'https')) {
    return next();
  } else {
    res.redirect('https://' + req.headers.host + req.url);
  }
};
