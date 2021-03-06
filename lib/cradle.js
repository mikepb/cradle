var http = require("http")
  , https = require("https")
  , url = require('url')
  , querystring = require('querystring');

var cradle = exports
  , cradleUtil = require('./cradle/util');

cradle.Client   = require('./cradle/client').Client;
cradle.Connector = require('./cradle/connector').Connector;
cradle.Database = require('./cradle/database').Database;
cradle.Response = require('./cradle/response').Response;
cradle.Cache    = require('./cradle/cache').Cache;

cradle.uuids = cradleUtil.uuids;

cradle.options = {
    // Global options, unused for alternate servers
    cache: false,
    servers: [],
    // Options overridden by alternate server options
    agent: undefined,
    maxSockets: 20,
    url: null,
    host: '127.0.0.1',
    port: 5984,
    raw: false,
    username: undefined,
    password: undefined,
    secure: false,
    headers: {},
    retry: 1
};

var protocolPattern = /^(https?):\/\//;

cradle.setup = function (options) {
    this.options = this._parseOptions(options, true);
    this.options = this._parseOptions(this.options);
    return this;
};

cradle._parseOptions = function(options, localOptions) {
    if (options && options.url) {
        var parts = url.parse(options.url);
        if (!options.protocol && parts.protocol) {
            options.protocol = parts.protocol.substr(0,
                               parts.protocol.length - 1);
        }
        if (!options.username && !options.password && parts.auth) {
            var loc = parts.auth.indexOf(':');
            if (~loc) {
                options.username = querystring.unescape(parts.auth.substr(0, loc));
                if (++loc < parts.auth.length) {
                    options.password = querystring.unescape(parts.auth.substr(loc))
                }
            } else {
                options.username = querystring.unescape(parts.auth);
            }
        }
        if (!options.host && parts.hostname) options.host = parts.hostname;
        if (!options.port && parts.port) options.port = parts.port;
    }

    options = cradle.merge({}, this.options, options);

    if (options.port) options.port = parseInt(options.port);
    if (options.retry) options.retry = parseInt(options.retry);

    if (protocolPattern.test(options.host)) {
        options.protocol = options.host.match(protocolPattern)[1];
        options.host = options.host.replace(protocolPattern, '');
    }

    options.secure = options.protocol === 'https';
    options.socket = this.options.secure ? https : http;

    if (!localOptions && options.servers) {
        for (var i = 0, serverOptions; serverOptions = options.servers[i]; i++) {
            options.servers[i] = this._parseOptions(serverOptions, true);
        }
    }

    return options;
};

cradle.merge = function (target) {
    var i = 1, len = arguments.length, subject;
    while (i < len) {
        subject = arguments[i++];
        for (var key in subject) {
            if (subject.hasOwnProperty(key)) {
                target[key] = subject[key];
            }
        }
    }
    return target;
}

//
// Convenience function for creating new clients
//
cradle.createClient = function(options) {
    return new cradle.Client(cradle._parseOptions(options));
};
