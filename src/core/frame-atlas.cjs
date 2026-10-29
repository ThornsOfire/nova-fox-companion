'use strict';
const fs = require('node:fs/promises');
const REQUIRED = ['idle', 'right', 'left', 'wave', 'sleep', 'carried', 'waiting', 'working', 'review'];
function validateFrameAtlas(value) {
  if (!value || value.format !== 'nova-frames-v1' || !Number.isInteger(value.width) || !Number.isInteger(value.height)
    || value.width < 1 || value.height < 1 || value.width > 4096 || value.height > 4096) throw new Error('Invalid Nova frame atlas');
  const animations = {};
  for (const name of REQUIRED) {
    const frames = value.animations?.[name];
    if (!Array.isArray(frames) || frames.length < 1 || frames.length > 16) throw new Error(`Missing frames: ${name}`);
    animations[name] = frames.map((frame) => {
      if (!['x', 'y', 'width', 'height', 'duration'].every((key) => Number.isInteger(frame[key]))
        || frame.x < 0 || frame.y < 0 || frame.width < 1 || frame.height < 1
        || frame.x + frame.width > value.width || frame.y + frame.height > value.height
        || frame.duration < 50 || frame.duration > 5000) throw new Error(`Invalid frame: ${name}`);
      return { x: frame.x, y: frame.y, width: frame.width, height: frame.height, duration: frame.duration };
    });
  }
  return { format: value.format, width: value.width, height: value.height, animations };
}
async function readPngDimensions(file) {
  const handle = await fs.open(file, 'r');
  try {
    const bytes = Buffer.alloc(24); const { bytesRead } = await handle.read(bytes, 0, 24, 0);
    if (bytesRead !== 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } finally { await handle.close(); }
}
module.exports = { validateFrameAtlas, readPngDimensions };
