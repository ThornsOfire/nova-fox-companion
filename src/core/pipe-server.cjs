'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { PIPE_NAME } = require('./constants.cjs');

function endpointForName(pipeName = PIPE_NAME) {
  if (process.platform === 'win32') return `\\\\.\\pipe\\${pipeName}`;
  return path.join(os.tmpdir(), `${pipeName}.sock`);
}

function createEventServer(onPayload, options = {}) {
  const endpoint = endpointForName(options.pipeName);
  const maxBytes = options.maxBytes ?? 64 * 1024;
  let server;
  let listening = false;
  const sockets = new Set();

  async function listen() {
    if (listening) return endpoint;
    if (server) throw new Error('Bridge startup already in progress.');
    // Never unlink an endpoint owned by another running companion.

    server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
      socket.setEncoding('utf8');
      let buffer = '';

      socket.on('data', (chunk) => {
        buffer += chunk;
        if (Buffer.byteLength(buffer, 'utf8') > maxBytes) {
          socket.destroy();
          return;
        }

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          try {
            onPayload(JSON.parse(line));
          } catch {
            // Invalid local events are ignored. Hooks must never affect Codex.
          }
        }
      });

      socket.on('end', () => {
        const line = buffer.trim();
        if (!line) return;
        try {
          onPayload(JSON.parse(line));
        } catch {
          // See the deliberately silent behavior above.
        }
      });
    });

    await new Promise((resolve, reject) => {
      server.once('error', (error) => { server = null; reject(error); });
      server.listen(endpoint, () => {
        listening = true;
        server.removeAllListeners('error');
        server.on('error', () => { listening = false; });
        resolve();
      });
    });

    return endpoint;
  }

  async function close() {
    if (!server) return;
    const current = server;
    server = null; listening = false;
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => current.close(resolve));
    // Never unlink an endpoint owned by another running companion.
  }

  return { listen, close, endpoint };
}

module.exports = {
  createEventServer,
  endpointForName,
};
