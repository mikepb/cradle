var cradle = require('../cradle');

var baseProps = {
    toJSON: {
        value: function () {
            return this;
        }
    },
    toString: {
        value: function () {
            return JSON.stringify(this);
        }
    }
};

var listProps = {
    forEach: {
        value: function (f) {
            for (var i = 0, value; i < this.length; i++) {
                value = this[i].doc || this[i].json || this[i].value || this[i];
                if (f.length === 1) {
                    f.call(this[i], value);
                } else {
                    f.call(this[i], this[i].key, value, this[i].id);
                }
            }
        }
    },
    map: {
        value: function (f) {
            var ary = [];
            if (f.length === 1) {
                this.forEach(function (a) { ary.push(f.call(this, a)) });
            } else {
                this.forEach(function () { ary.push(f.apply(this, arguments)) });
            }
            return ary;
        }
    },
    toArray: {
        value: function () {
            return this.map(function (k, v) { return v });
        }
    }
};

//
// HTTP response wrapper
//
//      It allows us to call array-like methods on documents
//      with a 'row' attribute.
//
exports.Response = function Response(json, response) {
    var obj, headers, key;

    // If there are rows, this is the result of a view function.
    // We want to return this as an Array.
    if (json.rows) {
        obj = Array.prototype.slice.call(json.rows);
        for (key in json) {
            if (!obj[key] && json.hasOwnProperty(key)) {
                Object.defineProperty(obj, key, { value: json[key] });
            }
        }
    } else if (json.results) {
        obj = Array.prototype.slice.call(json.results);
        obj.last_seq  = json.last_seq;
    } else if (json.uuids) {
        obj = Array.prototype.slice.call(json.uuids);
    } else if (json instanceof Array) {
        obj = Array.prototype.slice.call(json);
    } else {
        obj = cradle.merge({}, json);
    }

    // If the response was originally a document,
    // give access to it via the 'json' getter.
    if (!(json instanceof Array) && !obj.json) {
        Object.defineProperty(obj, 'json', { value: json });
    }

    if (response) {
        headers = { status: response.statusCode };
        for (key in response.headers) {
            headers[key] = response.headers[key];
        }

        // Set the 'headers' special field, with the response's status code.
        Object.defineProperty(obj, 'headers' in obj ? '_headers' : 'headers',
                              { value: headers });
    }

    // Alias '_rev' and '_id'
    if (obj.id && obj.rev) {
        Object.defineProperties(obj, {
            _id: { value: obj.id },
            _rev: { value: obj.rev }
        });
    } else if (obj._id && obj._rev) {
        Object.defineProperties(obj, {
            id: { value: obj._id },
            rev: { value: obj._rev }
        });
    }

    if (obj instanceof Array && json.rows) {
        Object.defineProperties(obj, listProps);
    }
    Object.defineProperties(obj, baseProps);

    // Set the constructor to be this function
    Object.defineProperty(obj, 'constructor', { value: Response });

    return obj;
};
