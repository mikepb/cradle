var path = require('path');

var sys = require("sys"),
   http = require("http"),
   https = require("https"),
 events = require('events'),
     fs = require("fs"),
    url = require('url'),
 buffer = require('buffer');

var querystring = require('querystring');

var cradle = exports;

cradle.extend   = require('./cradle/response').extend;
cradle.Database = require('./cradle/database').Database;
cradle.Response = require('./cradle/response').Response;
cradle.Cache    = require('./cradle/cache').Cache;

cradle.options = {
    // Global options, unused for alternate servers
    cache: true,
    servers: [],
    // Options overridden by alternate server options
    auth: null,
    host: '127.0.0.1',
    port: 5984,
    raw: false,
    secure: false,
    headers: {},
    retry: 1
};

var protocolPattern = /^(https?):\/\//;

cradle.setup = function (options) {
    this.options = this._parseOptions(options);
    return this;
};

cradle._parseOptions = function(options, inherit, localOptions) {
    options = cradle.merge({}, inherit || this.options, options);

    if (options.port) options.port = parseInt(options.port);
    if (options.retry) options.retry = parseInt(options.retry);

    if (protocolPattern.test(options.host)) {
        options.protocol = options.host.match(protocolPattern)[1];
        options.host = options.host.replace(protocolPattern, '');
        options.secure = options.protocol === 'https';
    }

    options.socket = this.options.secure ? https : http;

    if (!localOptions && options.servers) {
        for (var i = 0, serverOptions; serverOptions = options.servers[i]; i++) {
            options.servers[i] = this._parseOptions(serverOptions, options, true);
        }
    }

    return cradle.merge({}, this.options, options);
};

var Connection = cradle.Connection = function(options) {
    this.options = cradle._parseOptions(options);
};

//
// Connection.rawRequest()
//
//      This is a base wrapper around connections to CouchDB. Given that it handles
//      *all* requests, including those for attachments, it knows nothing about
//      JSON serialization and does not presuppose it is sending or receiving JSON
//      content
//
//      By default, the request will be attempted once. Set the `retry` option to
//      change this behavior:
//
//        `retry === 0`: don't retry
//        `retry > 0`: retry `retry` times
//        `retry < 0`: always retry
//
cradle.Connection.prototype.rawRequest = function (method, path, query, data, headers) {
    var promise = new(events.EventEmitter);

    // Parse path
    if (path) {
        path = path.replace(/https?:\/\//, '').replace(/\/{2,}/g, '/');
        if (path[0] !== '/') path = '/' + path;
    } else {
        path = '/';
    }

    // Add query
    if (query) {
        for (var k in query) {
            if (typeof query[k] === 'boolean') {
                query[k] = String(query[k]);
            }
        }
        path += '?';
        path += querystring.stringify(query);
    }

    // Keep this connection alive for future requests
    headers = headers || {};
    headers['Connection'] = 'keep-alive';

    // Handle data
    if (data && data.on) { headers['Transfer-Encoding'] = 'chunked' }

    // Service this request
    this._rawRequest(promise, method.toUpperCase(), path, data, headers,
                     this.options, this.options.retry || 0, -1);

    return promise;
}

cradle.Connection.prototype._rawRequest = function (promise, method, path, data,
                                                    headers, options, retry, server) {
    var reqHeaders = { 'Host': this.host }, that = this;

    // Set HTTP Basic Auth
    if (options.auth) {
        reqHeaders['Authorization'] = "Basic " + new Buffer(options.auth.username + ':' + options.auth.password).toString('base64');
    }

    // Merge headers
    cradle.merge(reqHeaders, options.headers, headers);

    var request = options.socket.request({
        host: options.host,
        port: options.port,
        path: path,
        method: method,
        headers: reqHeaders
    });

    if (data) {
        if (data.on) {
            data.on('data', function (chunk) { request.write(chunk) });
            data.on('end', function () { request.end() });
        } else {
            request.write(data, 'utf8');
            request.end();
        }
    } else {
        request.end();
    }

    request.on('response', function (res) {
        promise.emit('response', res);
        res.on('data', function (chunk) { promise.emit('data', chunk) });
        res.on('end',  function () { promise.emit('end') });
    });

    request.on('error', function (err) {

        // Intercept HTTP Agent hack for no response errors as ECONNRESET
        if (err.message === 'socket hang up') {
            var stack = Object.getOwnPropertyDescriptor(err, 'stack');

            err = new Error('ECONNRESET, Connection reset by peer');
            err.code = 'ECONNRESET';

            Object.defineProperty(err, 'stack', stack);
        }

        // Attempt to retry for supported errors
        if (// Unlimited tries if negative, stop at zero otherwise
            retry-- && (
            // Retry for broken pipe
            err.code === 'EPIPE' ||
            // Retry for connection reset
            err.code === 'ECONNRESET'))
        {
            return that._rawRequest(promise, method, path, data, headers,
                                    options, retry, server);
        }

        // Try alternate servers
        if (// This server is dead
            err.code === 'ECONNREFUSED' &&
            // Are there alternate servers?
            that.options.servers &&
            // Is there a next alternate server to use?
            // If so, use that server's options
            (options = that.options.servers[++server]))
        {
            return that._rawRequest(promise, method, path, data, headers,
                                    options, options.retry || 0, server);
        }

        promise.emit('error', err);
        promise.emit('end');
    });
}

//
// Connection.request()
//
//      This is the entry point for all requests to CouchDB, at this point,
//      the database name has been embed in the url, by one of the wrappers.
//
cradle.Connection.prototype.request = function (method, path, /* [options], [data], [headers] */ callback) {
    var request, that = this, args = Array.prototype.slice.call(arguments, 2);

    if (typeof(callback = args.pop()) !== 'function') {
        args.push(callback);
        callback = function () {};
    }

    var options = args.shift() || {},
        data    = args.shift() || null,
        headers = args.shift() || {};

    //
    // Handle POST/PUT data. We also convert functions to strings,
    // so they can be used in _design documents.
    //
    if (data) {
        data = JSON.stringify(data, function (k, val) {
            if (typeof(val) === 'function') {
                return val.toString();
            } else { return val }
        });
        headers["Content-Length"] = Buffer.byteLength(data);
        headers["Content-Type"]   = "application/json";
    }

    if (method === "DELETE" && headers["Content-Length"] === undefined) {
        headers["Content-Length"] = 0;
    }

    request = that.rawRequest(method, path, options, data, headers);

    //
    // Initialize the request, send the body, and finally,
    // dispatch the request.
    //
    request.on('response', function (res) {
        var body = [];

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            chunk && body.push(chunk);
        }).on('end', function () {
            var json, response;

            if (method === 'HEAD') {
                callback(null, res.headers, res.statusCode);
            } else {
                try { json = JSON.parse(body.join('')) }
                catch (e) { return callback(e) }


                if (json.error) {
                    cradle.extend(json, { headers: res.headers });
                    json.headers.status = res.statusCode;
                    callback(json);
                } else {
                    // If the `raw` option was set, we return the parsed
                    // body as-is. If not, we wrap it in a `Response` object.
                    callback(null, that.options.raw ? json : new(cradle.Response)(json, res));
                }
            }
        });
    });
    request.on('error', function(err) {
        return callback(err);
    });
};

//
// The database object
//
//      We return an object with database functions,
//      closing around the `name` argument.
//
cradle.Connection.prototype.database = function (name) {
    return new cradle.Database(this, name);
};

//
// Wrapper functions for the server API
//
cradle.Connection.prototype.databases = function (c) {
    this.request('GET', '/_all_dbs', c);
};
cradle.Connection.prototype.config = function (c) {
    this.request('GET', '/_config', c);
};
cradle.Connection.prototype.info = function (c) {
    this.request('GET', '/', c);
};
cradle.Connection.prototype.stats = function (c) {
    this.request('GET', '/_stats', c);
};
cradle.Connection.prototype.activeTasks = function (c) {
    this.request('GET', '/_active_tasks', c);
};
cradle.Connection.prototype.uuids = function (count, callback) {
    if (typeof(count) === 'function') { callback = count, count = null }
    this.request('GET', '/_uuids', count ? {count: count} : {}, callback);
};
cradle.Connection.prototype.replicate = function (options, callback) {
    this.request('POST', '/_replicate', null, options, callback);
};

cradle.merge = function (target) {
    for (var i = 1, subject; subject = arguments[i]; i++) {
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
    return new Connection(options);
};
