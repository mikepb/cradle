/*!
 * Cradle - Connector
 * Copyright(c) 2011 Michael Phan-Ba.
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var http = require('http')
  , https = require('https')
  , querystring = require('querystring')
  , url = require('url');

var cradle = require('../cradle');

/**
 * HTTP connection factory.
 *
 * Options:
 *
 *   - **url** {String} - Configure using URL, overridden by
 *                        individual options
 *   - **socket** {module} - HTTP socket; default to `https` if
 *                `secure` is true, `http` otherwise
 *   - **agent** {Agent} - HTTP agent; created automatically from
 *               `socket` if not given
 *   - **maxSockets** {Integer} - HTTP agent max sockets, unused if
 *                    `agent` is given; default 20
 *   - **host** {String} - HTTP host; default '127.0.0.1'
 *   - **port** {String} - HTTP port; default 5984
 *   - **path** {String} - HTTP path; default '/'
 *   - **method** {String} - HTTP method; default 'GET'
 *   - **headers** {Array} - HTTP headers; default overrides
 *                 'Host', 'Connection', and 'Authorization',
 *                 depending on configuration options
 *   - **username** {String} - HTTP authentication username
 *   - **password** {String} - HTTP authentication password
 *   - **secure** {Boolean} - Use HTTPS
 *
 * @param {Object or String} (optional) options or URL
 * @api public
 */

var Connector = exports.Connector = function(options) {
  // Support URL string argument
  options = typeof options === 'string' ? { url: options } : options || {};

  // Parse URL
  if (options.url) {
    var parts = url.parse(options.url);
    if (parts.protocol === 'https:') this.secure = true;
    if (parts.auth) {
      var loc = parts.auth.indexOf(':');
      if (~loc) {
        this.username = querystring.unescape(parts.auth.substr(0, loc));
        if (++loc < parts.auth.length) {
          this.password = querystring.unescape(parts.auth.substr(loc))
        }
      } else {
        this.username = querystring.unescape(parts.auth);
      }
    }
    if (parts.hostname) this.host = parts.hostname;
    if (parts.port) this.port = parseInt(parts.port);
    if (parts.pathname) this.path = parts.pathname;
  }

  // Options that may not be false
  if (options.host) this.host = options.host;
  if (options.port) this.port = options.port;
  if (options.path) this.path = options.path;
  if (options.method) this.method = options.method;

  // Options that may be false
  if (options.hasOwnProperty('secure')) this.secure = options.secure;
  if (options.hasOwnProperty('username')) this.username = options.username;
  if (options.hasOwnProperty('password')) this.password = options.password;

  // Choose HTTP socket
  this.socket = options.socket || (this.secure ? https : http);

  // Create or use custom agent
  if (options.agent) {
    this.agent = options.agent;
  } else {
    if (options.maxSockets) this.maxSockets = options.maxSockets;
    this.agent = new(this.socket.Agent)({
      host: this.host,
      port: this.port
    });
    this.agent.maxSockets = this.maxSockets;
  }

  // Set default headers
  this.headers = options.headers && cradle.merge({}, options.headers) || {};
  this.headers['Host'] = this.host;
  this.headers['Connection'] = 'keep-alive';

  // Set basic authentication header
  if (this.username) {
    var buffer = new Buffer([this.username, this.password].join(':'));
    this.headers['Authorization'] = 'Basic ' + buffer.toString('base64');
  }
};

/**
 * Default options.
 */

Connector.prototype = {

  /**
   * HTTP socket.
   */

  socket: undefined,

  /**
   * HTTP agent.
   */

  agent: undefined,

  /**
   * Max HTTP agent sockets.
   */

  maxSockets: 8,

  /**
   * Remote host.
   */

  host: '127.0.0.1',

  /**
   * Remote port.
   */

  port: 5984,

  /**
   * HTTP path.
   */

  path: '/',

  /**
   * HTTP method.
   */

  method: 'GET',

  /**
   * HTTP headers.
   */

  headers: undefined,

  /**
   * Use TLS.
   */

  secure: false,

  /**
   * HTTP authentication username.
   */

  username: undefined,

  /**
   * HTTP authentication password.
   */

  password: undefined

};

/**
 * Service a request.
 *
 * Options:
 *
 *   - **path** {String} - HTTP path; defaults to '/'
 *   - **method** {String} - HTTP method; defaults to 'GET'
 *   - **headers** {Array} - HTTP headers; default includes
 *                 'Host', 'Connection', and 'Authorization',
 *                 depending on configuration options
 *
 * @param {Object} options
 * @param {Function} (optional) callback
 * @return {ClientRequest}
 * @api public
 */

Connector.prototype.request = function(options, callback) {
  options = options || {};

  var path = options.path || this.path
    , method = options.method || this.method
    , headers = cradle.merge({}, this.headers, options.headers || {});

  return this.socket.request({
    agent: this.agent,
    host: this.host,
    port: this.port,
    path: path,
    method: method,
    headers: headers
  }, callback);
};
