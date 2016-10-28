'use strict';

var axios = require('axios');
var loggers = [];

// If we are in a browser
// catch window errors (uncaught exceptions)
if (window) {
  window.onerror = function onError(message, url, lineNo, columnNo, err) {
    var fields = {};

    if (err && err.stack) {
      fields.stack = err.stack;
    }

    loggers.forEach(function (log) {
      return log.error(message, fields);
    });
  };
}

module.exports.create = function create(options) {
  /**
   * Constructor
   */
  function Logstash(options) {
    this.url = options.url;
    this.tags = options.tags;
    this.level = options.level || 'info';
    this.sendDelay = options.sendDelay || 100;
    this.retryDelay = options.retryDelay || 2000;
    this.isSending = false;
    this.queue = [];
  }

  Logstash.prototype._trySendEvent = function _trySendEvent() {
    var _this = this;

    if (!this.queue.length || this.isSending) {
      return;
    }

    this.isSending = true;
    var event = this.queue.shift();

    var request = {
      url: this.url,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: event
    };

    // HTTP request
    axios(request).then(function () {
      _this.isSending = false;
      setTimeout(_this._trySendEvent.bind(_this), _this.sendDelay);
    }).catch(function () {
      // If we could not send the event,
      // put it back into queue
      _this.queue.unshift(event);

      _this.isSending = false;
      setTimeout(_this._trySendEvent.bind(_this), _this.retryDelay);
    });
  };

  Logstash.prototype.log = function log(level, message, fields) {
    var event = { level: level, message: message, fields: fields };
    event['@timestamp'] = new Date().toISOString();
    event['@tags'] = this.tags;

    // If we are in a browser
    // attach navigator metadata
    if (navigator) {
      event.navigator = {
        cookieEnabled: navigator.cookieEnabled,
        geoLocation: navigator.geoLocation,
        language: navigator.language,
        languages: navigator.languages,
        online: navigator.online,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor
      };
    }

    // If we are in a browser
    // attach location metadata
    if (location) {
      event.location = {
        search: location.search,
        pathname: location.pathname,
        hostname: location.hostname,
        protocol: location.protocol,
        port: location.port,
        hash: location.hash,
        href: location.href
      };
    }

    this.queue.push(event);
    this._trySendEvent();
  };

  Logstash.prototype.debug = function debug(message, fields) {
    this.log('debug', message, fields);
  };

  Logstash.prototype.info = function info(message, fields) {
    this.log('info', message, fields);
  };

  Logstash.prototype.warn = function warn(message, fields) {
    this.log('warn', message, fields);
  };

  Logstash.prototype.error = function error(message, fields) {
    this.log('error', message, fields);
  };

  // Create logger instance
  var log = new Logstash(options);
  loggers.push(log);

  return log;
};