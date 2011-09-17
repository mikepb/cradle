/*!
 * Cradle - Util Tests
 * Copyright(c) 2011 Michael Phan-Ba.
 * MIT Licensed
 */

var vows = require('vows')
  , assert = require('assert')
  , sinon = require('sinon');

var util = require('../lib/cradle/util');

function behaveLikeUuids(count, encoding, callback) {
  var args = [];

  if (typeof count !== undefined) args.push(count);
  if (typeof encoding !== undefined) args.push(encoding);

  count = count || 1;

  var tests = {};

  if (callback) {
    tests.topic = function() {
      util.uuids.apply(util.uuids, args.concat(this.callback));
    };
  } else {
    tests.topic = function() {
      this.callback(null, util.uuids.apply(util.uuids, args));
    };
  }

  tests['should return ' + count + ' UUIDs'] = function(err, uuids) {
    assert.strictEqual(uuids.length, count);
  };

  if (encoding === 'base64') {
    tests['should return URL-safe base64-encoded 16-byte UUIDs'] = function(err, uuids) {
      uuids.forEach(function(uuid) {
        assert.isTrue(/[0-9a-zA-Z\-_]{22}/.test(uuid));
      });
    };
  } else {
    tests['should return hex-encoded 16-byte UUIDs'] = function(err, uuids) {
      uuids.forEach(function(uuid) {
        assert.isTrue(/[0-9a-f]{32}/.test(uuid));
      });
    };
  }

  return tests;
}

vows.describe('util.uuids()').addBatch({
  'Generating UUIDs': {
    'with no options': behaveLikeUuids(),

    'with count of 1': behaveLikeUuids(1),
    'with count of 2': behaveLikeUuids(2),
    'with count of 100': behaveLikeUuids(100),

    'with count of 1 and encoding of "foobar"': behaveLikeUuids(1, 'foobar'),
    'with count of 2 and encoding of "foobar"': behaveLikeUuids(2, 'foobar'),
    'with count of 100 and encoding of "foobar"': behaveLikeUuids(100, 'foobar'),

    'with count of 1 and encoding of "base64"': behaveLikeUuids(1, 'base64'),
    'with count of 2 and encoding of "base64"': behaveLikeUuids(2, 'base64'),
    'with count of 100 and encoding of "base64"': behaveLikeUuids(100, 'base64'),

    'with count of 1 and callback': behaveLikeUuids(1, undefined, true),
    'with count of 2 and callback': behaveLikeUuids(2, undefined, true),
    'with count of 100 and callback': behaveLikeUuids(100, undefined, true),

    'with count of 1, encoding of "foobar", and callback': behaveLikeUuids(1, 'foobar', true),
    'with count of 2, encoding of "foobar", and callback': behaveLikeUuids(2, 'foobar', true),
    'with count of 100, encoding of "foobar", and callback': behaveLikeUuids(100, 'foobar', true),

    'with count of 1, encoding of "base64", and callback': behaveLikeUuids(1, 'base64', true),
    'with count of 2, encoding of "base64", and callback': behaveLikeUuids(2, 'base64', true),
    'with count of 100, encoding of "base64", and callback': behaveLikeUuids(100, 'base64', true),

    'with encoding of "foobar"': behaveLikeUuids(undefined, 'foobar'),
    'with encoding of "base64"': behaveLikeUuids(undefined, 'base64'),

    'with encoding of "foobar" and callback': behaveLikeUuids(undefined, 'foobar', true),
    'with encoding of "base64" and callback': behaveLikeUuids(undefined, 'base64', true),

    'with callback': behaveLikeUuids(undefined, undefined, true)
  }
}).export(module);
