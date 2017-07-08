'use strict';
const common = require('../common');

const assert = require('assert');
const http = require('http');
const net = require('net');

const tests = [];

function test(fn) {
  if (!tests.length)
    process.nextTick(run);
  tests.push(common.mustCall(fn));
}

function run() {
  const fn = tests.shift();
  if (fn) {
    fn(run);
  }
}

test(function serverTimeout(cb) {
  const server = http.createServer((req, res) => {
    // Do nothing. We should get a timeout event.
    // Might not be invoked. Do not wrap in common.mustCall().
  });
  server.listen(common.mustCall(() => {
    const s = server.setTimeout(50, common.mustCall((socket) => {
      socket.destroy();
      server.close();
      cb();
    }));
    assert.ok(s instanceof http.Server);
    http.get({
      port: server.address().port
    }).on('error', common.mustCall());
  }));
});

test(function serverRequestTimeout(cb) {
  const server = http.createServer(common.mustCall((req, res) => {
    // just do nothing, we should get a timeout event.
    const s = req.setTimeout(50, common.mustCall((socket) => {
      socket.destroy();
      server.close();
      cb();
    }));
    assert.ok(s instanceof http.IncomingMessage);
  }));
  server.listen(common.mustCall(() => {
    const req = http.request({
      port: server.address().port,
      method: 'POST'
    });
    req.on('error', common.mustCall());
    req.write('Hello');
    // req is in progress
  }));
});

test(function serverResponseTimeout(cb) {
  const server = http.createServer(common.mustCall((req, res) => {
    // just do nothing, we should get a timeout event.
    const s = res.setTimeout(50, common.mustCall((socket) => {
      socket.destroy();
      server.close();
      cb();
    }));
    assert.ok(s instanceof http.OutgoingMessage);
  }));
  server.listen(common.mustCall(() => {
    http.get({
      port: server.address().port
    }).on('error', common.mustCall());
  }));
});

test(function serverRequestNotTimeoutAfterEnd(cb) {
  const server = http.createServer(common.mustCall((req, res) => {
    // just do nothing, we should get a timeout event.
    const s = req.setTimeout(50, common.mustNotCall());
    assert.ok(s instanceof http.IncomingMessage);
    res.on('timeout', common.mustCall());
  }));
  server.on('timeout', common.mustCall((socket) => {
    socket.destroy();
    server.close();
    cb();
  }));
  server.listen(common.mustCall(() => {
    http.get({
      port: server.address().port
    }).on('error', common.mustCall());
  }));
});

test(function serverResponseTimeoutWithPipeline(cb) {
  let caughtTimeout = '';
  let secReceived = false;
  process.on('exit', () => {
    assert.strictEqual(caughtTimeout, '/2');
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/2')
      secReceived = true;
    const s = res.setTimeout(50, () => {
      caughtTimeout += req.url;
    });
    assert.ok(s instanceof http.OutgoingMessage);
    if (req.url === '/1') res.end();
  });
  server.on('timeout', common.mustCall((socket) => {
    if (secReceived) {
      socket.destroy();
      server.close();
      cb();
    }
  }));
  server.listen(common.mustCall(() => {
    const options = {
      port: server.address().port,
      allowHalfOpen: true,
    };
    const c = net.connect(options, () => {
      c.write('GET /1 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      c.write('GET /2 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      c.write('GET /3 HTTP/1.1\r\nHost: localhost\r\n\r\n');
    });
  }));
});

test(function idleTimeout(cb) {
  const server = http.createServer(common.mustCall((req, res) => {
    req.on('timeout', common.mustNotCall());
    res.on('timeout', common.mustNotCall());
    res.end();
  }));
  const s = server.setTimeout(50, common.mustCall((socket) => {
    socket.destroy();
    server.close();
    cb();
  }));
  assert.ok(s instanceof http.Server);
  server.listen(common.mustCall(() => {
    const options = {
      port: server.address().port,
      allowHalfOpen: true,
    };
    const c = net.connect(options, () => {
      c.write('GET /1 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      // Keep-Alive
    });
  }));
});
