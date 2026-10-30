'use strict';

const net = require('node:net');
const { endpointForName } = require('./pipe-server.cjs');

// A bounded local connection only: no payload, process launch, or profile scan.
function probeBridge(pipeName = 'codex-avatars-v1', timeout = 200) {
  return new Promise((resolve) => {
    const socket = net.createConnection(endpointForName(pipeName));
    const finish = (active) => { socket.destroy(); resolve(active); };
    socket.setTimeout(timeout, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

module.exports = { probeBridge };
