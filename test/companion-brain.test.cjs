'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { CompanionBrain, CompanionKeyStore, CompanionMemory, requestReaction, validateReaction, reservationFor } = require('../src/core/companion-brain.cjs');
const { normalizeSettings } = require('../src/core/settings-store.cjs');
const storage = { isEncryptionAvailable: () => true, encryptString: (value) => Buffer.from(`sealed:${value}`),
  decryptString: (value) => { const text = value.toString(); if (!text.startsWith('sealed:')) throw new Error(); return text.slice(7); } };
const snapshot = (status) => ({ sessions: [{ id: 'session', agents: [{ id: 'agent', status }] }] });

async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-brain-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let time = Date.UTC(2026, 9, 29, 20);
  const settings = normalizeSettings({ companionCloudEnabled: true });
  const memory = new CompanionMemory(path.join(directory, 'memory.json'), storage);
  const emitted = [];
  const calls = [];
  const brain = new CompanionBrain({ directory, keys: { read: async () => 'fake-key', available: () => true },
    memory, getSettings: () => settings, emit: (value) => emitted.push(value), now: () => time,
    request: async (input) => { calls.push(input); return { quip: 'An excellent time for a tail inspection.', mood: 'amused' }; },
    ...overrides });
  await brain.load();
  return { brain, settings, memory, emitted, calls, directory, advance: (ms) => { time += ms; } };
}

test('key storage refuses plaintext fallback and never returns key via status', async (t) => {
  const f = await fixture(t);
  const keys = new CompanionKeyStore(path.join(f.directory, 'key.json'), storage);
  await keys.save('sk-test-1234567890');
  assert.equal(await keys.read(), 'sk-test-1234567890');
  const insecure = new CompanionKeyStore(keys.file, { ...storage, getSelectedStorageBackend: () => 'basic_text' });
  await assert.rejects(insecure.save('sk-test-1234567890'));
  assert.equal(await insecure.read(), null);
  assert.equal(JSON.stringify(await f.brain.status()).includes('fake-key'), false);
  await keys.remove();
  assert.equal(await keys.read(), null);
});

test('disabled cloud never calls the provider; cooldown and persisted cap apply to previews', async (t) => {
  const f = await fixture(t);
  f.settings.companionCloudEnabled = false;
  assert.ok((await f.brain.generate()).skipped);
  assert.equal(f.calls.length, 0);
  f.settings.companionCloudEnabled = true;
  f.settings.companionDailyRequests = 1;
  assert.ok((await f.brain.generate()).quip);
  assert.ok((await f.brain.generate()).skipped);
  f.advance(60000);
  const restarted = new CompanionBrain({ directory: f.directory, keys: f.brain.keys,
    memory: f.memory, getSettings: () => f.settings, emit: () => {}, now: f.brain.now,
    request: () => assert.fail('daily cap must survive restart') });
  await restarted.load();
  assert.match((await restarted.generate()).skipped, /Daily/);
});

test('model changes use different reservations; limit blocks before transmission', async (t) => {
  const f = await fixture(t);
  assert.ok(reservationFor('gpt-6.1-sol') > reservationFor('gpt-6-luna'));
  f.settings.companionModel = 'gpt-6.1-sol';
  f.settings.companionDailyBudgetUsd = 0.001;
  assert.ok((await f.brain.generate()).skipped);
  assert.equal(f.calls.length, 0);
});

test('direct chat bypasses spontaneous cooldown but still obeys the daily cap', async (t) => {
  const f = await fixture(t);
  f.settings.companionDailyRequests = 2;
  assert.ok((await f.brain.generate(null, 'Hello')).quip);
  assert.ok((await f.brain.generate()).skipped);
  assert.ok((await f.brain.generate(null, 'And hello again')).quip);
  assert.ok((await f.brain.generate(null, 'One more?')).skipped);
  assert.equal(f.calls.length, 2);
});

test('settings cancellation discards an in-flight preview without saving memory', async (t) => {
  let resolve;
  let started;
  const ready = new Promise((done) => { started = done; });
  const f = await fixture(t, { request: () => { started(); return new Promise((done) => { resolve = done; }); } });
  const pending = f.brain.generate();
  await ready;
  f.brain.cancel();
  resolve({ quip: 'Cancelled', mood: 'sleepy' });
  assert.ok((await pending).skipped);
  assert.deepEqual((await f.memory.read()).turns, []);
});

test('failures count against daily usage and expose no provider error details', async (t) => {
  const f = await fixture(t, { request: async () => { throw new Error('secret-token'); } });
  assert.equal(JSON.stringify(await f.brain.generate()).includes('secret-token'), false);
  assert.equal(f.brain.usage.requests, 1);
  const ledger = JSON.parse(await fs.readFile(f.brain.file, 'utf8'));
  assert.equal(ledger.requests, 1);
});

test('stale replies and cancelled requests do not emit or enter memory', async (t) => {
  let resolve;
  let started;
  const ready = new Promise((done) => { started = done; });
  const f = await fixture(t, { request: () => { started(); return new Promise((done) => { resolve = done; }); } });
  f.brain.observe(snapshot('working'));
  const pending = f.brain.generate({ sessionId: 'session', agentId: 'agent', key: 'session/agent', status: 'working' });
  await ready;
  f.brain.observe(snapshot('attention'));
  resolve({ quip: 'Too late', mood: 'curious' });
  assert.ok((await pending).skipped);
  assert.equal(f.emitted.length, 0);
  assert.deepEqual((await f.memory.read()).turns, []);
});

test('conversation and personal notes survive restart, clear together, and bound history', async (t) => {
  const f = await fixture(t);
  await f.memory.notes('My name is Robbie. I make music.');
  await f.brain.generate(null, 'I love Cubase.');
  const memory = new CompanionMemory(f.memory.file, storage);
  assert.equal((await memory.read()).turns[0].text, 'I love Cubase.');
  f.advance(60000);
  await f.brain.generate(null, 'What DAW do I like?');
  assert.match(f.calls[1].memory.notes, /Robbie/);
  assert.equal(f.calls[1].memory.turns[0].text, 'I love Cubase.');
  const full = { notes: '', turns: Array.from({ length: 100 }, () => ({ role: 'assistant', text: 'Old quip' })) };
  await memory.write(full);
  await memory.append('Newest message', 'Newest reply');
  assert.equal((await memory.read()).turns.length, 100);
  assert.equal((await memory.read()).turns.at(-1).text, 'Newest reply');
  await memory.clear();
  assert.deepEqual(await memory.read(), { notes: '', turns: [] });
});

test('corrupt usage ledger fails closed', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(f.brain.file, 'broken');
  await f.brain.load();
  assert.ok((await f.brain.generate()).skipped);
  assert.equal(f.calls.length, 0);
});

test('window capture requires opt-in and a peek cue; ordinary chat never captures', async (t) => {
  let captures = 0;
  const f = await fixture(t, { capture: async () => { captures++; return 'synthetic-image'; } });
  await f.brain.generate(null, null, 'peeking', '123');
  assert.equal(captures, 0);
  f.advance(60000); f.settings.companionVisionEnabled = true;
  await f.brain.generate(null, 'Hello Nova', 'peeking', '123');
  assert.equal(captures, 0);
  f.advance(60000);
  await f.brain.generate(null, null, 'peeking', '123');
  assert.equal(captures, 1);
  assert.equal(f.calls.at(-1).screenshot, 'synthetic-image');
});

test('Pacific midnight resets the durable budget', async (t) => {
  const f = await fixture(t);
  f.settings.companionDailyRequests = 1;
  await f.brain.generate();
  const day = f.brain.usage.day;
  f.advance(24 * 3600 * 1000);
  await f.brain.generate();
  assert.notEqual(f.brain.usage.day, day);
  assert.equal(f.brain.usage.requests, 1);
});

test('provider sends chosen model and explicit memory only, and validates bounded JSON', async () => {
  let captured;
  const result = await requestReaction({ key: 'fake', status: 'idle', personality: 'dry', language: 'en',
    model: 'gpt-6.1-terra', memory: { notes: 'Robbie', turns: [] }, chat: 'Hello',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.redirect, 'error');
      captured = JSON.parse(options.body);
      return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify({ quip: 'Hello, Robbie.', mood: 'amused' }) }] }] }) };
    } });
  assert.equal(captured.model, 'gpt-6.1-terra');
  assert.equal(captured.store, false);
  assert.equal(JSON.parse(captured.input).notes, 'Robbie');
  assert.equal(result.quip, 'Hello, Robbie.');
  assert.throws(() => validateReaction({ quip: 'x'.repeat(181), mood: 'amused' }));
  assert.throws(() => validateReaction({ quip: '<script>', mood: 'amused' }));
  assert.throws(() => validateReaction({ quip: 'Hi', mood: 'unknown' }));
  await assert.rejects(requestReaction({ key: 'fake', model: 'unknown' }));
});

test('model and personality settings reject arbitrary values and retain limits', () => {
  const value = normalizeSettings({ companionModel: 'anything', companionPersonality: 'anything',
    companionCooldownSeconds: 0, companionDailyRequests: 99999 });
  assert.equal(value.companionModel, 'gpt-6-luna');
  assert.equal(value.companionPersonality, 'playful');
  assert.equal(value.companionCooldownSeconds, 20);
  assert.equal(value.companionDailyRequests, 500);
});
