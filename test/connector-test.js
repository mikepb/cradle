/*!
 * Cradle - Connector Tests
 * Copyright(c) 2011 Michael Phan-Ba.
 * MIT Licensed
 */

var vows = require('vows')
  , assert = require('assert')
  , sinon = require('sinon')
  , http = require('http')
  , https = require('https');

var Connector = require('../lib/cradle/connector').Connector;

var shouldBehaveLikeRequestMethod = {
  topic: function(connector, options) {
    return function() {
      var mockSocket = { Agent: function() {} };
      mockSocket.request = sinon.stub().returns(mockSocket);
  
      var opts = {};
  
      Object.keys(options).forEach(function(key) {
        opts[key] = options[key];
      });
  
      opts.socket = mockSocket;
      opts.agent = mockSocket.Agent;
  
      return { connector: new Connector(opts), mockSocket: mockSocket };
    }
  },
  'called with no arguments': {
    topic: function(factory) {
      var subject = factory()
        , connector = subject.connector
        , mockSocket = subject.mockSocket;
      this.callback(null, connector.request(), connector, mockSocket);
    },
    'should call socket.request() once': function(err, result, connector, mockSocket) {
      assert.isTrue(mockSocket.request.calledOnce);
    },
    'should call socket.request() with the constructor options': function(err, result, connector, mockSocket) {
      var options = mockSocket.request.getCall(0).args[0];
      assert.strictEqual(options.agent, connector.agent);
      assert.strictEqual(options.host, connector.host);
      assert.strictEqual(options.port, connector.port);
      assert.strictEqual(options.path, connector.path);
      assert.strictEqual(options.method, connector.method);
      assert.deepEqual(options.headers, connector.headers);
    },
    'should return the return value of socket.request()': function(err, result, connector, mockSocket) {
      assert.strictEqual(mockSocket.request.returnValue, mockSocket);
    }
  },
  'called with options': {
    topic: function(factory) {
      var subject = factory()
        , connector = subject.connector
        , mockSocket = subject.mockSocket
        , options = {
            agent: true,
            host: 'www.example.com',
            port: 420,
            path: '/hello',
            method: 'HEAD',
            headers: { 'X-Test': 'true' }
          };
      this.callback(null, connector.request(options), connector, mockSocket);
    },
    'should call socket.request() once': function(err, result, connector, mockSocket) {
      assert.isTrue(mockSocket.request.calledOnce);
    },
    'should not call socket.request() with the given agent, host, or port': function(err, result, connector, mockSocket) {
      var options = mockSocket.request.getCall(0).args[0];
      assert.strictEqual(options.agent, connector.agent);
      assert.strictEqual(options.host, connector.host);
      assert.strictEqual(options.port, connector.port);
    },
    'should call socket.request() with the given path, method, and merged headers': function(err, result, connector, mockSocket) {
      var options = mockSocket.request.getCall(0).args[0];
      assert.strictEqual(options.path, '/hello');
      assert.strictEqual(options.method, 'HEAD');

      var headers = {};
      Object.keys(connector.headers).forEach(function(key) {
        headers[key] = connector.headers[key];
      });
      headers['X-Test'] = 'true';

      assert.deepEqual(options.headers, headers);
    },
    'should return the return value of socket.request()': function(err, result, connector, mockSocket) {
      assert.strictEqual(mockSocket.request.returnValue, mockSocket);
    }
  }
};


vows.describe('Connector').addBatch({
  'A Connector': {
    'created with no options': {
      topic: function() {
        this.callback(null, new Connector, {});
      },
      'should have default option values': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.host, '127.0.0.1');
        assert.strictEqual(connector.port, 5984);
        assert.strictEqual(connector.path, '/');
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
        assert.isUndefined(connector.username);
        assert.isUndefined(connector.password);
      },
      'should not define own properties for default option values': function(err, connector) {
        assert.isFalse(connector.hasOwnProperty('maxSockets'));
        assert.isFalse(connector.hasOwnProperty('host'));
        assert.isFalse(connector.hasOwnProperty('port'));
        assert.isFalse(connector.hasOwnProperty('path'));
        assert.isFalse(connector.hasOwnProperty('method'));
        assert.isFalse(connector.hasOwnProperty('secure'));
        assert.isFalse(connector.hasOwnProperty('username'));
        assert.isFalse(connector.hasOwnProperty('password'));
      },
      'should have the default socket': function(err, connector) {
        assert.strictEqual(connector.socket, http);
      },
      'should have an agent populated with the default options': function(err, connector) {
        assert.deepEqual(connector.agent.options, { host: '127.0.0.1', port: 5984 });
        assert.strictEqual(connector.agent.host, '127.0.0.1');
        assert.strictEqual(connector.agent.port, 5984);
        assert.strictEqual(connector.agent.maxSockets, 8);
      },
      'should set default headers': function(err, connector) {
        assert.strictEqual(connector.headers['Host'], '127.0.0.1');
        assert.strictEqual(connector.headers['Connection'], 'keep-alive');
      },
      'calling the request() method': shouldBehaveLikeRequestMethod
    },
    'created with options': {
      topic: function() {
        var options = {
          maxSockets: 2,
          host: 'example.net',
          port: 8888,
          path: '/goodbye',
          method: 'LIST',
          headers: { 'X-Options': 'true' },
          secure: true,
          username: 'anonymous',
          password: 'xyzzy'
        };
        this.callback(null, new Connector(options), options);
      },
      'should use the given option values': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 2);
        assert.strictEqual(connector.host, 'example.net');
        assert.strictEqual(connector.port, 8888);
        assert.strictEqual(connector.path, '/goodbye');
        assert.strictEqual(connector.method, 'LIST');
        assert.isTrue(connector.secure);
        assert.strictEqual(connector.username, 'anonymous');
        assert.strictEqual(connector.password, 'xyzzy');
      },
      'should define own properties for default option values': function(err, connector) {
        assert.isTrue(connector.hasOwnProperty('maxSockets'));
        assert.isTrue(connector.hasOwnProperty('host'));
        assert.isTrue(connector.hasOwnProperty('port'));
        assert.isTrue(connector.hasOwnProperty('path'));
        assert.isTrue(connector.hasOwnProperty('method'));
        assert.isTrue(connector.hasOwnProperty('secure'));
        assert.isTrue(connector.hasOwnProperty('username'));
        assert.isTrue(connector.hasOwnProperty('password'));
      },
      'should have the secure socket': function(err, connector) {
        assert.strictEqual(connector.socket, https);
      },
      'should have an agent populated with the given options': function(err, connector) {
        assert.deepEqual(connector.agent.options, { host: 'example.net', port: 8888 });
        assert.strictEqual(connector.agent.host, 'example.net');
        assert.strictEqual(connector.agent.port, 8888);
        assert.strictEqual(connector.agent.maxSockets, 2);
      },
      'should set default headers': function(err, connector) {
        assert.strictEqual(connector.headers['Host'], 'example.net');
        assert.strictEqual(connector.headers['Connection'], 'keep-alive');
      },
      'should have custom headers': function(err, connector) {
        assert.strictEqual(connector.headers['X-Options'], 'true');
      },
      'should not have modified original options headers': function(err, connector, options) {
        assert.deepEqual(options.headers, { 'X-Options': 'true' });
      },
      'should have the basic authentication header': function(err, connector) {
        assert.strictEqual(connector.headers['Authorization'], 'Basic YW5vbnltb3VzOnh5enp5');
      },
      'calling the request() method': shouldBehaveLikeRequestMethod
    },
    'created with a URL': {
      topic: function() {
        var url = 'http://www.example.com:8888/hello';
        this.callback(null, new Connector(url));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 8888);
        assert.strictEqual(connector.path, '/hello');
      },
      'should have default option values': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
      },
      'should not define own properties for default option values': function(err, connector) {
        assert.isFalse(connector.hasOwnProperty('maxSockets'));
        assert.isFalse(connector.hasOwnProperty('method'));
        assert.isFalse(connector.hasOwnProperty('secure'));
      },
      'should have the default socket': function(err, connector) {
        assert.strictEqual(connector.socket, http);
      },
      'should have an agent populated with the URL options': function(err, connector) {
        assert.deepEqual(connector.agent.options, { host: 'www.example.com', port: 8888 });
        assert.strictEqual(connector.agent.host, 'www.example.com');
        assert.strictEqual(connector.agent.port, 8888);
        assert.strictEqual(connector.agent.maxSockets, 8);
      },
      'should set default headers': function(err, connector) {
        assert.strictEqual(connector.headers['Host'], 'www.example.com');
        assert.strictEqual(connector.headers['Connection'], 'keep-alive');
      }
    },
    'created with a URL with options': {
      topic: function() {
        var options = {
          url: 'http://www.example.com:8888/hello',
          host: 'localhost',
          port: 9999,
          path: '/goodbye',
          secure: true
        };
        this.callback(null, new Connector(options));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.host, 'localhost');
        assert.strictEqual(connector.port, 9999);
        assert.strictEqual(connector.path, '/goodbye');
        assert.isTrue(connector.secure);
      },
      'should have default option values': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.method, 'GET');
      },
      'should not define own properties for default option values': function(err, connector) {
        assert.isFalse(connector.hasOwnProperty('maxSockets'));
        assert.isFalse(connector.hasOwnProperty('method'));
      },
      'should have the secure socket': function(err, connector) {
        assert.strictEqual(connector.socket, https);
      },
      'should have an agent populated with the URL options': function(err, connector) {
        assert.deepEqual(connector.agent.options, { host: 'localhost', port: 9999 });
        assert.strictEqual(connector.agent.host, 'localhost');
        assert.strictEqual(connector.agent.port, 9999);
        assert.strictEqual(connector.agent.maxSockets, 8);
      },
      'should set default headers': function(err, connector) {
        assert.strictEqual(connector.headers['Host'], 'localhost');
        assert.strictEqual(connector.headers['Connection'], 'keep-alive');
      }
    },
    'created with a secure URL': {
      topic: function() {
        var url = 'https://anonymous:xyzzy@www.example.com:8888/hello';
        this.callback(null, new Connector(url));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 8888);
        assert.strictEqual(connector.path, '/hello');
        assert.isTrue(connector.secure);
        assert.strictEqual(connector.username, 'anonymous');
        assert.strictEqual(connector.password, 'xyzzy');
      },
      'should have default option values': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.method, 'GET');
      },
      'should not define own properties for default option values': function(err, connector) {
        assert.isFalse(connector.hasOwnProperty('maxSockets'));
        assert.isFalse(connector.hasOwnProperty('method'));
      },
      'should have the secure socket': function(err, connector) {
        assert.strictEqual(connector.socket, https);
      },
      'should have an agent populated with the URL options': function(err, connector) {
        assert.deepEqual(connector.agent.options, { host: 'www.example.com', port: 8888 });
        assert.strictEqual(connector.agent.host, 'www.example.com');
        assert.strictEqual(connector.agent.port, 8888);
        assert.strictEqual(connector.agent.maxSockets, 8);
      },
      'should set default headers': function(err, connector) {
        assert.strictEqual(connector.headers['Host'], 'www.example.com');
        assert.strictEqual(connector.headers['Connection'], 'keep-alive');
      },
      'should have the basic authentication header': function(err, connector) {
        assert.strictEqual(connector.headers['Authorization'], 'Basic YW5vbnltb3VzOnh5enp5');
      }
    },
    'created with a secure URL with options': {
      topic: function() {
        var options = {
          url: 'https://anonymous:xyzzy@www.example.com:8888/hello',
          host: 'localhost',
          port: 9999,
          path: '/goodbye',
          username: undefined,
          password: undefined,
          secure: false
        };
        this.callback(null, new Connector(options));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.host, 'localhost');
        assert.strictEqual(connector.port, 9999);
        assert.strictEqual(connector.path, '/goodbye');
        assert.isUndefined(connector.username);
        assert.isUndefined(connector.password);
      },
      'should have default option values': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
      },
      'should not define own properties for default option values': function(err, connector) {
        assert.isFalse(connector.hasOwnProperty('maxSockets'));
        assert.isFalse(connector.hasOwnProperty('method'));
      },
      'should have the default socket': function(err, connector) {
        assert.strictEqual(connector.socket, http);
      },
      'should have an agent populated with the URL options': function(err, connector) {
        assert.deepEqual(connector.agent.options, { host: 'localhost', port: 9999 });
        assert.strictEqual(connector.agent.host, 'localhost');
        assert.strictEqual(connector.agent.port, 9999);
        assert.strictEqual(connector.agent.maxSockets, 8);
      },
      'should set default headers': function(err, connector) {
        assert.strictEqual(connector.headers['Host'], 'localhost');
        assert.strictEqual(connector.headers['Connection'], 'keep-alive');
      },
      'should not have the basic authentication header': function(err, connector) {
        assert.isUndefined(connector.headers['Authorization']);
      }
    },
    'created with a URL with https': {
      topic: function() {
        this.callback(null, new Connector('https://www.example.com'));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 5984);
        assert.strictEqual(connector.path, '/');
        assert.strictEqual(connector.method, 'GET');
        assert.isTrue(connector.secure);
        assert.isUndefined(connector.username);
        assert.isUndefined(connector.password);
      }
    },
    'created with a URL with username': {
      topic: function() {
        this.callback(null, new Connector('http://anonymous@www.example.com'));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 5984);
        assert.strictEqual(connector.path, '/');
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
        assert.strictEqual(connector.username, 'anonymous');
        assert.isUndefined(connector.password);
      },
      'should have the basic authentication header': function(err, connector) {
        assert.strictEqual(connector.headers['Authorization'], 'Basic YW5vbnltb3VzOg==');
      }
    },
    'created with a URL with username and password': {
      topic: function() {
        this.callback(null, new Connector('http://anonymous:xyzzy@www.example.com'));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 5984);
        assert.strictEqual(connector.path, '/');
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
        assert.strictEqual(connector.username, 'anonymous');
        assert.strictEqual(connector.password, 'xyzzy');
      },
      'should have the basic authentication header': function(err, connector) {
        assert.strictEqual(connector.headers['Authorization'], 'Basic YW5vbnltb3VzOnh5enp5');
      }
    },
    'created with a URL with username and password': {
      topic: function() {
        this.callback(null, new Connector('http://anonymous:xyzzy@www.example.com'));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 5984);
        assert.strictEqual(connector.path, '/');
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
        assert.strictEqual(connector.username, 'anonymous');
        assert.strictEqual(connector.password, 'xyzzy');
      },
      'should have the basic authentication header': function(err, connector) {
        assert.strictEqual(connector.headers['Authorization'], 'Basic YW5vbnltb3VzOnh5enp5');
      }
    },
    'created with a URL with port': {
      topic: function() {
        this.callback(null, new Connector('http://www.example.com:8080'));
      },
      'should parse and use the URL options': function(err, connector) {
        assert.strictEqual(connector.maxSockets, 8);
        assert.strictEqual(connector.host, 'www.example.com');
        assert.strictEqual(connector.port, 8080);
        assert.strictEqual(connector.path, '/');
        assert.strictEqual(connector.method, 'GET');
        assert.isFalse(connector.secure);
        assert.isUndefined(connector.username);
        assert.isUndefined(connector.password);
      }
    },
    'created with a URL with a custom socket': {
      topic: function() {
        var agent = {}
          , socket = { Agent: function() { return agent; } }
          , options = {
              url: 'http://anonymous:xyzzy@www.example.com:8888/hello',
              socket: socket
            };
        this.callback(null, new Connector(options), socket, agent);
      },
      'should use the given socket': function(err, connector, socket, agent) {
        assert.strictEqual(connector.socket, socket);
      },
      'should create the agent from the given socket': function(err, connector, socket, agent) {
        assert.strictEqual(connector.agent, agent);
        assert.strictEqual(connector.agent.maxSockets, connector.maxSockets);
      }
    },
    'created with a URL with a custom socket and agent': {
      topic: function() {
        var agent = {}
          , socket = { Agent: function() { return agent; } }
          , options = {
              url: 'http://anonymous:xyzzy@www.example.com:8888/hello',
              agent: agent,
              socket: socket
            };
        this.callback(null, new Connector(options), socket, agent);
      },
      'should use the given agent': function(err, connector, socket, agent) {
        assert.strictEqual(connector.agent, agent);
      },
      'should use the given socket': function(err, connector, socket, agent) {
        assert.strictEqual(connector.socket, socket);
      },
      'should not set the maxSockets on the given agent': function(err, connector, socket, agent) {
        assert.isUndefined(connector.agent.maxSockets);
      }
    },
    'created with a custom agent': {
      topic: function() {
        var agent = {}
          , options = { agent: agent };
        this.callback(null, new Connector(options), agent);
      },
      'should not use options.maxSockets': function(err, connector) {
        assert.isFalse(connector.hasOwnProperty('maxSockets'));
      },
      'should use the given agent': function(err, connector, agent) {
        assert.strictEqual(connector.agent, agent);
      }
    },
    'created with a custom socket': {
      topic: function() {
        var agent = {}
          , socket = { Agent: function() { return agent; } }
          , options = { socket: socket };
        this.callback(null, new Connector(options), socket, agent);
      },
      'should use the given socket': function(err, connector, socket, agent) {
        assert.strictEqual(connector.socket, socket);
      },
      'should create the agent from the given socket': function(err, connector, socket, agent) {
        assert.strictEqual(connector.agent, agent);
        assert.strictEqual(connector.agent.maxSockets, connector.maxSockets);
      }
    },
    'created with a custom socket and agent': {
      topic: function() {
        var agent = {}
          , socket = {}
          , options = { agent: agent, socket: socket };
        this.callback(null, new Connector(options), socket, agent);
      },
      'should use the given agent': function(err, connector, socket, agent) {
        assert.strictEqual(connector.agent, agent);
      },
      'should use the given socket': function(err, connector, socket, agent) {
        assert.strictEqual(connector.socket, socket);
      },
      'should not set the maxSockets on the given agent': function(err, connector, socket, agent) {
        assert.isUndefined(connector.agent.maxSockets);
      }
    }
  }
}).export(module);
