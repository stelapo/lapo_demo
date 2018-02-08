'use strict';

/**
 * Module Dependencies
 */

// Express 4.x Modules
var csrf              = require('csurf');                   // https://github.com/expressjs/csurf
var morgan            = require('morgan');                  // https://github.com/expressjs/morgan
var express           = require('express');                 // https://npmjs.org/package/express





/**
 * Create Express app, HTTP server and socket.io listener
 */

var app    = module.exports = express();  // export app for testing ;)
var server = require('http').Server(app);
