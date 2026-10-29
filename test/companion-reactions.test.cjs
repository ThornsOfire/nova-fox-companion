'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CompanionReactions } = require('../src/renderer/companion-reactions.js');
const { CompanionVoice } = require('../src/renderer/companion-voice.js');
const snapshot = (status, label = 'Agent') => ({ sessions: [{ id: 's', agents: [{ id: 'a', status, label }] }] });

test('bootstrap and metadata updates are silent; status changes expire', () => {
  const reactions = new CompanionReactions();
  reactions.observe(snapshot('working'), { now: 0 });
  assert.equal(reactions.get('s', 'a', 0), null);
  reactions.observe(snapshot('idle'), { now: 1 });
  const message = reactions.get('s', 'a', 1);
  assert.equal(message.text, 'Turn finished');
  assert.ok(message.quip);
  reactions.observe(snapshot('idle', 'Renamed'), { now: 2 });
  assert.equal(reactions.get('s', 'a', 2).id, message.id);
  assert.equal(reactions.get('s', 'a', 8001), null);
});

test('cooldown suppresses quips without losing input and stop notices', () => {
  const reactions = new CompanionReactions();
  reactions.observe(snapshot('idle'), { now: 0 });
  reactions.observe(snapshot('working'), { now: 1 });
  assert.ok(reactions.get('s', 'a', 1).quip);
  reactions.observe(snapshot('attention'), { now: 2 });
  assert.equal(reactions.get('s', 'a', 2).text, 'Needs your input');
  assert.equal(reactions.get('s', 'a', 2).quip, null);
  reactions.observe(snapshot('done'), { now: 3 });
  assert.equal(reactions.get('s', 'a', 3).text, 'Agent stopped');
  assert.equal(reactions.get('s', 'a', 3).quip, null);
});

test('disabled remarks clear current speech and never replay while reenabled', () => {
  const reactions = new CompanionReactions();
  reactions.observe(snapshot('working'), { now: 0 });
  reactions.observe(snapshot('idle'), { now: 1 });
  reactions.observe(snapshot('idle'), { now: 2, enabled: false });
  reactions.observe(snapshot('idle'), { now: 3 });
  assert.equal(reactions.get('s', 'a', 3), null);
  reactions.observe({ sessions: [] }, { now: 4 });
  assert.equal(reactions.previous.size, 0);
});

test('voice speaks only quips once; mute cancels and never queues a replay', () => {
  const spoken = [];
  let cancellations = 0;
  const voice = new CompanionVoice({
    synthesis: { speak: (value) => spoken.push(value.text), cancel: () => cancellations++ },
    createUtterance: (text) => ({ text }), now: () => 10,
  });
  voice.setMuted(false);
  assert.equal(voice.offer({ id: 'status', text: 'Needs your input', expiresAt: 100 }), false);
  const quip = { id: 'quip', quip: 'I supervised.', expiresAt: 100 };
  assert.equal(voice.offer(quip), true);
  assert.equal(voice.offer(quip), false);
  voice.setMuted(true);
  const muted = { ...quip, id: 'muted' };
  assert.equal(voice.offer(muted), false);
  voice.setMuted(false);
  assert.equal(voice.offer(muted), false);
  assert.deepEqual(spoken, ['I supervised.']);
  assert.equal(cancellations, 1);
});

test('busy or unavailable voices skip remarks instead of accumulating a queue', () => {
  const voice = new CompanionVoice({ synthesis: { speaking: true }, createUtterance: () => assert.fail(), now: () => 0 });
  voice.setMuted(false);
  assert.equal(voice.offer({ id: 'busy', quip: 'Hello', expiresAt: 100 }), false);
  const absent = new CompanionVoice({ synthesis: null, createUtterance: () => assert.fail() });
  absent.setMuted(false);
  assert.equal(absent.offer({ id: 'absent', quip: 'Hello', expiresAt: Infinity }), false);
});
