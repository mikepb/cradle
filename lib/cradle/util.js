/*!
 * Cradle - Util
 * Copyright(c) 2011 Michael Phan-Ba.
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var fs = require('fs');

/**
 * Generate UUIDs.
 *
 * To generate URL-safe Base64-encoded UUIDs, set `encoding`
 * to `base64`.
 *
 * @param {Integer} (optional) count
 * @param {String} (optional) encoding
 * @param {Function} (optional) callback
 * @return {Array[String]} array of uuids
 * @api public
 */
exports.uuids = function() {
  var args = Array.prototype.slice.call(arguments)
    , count = 1
    , encoding
    , callback;

  args.forEach(function(arg) {
    switch (typeof arg) {
      case 'number':
        count = parseInt(arg) || count;
        break;
      case 'string':
        encoding = arg;
        break;
      case 'function':
        callback = arg;
        break;
    }
  });

  var bytes = 16 * count
    , buffer = new Buffer(bytes)
    , slice = encoding === 'base64' ? base64Slice : hexSlice
    , fh = fs.openSync('/dev/urandom', 'r');

  fs.readSync(fh, buffer, 0, buffer.length, 0);
  fs.closeSync(fh);

  var uuids = [], offset;
  for (var i = 0; i < count; ++i) {
    offset = i * 16;
    uuids.push(slice(buffer, offset, offset + 16));
  }

  callback && callback(null, uuids);

  return uuids;
};

function toHex(n) {
  if (n < 16) return '0' + n.toString(16);
  return n.toString(16);
}

function hexSlice(buffer, start, end) {
  var len = buffer.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var answer = [];
  for (var i = start; i < end; i++) {
    answer.push(toHex(buffer[i]));
  }

  return answer.join('');
}

function base64Slice(buffer, start, end) {
  return buffer.slice(start || 0, end || buffer.length)
               .toString('base64')
               .replace(/=+$/, '')
               .replace(/\+/g, '-')
               .replace(/\//g, '_');
}
