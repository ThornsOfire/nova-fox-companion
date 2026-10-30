'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the renderer's actual selector without starting an app or touching profiles.
const source = fs.readFileSync(path.join(__dirname, '../src/renderer/overlay.js'), 'utf8');
const selector = source.slice(source.indexOf('function animationFor('), source.indexOf('function applySpriteFrame('));
const animations = Object.fromEntries(['carried', 'waiting', 'wave', 'review', 'sleep', 'idle', 'left', 'right', 'working'].map(name => [name, name]));
function select({ status = 'working', mood, vx = 0, moving = true, dragging = false } = {}) {
  const actor = { avatar: { frameAtlas: {} }, dragging, agent: { status }, velocityX: vx,
    playState: { mode: 'roam' }, awakeUntil: Infinity };
  return vm.runInNewContext(`${selector}\nanimationFor(actor, moving)`, {
    actor, moving, animations, reactions: { get: () => mood ? { mood } : null }, chatActor: null,
  });
}

test('travel uses running frames despite attention, completion, or reaction poses', () => {
  for (const status of ['working', 'attention', 'done', 'idle', 'dormant']) {
    for (const mood of [undefined, 'proud', 'amused', 'curious']) {
      assert.equal(select({ status, mood, vx: 30 }), 'right');
      assert.equal(select({ status, mood, vx: -30 }), 'left');
    }
  }
});

test('vertical and nearly vertical travel never fall back to a seated pose', () => {
  for (const vx of [0, 0.1, 3.9]) assert.equal(select({ vx }), 'right');
  for (const vx of [-0.1, -3.9]) assert.equal(select({ vx }), 'left');
});

test('stationary status poses and explicit pickup still work', () => {
  assert.equal(select({ moving: false }), 'working');
  assert.equal(select({ moving: false, status: 'attention' }), 'waiting');
  assert.equal(select({ moving: false, mood: 'proud' }), 'wave');
  assert.equal(select({ moving: false, mood: 'curious' }), 'review');
  assert.equal(select({ dragging: true }), 'carried');
});
