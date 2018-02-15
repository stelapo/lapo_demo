'use strict';

const knex = require('knex'); // http://knexjs.org/
const utils = require('./utils');

var conn;
var countConn = 0;
var initialized = false;
var logger;

module.exports = {
  connect: function(conf, l) {
    initialized = true;
    logger = l;
    conf.pool.afterCreate = function(conn, done) {
      conn.query('SET timezone="UTC";', function(err) {
        if (err) {
          logger.error('KNEX conn NOT aquired! Error:');
          logger.error(err);
        } else {
          countConn++;
          logger.info('KNEX new conn from pool aquired! Total opened conn ' + countConn);
        }
        done(err, conn);
      });
    };
    logger.debug('KNEX::Opening connection ....');
    conn = knex(conf);
    conn.raw('select 1 as dbIsUp').then(function(rows) {
        logger.info('KNEX::Connected!');
        logger.debug('KNEX CONN ROWS:');
        logger.debug(rows);
      })
      .catch(function(error) {
        logger.error('KNEX::CONN ERROR:' + JSON.stringify(error));
      });
  },

  testInsert: function(prefix) {
    if (initialized) {
      logger.debug('testInsert::inserting.....');
      conn('test_schema.users').returning('id').insert({
          firstName: prefix + ' ' + utils.formattedTimestamp()
        }).then(function() {
          logger.debug('ROW INSERTED!');
        }).then(function(rows) {
          logger.debug('ROWS INSERTED:');
          logger.debug(rows);
        })
        .catch(function(error) {
          logger.debug('QUI');
          if (error) {
            logger.error(error);
          }
        });
    }
  }
};