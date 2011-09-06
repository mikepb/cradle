var events = require('events')
  , querystring = require('querystring')
  , cradle = require('../cradle');

var Client = exports.Client = function(options) {
    this.options = options;
};

//
// Client.rawRequest()
//
//      This is a base wrapper around Clients to CouchDB. Given that it handles
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
Client.prototype.rawRequest = function (method, path, query, data, headers) {
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

    // Keep this Client alive for future requests
    headers = headers || {};
    headers['Connection'] = 'keep-alive';

    // Handle data
    if (data && data.on) { headers['Transfer-Encoding'] = 'chunked' }

    // Service this request
    this._rawRequest(promise, method.toUpperCase(), path, data, headers,
                     this.options, this.options.retry || 0, -1);

    return promise;
}

Client.prototype._rawRequest = function (promise, method, path, data,
                                         headers, options, retry, server) {
    var reqHeaders = { 'Host': options.host }, that = this;

    // Set HTTP Basic Auth
    if (options.auth) {
        reqHeaders['Authorization'] = "Basic " + new Buffer(options.auth.username + ':' + options.auth.password).toString('base64');
    }

    // Merge headers
    reqHeaders = cradle.merge({}, options.headers, reqHeaders, headers);

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
        res.on('error', function(err) { promise.emit('error', err); });
    });

    request.on('continue', function() {
        promise.emit('continue');
    });

    request.on('error', function (err) {

        // Intercept HTTP Agent hack for no response errors as ECONNRESET
        if (err.message === 'socket hang up') {
            var stack = Object.getOwnPropertyDescriptor(err, 'stack');

            err = new Error('ECONNRESET, Client reset by peer');
            err.code = 'ECONNRESET';

            Object.defineProperty(err, 'stack', stack);
        }

        // Attempt to retry for supported errors
        if (// Unlimited tries if negative, stop at zero otherwise
            retry-- && (
            // Retry for broken pipe
            err.code === 'EPIPE' ||
            // Retry for Client reset
            err.code === 'ECONNRESET'))
        {
            promise.emit('retry');
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
            promise.emit('retry');
            promise.emit('alternate');
            return that._rawRequest(promise, method, path, data, headers,
                                    options, options.retry || 0, server);
        }

        promise.emit('error', err);
        promise.emit('end');
    });
}

//
// Client.request()
//
//      This is the entry point for all requests to CouchDB, at this point,
//      the database name has been embed in the url, by one of the wrappers.
//
Client.prototype.request = function (method, path, /* [options], [data], [headers] */ callback) {
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
        });
        res.on('end', function () {
            var json, response;

            if (method === 'HEAD') {
                return callback(null, res.headers, res.statusCode);
            }

            try {
                json = JSON.parse(body.join(''));
            } catch (err) {
                return callback(err);
            }


            if (json.error) {
                Object.defineProperty(json, 'headers', { value: res.headers });
                json.headers.status = res.statusCode;
                return callback(json);
            }

            // If the `raw` option was set, we return the parsed
            // body as-is. If not, we wrap it in a `Response` object.
            callback(null, that.options.raw ? json : new cradle.Response(json, res));
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
Client.prototype.database = function (name) {
    return new cradle.Database(this, name);
};

//
// Wrapper functions for the server API
//
Client.prototype.databases = function (c) {
    this.request('GET', '/_all_dbs', c);
};
Client.prototype.config = function (c) {
    this.request('GET', '/_config', c);
};
Client.prototype.info = function (c) {
    this.request('GET', '/', c);
};
Client.prototype.stats = function (c) {
    this.request('GET', '/_stats', c);
};
Client.prototype.activeTasks = function (c) {
    this.request('GET', '/_active_tasks', c);
};
Client.prototype.uuids = function (count, callback) {
    if (typeof(count) === 'function') { callback = count, count = null }
    this.request('GET', '/_uuids', count ? {count: count} : {}, callback);
};
Client.prototype.replicate = function (options, callback) {
    this.request('POST', '/_replicate', null, options, callback);
};
