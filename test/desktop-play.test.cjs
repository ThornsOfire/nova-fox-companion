'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { covers, blockedDisplays, safeZones, PlayState, escapeTarget, intersects } = require('../src/renderer/desktop-play.js');
const { cleanWindows } = require('../src/core/desktop-sensor.cjs');
const { readAvatarPackage } = require('../src/core/avatar-library.cjs');
const { readPngDimensions, validateFrameAtlas } = require('../src/core/frame-atlas.cjs');
const path = require('node:path');
const base = { now: 10000, idleMs: 8000, moved: false, reduced: false, interacting: false, nearCursor: true, canPeek: true };

test('fullscreen covers monitor bounds, maximized work-area windows do not', () => {
  const bounds = { x: -1920, y: 0, width: 1920, height: 1080 };
  assert.equal(covers(bounds, bounds), true);
  assert.equal(covers({ ...bounds, height: 1040 }, bounds), false);
  assert.equal(covers({ x: -1922, y: -2, width: 1924, height: 1084 }, bounds), true);
  const displays = [{ bounds }, { bounds: { ...bounds, x: 0 } }];
  assert.deepEqual(blockedDisplays([bounds], displays), [bounds]);
});

test('fullscreen exclusion removes only occupied display regions, including custom spanning zones', () => {
  const zone = { x: -1920, y: 0, width: 3840, height: 1080 };
  const blocked = { x: 0, y: 0, width: 1920, height: 1080 };
  const safe = safeZones([zone], [blocked]);
  assert.deepEqual(safe, [{ x: -1920, y: 0, width: 1920, height: 1080 }]);
  assert.equal(safe.some((rect) => intersects(rect, blocked)), false);
  assert.deepEqual(safeZones([zone], [zone]), []);
});

test('rectangle subtraction preserves all remaining area without overlaps', () => {
  const zone = { x: 0, y: 0, width: 1000, height: 800 };
  const blocked = { x: 200, y: 150, width: 400, height: 300 };
  const safe = safeZones([zone], [blocked]);
  assert.equal(safe.reduce((area, rect) => area + rect.width * rect.height, 0), 800000 - 120000);
  for (const [index, rect] of safe.entries()) {
    assert.equal(intersects(rect, blocked), false);
    for (const other of safe.slice(index + 1)) assert.equal(intersects(rect, other), false);
  }
});

test('idle cursor play stops as soon as real cursor movement is reported', () => {
  const state = new PlayState();
  assert.equal(state.update(base), 'pounce');
  assert.equal(state.update({ ...base, now: 10010, moved: true, idleMs: 0 }), 'roam');
  assert.equal(state.update({ ...base, now: 15000 }), 'roam');
});

test('Nova can stalk an idle cursor before pouncing and will not follow it onto an unavailable screen', () => {
  const state = new PlayState();
  assert.equal(state.update({ ...base, nearCursor: false, canPeek: false, cursorAvailable: true }), 'stalk');
  assert.equal(state.update({ ...base, now: 11000, nearCursor: true }), 'pounce');
  const unavailable = new PlayState();
  assert.equal(unavailable.update({ ...base, nearCursor: false, canPeek: false, cursorAvailable: false }), 'roam');
});

test('repeated pickups trigger a bounded escape and preserve the ability to grab again', () => {
  const state = new PlayState();
  for (let index = 0; index < 3; index++) { state.pickup(1000 + index * 100); state.drop(1050 + index * 100); }
  assert.equal(state.mode, 'escape');
  assert.equal(state.update({ ...base, now: 2000, moved: true }), 'escape');
  assert.equal(state.update({ ...base, now: 6000, moved: true }), 'roam');
  state.pickup(6100); assert.equal(state.mode, 'carried');
  assert.equal(state.drop(6200), 'roam');
});

test('isolated pickups do not accumulate forever; reduced motion and chat suppress play', () => {
  const state = new PlayState();
  state.pickup(0); state.drop(10); state.pickup(20000); state.drop(20010);
  assert.equal(state.mode, 'roam');
  assert.equal(state.update({ ...base, now: 40000, reduced: true }), 'roam');
  assert.equal(state.update({ ...base, now: 40000, interacting: true }), 'roam');
});

test('peek times out and escape picks a corner away from the cursor on the same screen', () => {
  const state = new PlayState();
  assert.equal(state.update({ ...base, nearCursor: false }), 'peek');
  assert.equal(state.update({ ...base, now: 15000, nearCursor: false }), 'roam');
  const target = escapeTarget({ x: 0, y: 0 }, { size: 100 }, { x: 0, y: 0, width: 1000, height: 800 });
  assert.ok(target.x > 800 && target.y > 600);
});

test('sensor strips titles and command lines, keeping only bounded local app identifiers', () => {
  const value = cleanWindows([{ x: 100, y: 200, width: 800, height: 600, id: 'window', title: 'private', command: 'private' },
    { x: 0, y: 0, width: -1, height: 30 }, null], (rect) => ({ ...rect, x: rect.x / 2, width: rect.width / 2 }));
  assert.deepEqual(value, [{ x: 50, y: 200, width: 400, height: 600, id: 'window', app: 'unknown', foreground: false }]);
});

test('bundled Nova frames match the unmodified PNG and remain inside its bounds', async () => {
  const directory = path.join(__dirname, '..', 'assets', 'avatars', 'nova-spirit-fox');
  const record = await readAvatarPackage(directory, 'bundled');
  const size = await readPngDimensions(record.spritesheetPath);
  assert.deepEqual(size, { width: record.frameAtlas.width, height: record.frameAtlas.height });
  assert.equal(record.frameAtlas.animations.sleep.length, 5);
  await assert.rejects(readAvatarPackage(directory, 'custom'), /restricted/);
  const invalid = structuredClone(record.frameAtlas);
  invalid.animations.sleep[0].x = 999999;
  assert.throws(() => validateFrameAtlas(invalid), /Invalid frame/);
});
