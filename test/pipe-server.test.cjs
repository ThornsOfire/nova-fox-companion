'use strict';

const net = require('node:net');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventServer } = require('../src/core/pipe-server.cjs');

test('accepts newline-delimited local events', async (context) => {
  const received = [];
  const pipeName = `nova-fox-companion-test-${process.pid}-${Date.now()}`;
  const server = createEventServer((payload) => received.push(payload), { pipeName });
  await server.listen();
  context.after(() => server.close());

  await new Promise((resolve, reject) => {
    const socket = net.createConnection(server.endpoint);
    socket.once('error', reject);
    socket.once('connect', () => {
      socket.end('{"hello":"world"}\n');
    });
    socket.once('close', resolve);
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(received, [{ hello: 'world' }]);
});


test('bridge survives disconnects and restarts, and a busy endpoint can be retried', async (t) => {
  const { probeBridge } = require('../src/core/integration-probe.cjs');
  const pipeName = `nova-lifecycle-${process.pid}-${Date.now()}`;
  const received = [];
  const first = createEventServer((event) => received.push(event), { pipeName });
  const second = createEventServer((event) => received.push(event), { pipeName });
  t.after(() => first.close()); t.after(() => second.close());
  assert.equal(await probeBridge(pipeName), false);
  await first.listen();
  assert.equal(await probeBridge(pipeName), true);
  await assert.rejects(second.listen());
  await first.close();
  assert.equal(await probeBridge(pipeName), false);
  await second.listen();
  for (const sequence of [1, 2]) {
    await new Promise((resolve, reject) => {
      const client = net.createConnection(second.endpoint);
      client.once('error', reject);
      client.once('connect', () => client.end(JSON.stringify({ sequence }) + '\n'));
      client.once('close', resolve);
    });
  }
  assert.deepEqual(received, [{ sequence: 1 }, { sequence: 2 }]);
  const client = net.createConnection(second.endpoint);
  await new Promise((resolve) => client.once('connect', resolve));
  await second.close(); // idle/abandoned clients cannot hang shutdown
  client.destroy();
});
