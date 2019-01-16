const axios = require('axios');
const loggers = [];

function create(url, tags, level, options = {}) {
  return new Logstash(url, tags, level, options);
}

function Logstash(url, tags = [], level = "info", options = {}) {
  if (!url) {
    throw new TypeError("Invalid URL");
  }

  this.url = url;
  this.tags = tags;
  this.level = level;
  this.sendDelay = options.sendDelay || 100;
  this.retryDelay = options.retryDelay || 2000;
  this.muteConsole = options.muteConsole === true || false;
  this.isSending = false;
  this.queue = [];
}

Logstash.prototype._trySendEvent = function _trySendEvent() {
  if (!this.queue.length || this.isSending) {
    return;
  }

  this.isSending = true;
  const event = this.queue.shift();

  const request = {
    url: this.url,
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data: event,
  };

  // HTTP request
  return axios(request)
    .then(() => {
      this.isSending = false
      this._trySendEvent();
    })
    .catch(err => {
      console.error(err);

      // If we could not send the event,
      // put it back into queue
      this.queue.unshift(event);

      this.isSending = false;
      setTimeout(this._trySendEvent.bind(this), this.retryDelay);
    });
}

Logstash.prototype.log = function log(level, message, fields) {
  const event = { level, fields, message };

  event['@timestamp'] = new Date().toISOString();
  event['@tags'] = this.tags;

  // Navigator metadata
  if (typeof navigator !== 'undefined') {
    event.navigator = {
      cookieEnabled: navigator.cookieEnabled,
      geoLocation: navigator.geoLocation,
      language: navigator.language,
      languages: navigator.languages,
      online: navigator.online,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
    };
  }

  // Location metadata
  if (typeof location !== 'undefined') {
    event.location = {
      search: location.search,
      pathname: location.pathname,
      hostname: location.hostname,
      protocol: location.protocol,
      port: location.port,
      hash: location.hash,
      href: location.href,
    };
  }

  this.queue.push(event);
  this._trySendEvent();

  if (this.muteConsole) {
    return;
  }

  const fieldsStr = fields ? ` - ${JSON.stringify(fields)}` : '';

  switch(level) {
    case "error":
    console.error(`${message}${fieldsStr}`);
    break;
    case "warn":
    console.warn(`${message}${fieldsStr}`);
    break;
    default:
    console.info(`${message}${fieldsStr}`);
  }
}

Logstash.prototype.debug = function debug(message, fields) {
  this.log('debug', message, fields);
}

Logstash.prototype.info = function info(message, fields) {
  this.log('info', message, fields);
}

Logstash.prototype.warn = function warn(message, fields) {
  this.log('warn', message, fields);
}

Logstash.prototype.error = function error(err, fields) {
  if (err instanceof Error) {
    this.log('error', err.message, Object.assign({ stack: err.stack }, fields));
  } else {
    this.log('error', err, fields);
  }
}

module.exports = create;
