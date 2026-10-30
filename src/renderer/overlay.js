'use strict';

const api = window.novaFoxCompanion;
const world = document.querySelector('#world');
const topology = window.NovaFoxCompanionTopology;
const labelLayout = window.NovaFoxCompanionLabelLayout.labelLayout;
const assignAvatars = window.NovaFoxCompanionAssignment.assignAvatars;
const actors = new Map();
const renderClock = new window.NovaOverlayPerformance.FrameClock();
const animationClock = new window.NovaOverlayPerformance.AnimationClock();
let surface = null, surfacePending = false, surfaceFailed = false, surfaceCheckedAt = 0, surfaceGeneration = 0;
function applySurface(value) {
  surface = value;
  world.style.width = `${value.world.width}px`; world.style.height = `${value.world.height}px`;
  world.style.left = `${-value.x}px`; world.style.top = `${-value.y}px`;
  world.style.right = 'auto'; world.style.bottom = 'auto';
}
function updateSurface() {
  if (!api.setOverlaySurface || !surface || surfacePending || surfaceFailed) return;
  if (!draggedActor && performance.now()-surfaceCheckedAt<100) return;
  surfaceCheckedAt=performance.now();
  const elements = [...world.querySelectorAll('.avatar, .companion-spirit, .companion-bubble:not([hidden]), .companion-chat:not([hidden]), .cursor-decoy:not([hidden])')];
  const rects = elements.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0)
    .map(r=>({ x:r.x+surface.x,y:r.y+surface.y,width:r.width,height:r.height }));
  const desired=window.NovaOverlayPerformance.fitSurface(rects,surface.world,surface,Boolean(draggedActor));
  if (['x','y','width','height'].every(key=>desired[key]===surface[key])) return;
  surfacePending = true;
  const generation=surfaceGeneration, full=Boolean(draggedActor);
  void api.setOverlaySurface({ rects, full, world:surface.world }).then(value=>{
    if (generation===surfaceGeneration&&!value.stale) applySurface(value);
  }).catch(()=>{
    surfaceFailed=true;void api.setOverlaySurface({rects:[],full:true,world:surface.world}).then(applySurface).catch(()=>{});
  })
    .finally(()=>{
      surfacePending=false;
      if(generation!==surfaceGeneration||full!==Boolean(draggedActor)){surfaceCheckedAt=0;updateSurface();}
    });
}
const reactions = new window.NovaCompanion.CompanionReactions();
const voice = new window.NovaCompanionVoice.CompanionVoice({
  synthesis: window.speechSynthesis,
  requestSpeech: (message) => api.speakQuip(message),
  createAudio: (source) => new Audio(source),
  onError: (text) => { if (chatActor) chatActor.chat.querySelector('.chat-status').textContent = text; },
  createUtterance: (text) => new SpeechSynthesisUtterance(text),
});
const animations = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  sleep: { row: 4, durations: [650, 650, 650, 650, 650] },
  carried: { row: 5, durations: [180, 180, 180, 180, 180, 180, 180, 180] },
  right: { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  left: { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  wave: { row: 3, durations: [140, 140, 140, 280] },
  waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
  working: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, durations: [150, 150, 150, 150, 150, 280] },
};

let snapshot = { sessions: [] };
let settings = null;
let avatars = [];
let zone = null;
let zoneSignature = null;
let previousFrame = performance.now();
let lastHitTest = null;
let lastControlHitTest = null;
let draggedActor = null;
let dragOffset = { x: 0, y: 0 };
let desktop = null;
let chatActor = null;
let latestMessage = null;
let awaitingName = false;
let firstIntroduction = null;
function renderNameState(actor) {
  actor.chatInput.placeholder = awaitingName ? 'What should I call you?' : 'Talk to Nova…';
  actor.chatInput.setAttribute('aria-label', awaitingName ? 'Your preferred name' : 'Message Nova');
  actor.chatSend.textContent = awaitingName ? 'Save name' : 'Send';
}
function showIntroduction(text) {
  awaitingName = true;
  firstIntroduction = { id: 'nova:introduction', text, source: 'nova', expiresAt: Number.MAX_SAFE_INTEGER, silent: true };
  remember(firstIntroduction);
  for (const actor of actors.values()) renderNameState(actor);
}
const history = [];
const historyIds = new Set();
let lastPlayRemark = -Infinity;
const play = window.NovaDesktopPlay;
const decoy = document.createElement('span');
decoy.className = 'cursor-decoy'; decoy.textContent = '➤'; decoy.hidden = true;
world.append(decoy);

function remember(message) {
  if (!message || historyIds.has(message.id)) return;
  historyIds.add(message.id); history.push(message); latestMessage = message;
  while (history.length > 30) historyIds.delete(history.shift().id);
  for (const actor of actors.values()) renderHistory(actor);
}

function renderHistory(actor) {
  if (!actor.historyLog) return;
  actor.historyLog.replaceChildren();
  for (const message of history) {
    const line = document.createElement('button');
    line.type = 'button'; line.className = 'history-message';
    line.textContent = `${message.source === 'agent' ? (message.speaker || 'Agent') : message.source === 'you' ? 'You' : 'Nova'}: ${message.quip || message.text}`;
    line.title = message.source === 'agent' ? 'Open this agent chat' : 'Open the full Nova chat';
    line.addEventListener('click', () => {
      if (message.source === 'agent' && message.sessionId) void api.openAgentChat(message.sessionId);
      else void api.openFullChat();
    });
    actor.historyLog.append(line);
  }
  actor.historyLog.scrollTop = actor.historyLog.scrollHeight;
}

function closeChat() {
  if (!chatActor) return;
  chatActor.chat.hidden = true; chatActor.spirit.setAttribute('aria-expanded', 'false');
  chatActor = null; void api.setChatFocus(false);
}

async function playRemark(cue, actor) {
  if (!settings?.companionRemarks || Date.now() - lastPlayRemark < 20000) return;
  lastPlayRemark = Date.now();
  let result;
  if (settings.companionCloudEnabled) result = await api.playReaction(cue, cue === 'peeking' ? actor.peekWindowId : null);
  else {
    const lines = { moved: 'Ah. An unscheduled relocation.', escaped: 'My personal space has entered its running era.',
      peeking: 'This is an observational position.', cursor_play: 'The tiny arrow has chosen a worthy opponent.' };
    result = { quip: lines[cue], mood: 'amused', id: `play:${Date.now()}`, expiresAt: Date.now() + 8000 };
  }
  if (!result?.quip || !actors.has(actor.id) || !desktop?.safeZones.length || actor.dragging
    || (cue === 'peeking' && actor.playState.mode !== 'peek')
    || (cue === 'escaped' && actor.playState.mode !== 'escape')
    || (cue === 'cursor_play' && actor.playState.mode !== 'pounce')) return;
  remember({ ...result, text: '', source: 'nova' });
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function nextRandom(actor) {
  actor.randomState = (Math.imul(actor.randomState, 1664525) + 1013904223) >>> 0;
  return actor.randomState / 0x100000000;
}

function viewportZones() {
  const width = surface?.world.width || window.innerWidth, height = surface?.world.height || window.innerHeight;
  const source = desktop ? desktop.safeZones : zone?.zones?.length
    ? zone.zones
    : [{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }];
  const visible = source.map((rectangle) => {
    const x = Math.max(0, rectangle.x);
    const y = Math.max(0, rectangle.y);
    const right = Math.min(width, rectangle.x + rectangle.width);
    const bottom = Math.min(height, rectangle.y + rectangle.height);
    return { x, y, width: right - x, height: bottom - y, monitorBounds: rectangle.monitorBounds, monitorScale: rectangle.monitorScale || 1 };
  }).filter((rectangle) => rectangle.width >= 72 && rectangle.height >= 72);
  return visible.length > 0
    ? visible
    : [{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }];
}

function actorScale(agent) {
  const actor = actors.get(agent?.id);
  return viewportZones()[actor?.zoneIndex || 0]?.monitorScale || 1;
}

function avatarSizeFor(agent) {
  return actorScale(agent) * (agent?.isRoot
    ? (settings?.mainAvatarSize || 118)
    : (settings?.subagentAvatarSize || 118));
}

function detailsFor(agent) {
  return [agent?.model, agent?.effort].filter(Boolean).join(' · ');
}

function layoutFor(agent) {
  return labelLayout(settings, Boolean(detailsFor(agent)));
}

function randomPoint(actor, selected) {
  const size = avatarSizeFor(actor.agent);
  const labelSpace = layoutFor(actor.agent).space;
  const usableWidth = Math.max(1, selected.width - size);
  const usableHeight = Math.max(1, selected.height - (size * 1.08334) - labelSpace);
  return {
    x: selected.x + nextRandom(actor) * usableWidth,
    y: selected.y + nextRandom(actor) * usableHeight,
  };
}

function actorHeight(actor) {
  const size = avatarSizeFor(actor.agent);
  return size * 1.08334 + layoutFor(actor.agent).height;
}

function safeArea(actor, selected) {
  const size = avatarSizeFor(actor.agent);
  const sidePadding = layoutFor(actor.agent).sidePadding;
  const height = actorHeight(actor);
  return {
    minX: selected.x + sidePadding,
    maxX: Math.max(selected.x + sidePadding, selected.x + selected.width - size - sidePadding),
    minY: Math.min(selected.y + 56, Math.max(selected.y, selected.y + selected.height - height)),
    maxY: Math.max(selected.y, selected.y + selected.height - height),
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

function portalPoint(actor, edge, fromZone, toZone) {
  const from = safeArea(actor, fromZone);
  const to = safeArea(actor, toZone);
  if (edge.axis === 'x') {
    const minY = Math.max(from.minY, to.minY);
    const maxY = Math.min(from.maxY, to.maxY);
    return {
      x: edge.boundary - avatarSizeFor(actor.agent) / 2,
      y: clamp(actor.y, minY, Math.max(minY, maxY)),
    };
  }
  const minX = Math.max(from.minX, to.minX);
  const maxX = Math.min(from.maxX, to.maxX);
  return {
    x: clamp(actor.x, minX, Math.max(minX, maxX)),
    y: edge.boundary - actorHeight(actor) / 2,
  };
}

function activateNextWaypoint(actor) {
  const waypoint = actor.route.shift();
  if (!waypoint) return false;
  actor.targetX = waypoint.x;
  actor.targetY = waypoint.y;
  actor.targetZoneIndex = waypoint.zoneIndex;
  actor.transition = waypoint.transition || null;
  actor.targetAt = performance.now() + Math.hypot(actor.targetX - actor.x, actor.targetY - actor.y) / Math.max(1, actor.speed * .5) * 1000 + 5000 + nextRandom(actor) * 3000;
  return true;
}

function nextReachableZone(zones, start) {
  for (let offset = 1; offset < zones.length; offset += 1) {
    const candidate = (start + offset) % zones.length;
    if (topology.findZonePath(zones, start, candidate)) return candidate;
  }
  return start;
}

function chooseTarget(actor, options = {}) {
  const zones = viewportZones();
  if (!Number.isInteger(actor.zoneIndex)) actor.zoneIndex = (options.initialIndex || 0) % zones.length;
  actor.zoneIndex %= zones.length;
  const targetZoneIndex = options.cycleZone && zones.length > 1
    ? nextReachableZone(zones, actor.zoneIndex)
    : actor.zoneIndex;
  const selected = zones[targetZoneIndex] || zones[0];
  const target = randomPoint(actor, selected);
  actor.route = [];
  actor.transition = null;

  if (options.immediate) {
    actor.zoneIndex = targetZoneIndex;
    actor.targetZoneIndex = targetZoneIndex;
    actor.x = target.x;
    actor.y = target.y;
    actor.targetX = target.x;
    actor.targetY = target.y;
    actor.targetAt = performance.now() + Math.hypot(actor.targetX - actor.x, actor.targetY - actor.y) / Math.max(1, actor.speed * .5) * 1000 + 5000 + nextRandom(actor) * 3000;
    return;
  }

  const path = topology.findZonePath(zones, actor.zoneIndex, targetZoneIndex);
  if (!path || path.length === 1) {
    actor.targetX = target.x;
    actor.targetY = target.y;
    actor.targetZoneIndex = actor.zoneIndex;
    actor.targetAt = performance.now() + Math.hypot(actor.targetX - actor.x, actor.targetY - actor.y) / Math.max(1, actor.speed * .5) * 1000 + 5000 + nextRandom(actor) * 3000;
    return;
  }

  let finalTransition = null;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const edge = topology.sharedEdge(zones[from], zones[to]);
    if (!edge) continue;
    finalTransition = { from, to, edge };
    actor.route.push({
      ...portalPoint(actor, edge, zones[from], zones[to]),
      zoneIndex: to,
      transition: finalTransition,
    });
  }
  actor.route.push({ ...target, zoneIndex: targetZoneIndex, transition: finalTransition });
  activateNextWaypoint(actor);
}

function activeAvatarRecords() {
  if (!settings) return [];
  const enabled = new Set(settings.enabledAvatarIds || []);
  return avatars.filter((avatar) => enabled.has(avatar.id));
}

function flattenAgents() {
  if (settings?.singleCompanion) {
    const peers = (snapshot.sessions || []).flatMap((session) => session.agents || []);
    const status = peers.some((agent) => agent.status === 'attention') ? 'attention'
      : peers.some((agent) => agent.status === 'working') ? 'working' : 'idle';
    return [{ id: 'nova-resident', sessionId: 'nova-resident', label: 'Nova',
      isRoot: true, status, type: 'main', project: 'Nova Fox Companion' }];
  }
  const agents = (snapshot.sessions || []).flatMap((session) => session.agents.map((agent) => ({
    ...agent,
    sessionId: session.id,
    project: session.project,
    sessionStatus: session.status,
  })));
  return settings?.showDormantAgents
    ? agents
    : agents.filter((agent) => !['idle', 'dormant'].includes(agent.status)
      || (settings?.companionRemarks && reactions.get(agent.sessionId, agent.id)));
}

function createActor(agent, avatar, index) {
  const element = document.createElement('article');
  element.className = 'avatar';
  element.dataset.agentId = agent.id;
  element.setAttribute('aria-label', `${agent.label}, ${agent.status}`);

  const sprite = document.createElement('div');
  sprite.className = 'sprite';
  const spriteArt = document.createElement('div'); spriteArt.className = 'sprite-art';
  const ember = document.createElement('span'); ember.className = 'nova-ember';
  sprite.append(spriteArt, ember);
  const label = document.createElement('span');
  label.className = 'agent-label';
  const labelName = document.createElement('span');
  labelName.className = 'agent-name';
  const labelDetail = document.createElement('small');
  labelDetail.className = 'agent-detail';
  label.append(labelName, labelDetail);
  const bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open Nova conversation');
  bubble.className = 'companion-bubble';
  bubble.setAttribute('aria-live', 'polite');
  bubble.hidden = true;
  const mute = document.createElement('button');
  mute.className = 'companion-mute';
  mute.addEventListener('pointerdown', (event) => event.stopPropagation());
  mute.addEventListener('click', () => {
    const muted = !settings.companionVoiceMuted;
    voice.setMuted(muted || !settings.companionRemarks);
    void api.setVoiceMuted(muted).catch((error) => console.error(error));
  });
  const spirit = document.createElement('button');
  spirit.type = 'button'; spirit.className = 'companion-spirit';
  spirit.setAttribute('aria-label', 'Open Nova chat and controls');
  spirit.setAttribute('aria-expanded', 'false');
  const spiritCore = document.createElement('span'); spiritCore.className = 'spirit-core';
  spirit.append(spiritCore);
  const chat = document.createElement('section'); chat.className = 'companion-chat'; chat.hidden = true;
  chat.setAttribute('aria-label', 'Nova conversation');
  const historyLog = document.createElement('div'); historyLog.className = 'companion-history';
  historyLog.setAttribute('role', 'log'); historyLog.setAttribute('aria-live', 'polite');
  const form = document.createElement('form'); form.className = 'companion-chat-line';
  const input = document.createElement('input'); input.maxLength = 500;
  input.placeholder = 'Talk to Nova…'; input.setAttribute('aria-label', 'Message Nova');
  const send = document.createElement('button'); send.type = 'submit'; send.textContent = awaitingName ? 'Save name' : 'Send';
  form.append(input, send);
  const controls = document.createElement('div'); controls.className = 'spirit-controls';
  const settingsButton = document.createElement('button'); settingsButton.type = 'button'; settingsButton.textContent = 'Settings';
  const fullChat = document.createElement('button'); fullChat.type = 'button'; fullChat.textContent = 'Nova chat';
  const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Close';
  settingsButton.addEventListener('click', () => { closeChat(); void api.openSettings(); });
  fullChat.addEventListener('click', () => { closeChat(); void api.openFullChat(); });
  dismiss.addEventListener('click', closeChat);
  const hide = document.createElement('button'); hide.type='button'; hide.textContent='Hide Nova';
  hide.addEventListener('click', () => { closeChat(); void api.hideCompanion(); });
  controls.append(fullChat, settingsButton, mute, hide, dismiss);
  const chatStatus = document.createElement('span'); chatStatus.className = 'chat-status'; chatStatus.setAttribute('role', 'status');
  chat.append(historyLog, form, controls, chatStatus);
  chat.addEventListener('pointerdown', (event) => event.stopPropagation());
  async function openChat() {
    const actor = actors.get(agent.id);
    if (!actor) return;
    actor.awakeUntil = Date.now() + 12000;
    closeChat(); chatActor = actor; chat.hidden = false;
    positionChat(actor);
    spirit.setAttribute('aria-expanded', 'true');
    try { await api.setChatFocus(true); input.focus(); }
    catch { chatStatus.textContent = 'Could not focus chat. Try opening Nova chat from the controls.'; }
  }
  for (const control of [spirit, bubble]) {
    control.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      void openChat();
    });
    // Keyboard and assistive activation. Mouse activation already opened on pointerdown.
    control.addEventListener('click', (event) => { if (event.detail === 0) void openChat(); });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const text = input.value.trim(); if (!text || send.disabled) return;
    send.disabled = true; chatStatus.textContent = 'Thinking…';
    try {
      const result = await (awaitingName ? api.setCompanionName(text) : api.chatCompanion(text));
      chatStatus.textContent = result.error || result.skipped || '';
      if (!result.error && !result.skipped) {
        remember({ id: `user:${result.id}`, text, source: 'you', expiresAt: 0 });
        input.value = '';
        if (result.quip) remember({ ...result, text: '', source: 'nova' });
        else chatStatus.textContent = 'Nova chose a quiet moment.';
      }
    } catch { chatStatus.textContent = 'Could not reach Nova. Check cloud settings.'; }
    finally { send.disabled = false; }
  });
  element.append(sprite, label, bubble, spirit, chat);
  world.append(element);

  const actor = {
    id: agent.id,
    agent,
    avatar,
    element,
    sprite,
    spriteArt,
    ember,
    spirit,
    chat,
    historyLog,
    chatInput: input, chatSend: send,
    playState: new play.PlayState(),
    awakeUntil: Date.now() + 6000,
    label,
    labelName,
    labelDetail,
    bubble,
    mute,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    targetAt: 0,
    velocityX: 0,
    velocityY: 0,
    speed: 22 + (hash(agent.id) % 24),
    randomState: (hash(`${agent.id}:${index}`) || 1) >>> 0,
    zoneIndex: index % Math.max(1, viewportZones().length),
    dragging: false,
    route: [],
    transition: null,
    targetZoneIndex: 0,
  };
  chooseTarget(actor, { immediate: true, initialIndex: index });
  renderHistory(actor);
  return actor;
}

function updateActorElement(actor) {
  const { agent, avatar, element, sprite, label, labelName, labelDetail } = actor;
  element.classList.add('avatar');
  for (const status of ['working', 'idle', 'dormant', 'attention', 'done']) {
    element.classList.toggle(`status-${status}`, agent.status === status);
  }
  element.classList.toggle('is-root', Boolean(agent.isRoot));
  element.classList.toggle('is-dragging', Boolean(actor.dragging));
  element.style.setProperty('--interaction-scale', String(actorScale(agent)));
  element.style.setProperty('--avatar-size', `${avatarSizeFor(agent)}px`);
  const detail = detailsFor(agent);
  const layout = labelLayout(settings, Boolean(detail));
  element.style.setProperty('--label-height', `${layout.height}px`);
  label.hidden = !layout.visible;
  labelName.hidden = !layout.showName;
  labelName.textContent = agent.label;
  labelDetail.textContent = detail;
  labelDetail.hidden = !layout.showDetails;
  element.setAttribute('aria-label', [labelName.textContent, detail, agent.status].filter(Boolean).join(', '));
  sprite.style.backgroundImage = avatar.frameAtlas ? 'none' : `url("${avatar.assetUrl}")`;
  actor.spriteArt.hidden = !avatar.frameAtlas;
  actor.ember.hidden = !avatar.frameAtlas;
  sprite.style.backgroundSize = `800% ${avatar.rows * 100}%`;
  const muted = Boolean(settings?.companionVoiceMuted);
  actor.mute.textContent = muted ? 'Unmute' : 'Mute';
  actor.mute.setAttribute('aria-label', muted ? 'Unmute companion voice' : 'Mute companion voice');
  actor.mute.setAttribute('aria-pressed', String(muted));
}

function reconcileActors() {
  const selectedAvatars = activeAvatarRecords();
  const agents = selectedAvatars.length > 0 ? flattenAgents() : [];
  const avatarAssignments = assignAvatars(agents, selectedAvatars, settings?.avatarAssignmentMode);
  const activeIds = new Set(agents.map((agent) => agent.id));

  for (const [id, actor] of actors) {
    if (!activeIds.has(id)) {
      if (chatActor === actor) closeChat();
      actor.element.remove();
      actors.delete(id);
    }
  }

  agents.forEach((agent, index) => {
    const avatar = avatarAssignments.get(agent.id);
    let actor = actors.get(agent.id);
    if (!actor) {
      actor = createActor(agent, avatar, index);
      actors.set(agent.id, actor);
    }
    actor.agent = agent;
    actor.avatar = avatar;
    updateActorElement(actor);
  });
}

function updateSpeech(actor) {
  const message = (awaitingName && firstIntroduction) || (settings?.companionRemarks && (settings.singleCompanion ? latestMessage : reactions.get(actor.agent.sessionId, actor.agent.id)));
  actor.bubble.hidden = !message || message.expiresAt <= Date.now() || chatActor === actor;
  if (!message) return;
  const text = [message.text, message.quip].filter(Boolean).join(' — ');
  if (actor.bubble.textContent !== text) actor.bubble.textContent = text;
  if (message.source !== 'you' && !message.silent && desktop?.safeZones.length) voice.offer(message, settings?.language);
  // Position against the viewport so speech remains readable near screen edges.
  const selected = viewportZones()[actor.zoneIndex] || viewportZones()[0];
  const scale = actorScale(actor.agent);
  const width = Math.min(260 * scale, selected.width - 16);
  actor.bubble.style.width = `${width}px`;
  actor.bubble.style.left = `${clamp(actor.x + avatarSizeFor(actor.agent) / 2 - width / 2,
    selected.x + 8, selected.x + selected.width - width - 8) - actor.x}px`;
  const top = actor.y < selected.y + 110 ? actor.y + actorHeight(actor) + 8 : actor.y - 100 * scale;
  actor.bubble.style.top = `${clamp(top, selected.y + 8, selected.y + selected.height - 104) - actor.y}px`;
}

function frameIndex(animation, time) {
  const total = animation.durations.reduce((sum, duration) => sum + duration, 0);
  let cursor = time % total;
  for (let index = 0; index < animation.durations.length; index += 1) {
    cursor -= animation.durations[index];
    if (cursor < 0) return index;
  }
  return 0;
}

function animationFor(actor, moving) {
  if (actor.avatar.frameAtlas && actor.dragging) return animations.carried;
  // Travel must use locomotion frames, including vertical paths and status reactions.
  if (moving) return actor.velocityX < 0 ? animations.left : animations.right;
  if (actor.agent.status === 'attention') return animations.waiting;
  const reaction = reactions.get(actor.agent.sessionId, actor.agent.id);
  if (reaction?.mood === 'proud' || reaction?.mood === 'amused') return animations.wave;
  if (reaction?.mood === 'curious' && !moving) return animations.review;
  if (actor.agent.status === 'done') return animations.wave;
  if (actor.playState.mode === 'pounce') return animations.wave;
  if (actor.avatar.frameAtlas && ['idle', 'dormant'].includes(actor.agent.status) && !moving
    && actor.playState.mode !== 'peek' && chatActor !== actor && Date.now() > actor.awakeUntil) return animations.sleep;
  if (['idle', 'dormant'].includes(actor.agent.status) && !moving) return animations.idle;
  return animations.working;
}

function applySpriteFrame(actor, time, moving) {
  const animation = animationFor(actor, moving);
  const reduced = settings?.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (actor.avatar.frameAtlas) {
    const name = Object.keys(animations).find((key) => animations[key] === animation) || 'idle';
    const atlas = actor.avatar.frameAtlas;
    const frames = atlas.animations[name] || atlas.animations.idle;
    const frame = frames[reduced ? 0 : frameIndex({ durations: frames.map((item) => item.duration) }, time)];
    const size = avatarSizeFor(actor.agent), height = size * 1.08334;
    const scale = Math.min(size / atlas.referenceWidth, height / atlas.referenceHeight);
    if (actor.lastFrame?.frame === frame && actor.lastFrame.scale === scale && actor.lastFrame.name === name) return;
    actor.lastFrame = { frame, scale, name };
    const art = actor.spriteArt;
    art.style.width = `${frame.width * scale}px`; art.style.height = `${frame.height * scale}px`;
    art.style.left = `${(size - frame.width * scale) / 2}px`;
    art.style.top = `${height - frame.height * scale}px`;
    art.style.backgroundImage = `url("${actor.avatar.assetUrl}")`;
    art.style.backgroundSize = `${atlas.width * scale}px ${atlas.height * scale}px`;
    art.style.backgroundPosition = `${-frame.x * scale}px ${-frame.y * scale}px`;
    actor.element.classList.toggle('is-sleeping', name === 'sleep');
    actor.ember.hidden = name === 'carried' || name === 'right' || name === 'left';
    return;
  }
  const column = reduced ? 0 : frameIndex(animation, time + (hash(actor.id) % 700));
  const columnPercent = column * (100 / 7);
  const rowPercent = animation.row * (100 / Math.max(1, actor.avatar.rows - 1));
  actor.sprite.style.backgroundPosition = `${columnPercent}% ${rowPercent}%`;
}

function moveActor(actor, deltaSeconds, time) {
  if (actor.dragging || chatActor === actor) return false;
  if (['idle', 'dormant'].includes(actor.agent.status) && !['escape', 'peek', 'pounce', 'stalk'].includes(actor.playState.mode)) {
    actor.velocityX = 0;
    actor.velocityY = 0;
    return false;
  }
  const reduced = settings?.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return false;

  let dx = actor.targetX - actor.x;
  let dy = actor.targetY - actor.y;
  let distance = Math.hypot(dx, dy);
  if (distance < 10) {
    actor.x = actor.targetX;
    actor.y = actor.targetY;
    if (actor.route.length > 0) {
      actor.zoneIndex = actor.targetZoneIndex;
      activateNextWaypoint(actor);
    } else {
      chooseTarget(actor, { cycleZone: true });
    }
    dx = actor.targetX - actor.x;
    dy = actor.targetY - actor.y;
    distance = Math.hypot(dx, dy);
  } else if (time > actor.targetAt && !actor.transition && actor.route.length === 0) {
    chooseTarget(actor, { cycleZone: true });
    dx = actor.targetX - actor.x;
    dy = actor.targetY - actor.y;
    distance = Math.hypot(dx, dy);
  }

  if (distance < 1) return false;
  const statusFactor = actor.playState.mode === 'escape' ? 4 : ['pounce', 'stalk'].includes(actor.playState.mode) ? 3 : actor.agent.status === 'working' ? 1 : 0.55;
  const speed = actor.speed * statusFactor;
  actor.velocityX = (dx / distance) * speed;
  actor.velocityY = (dy / distance) * speed;
  actor.x += actor.velocityX * deltaSeconds;
  actor.y += actor.velocityY * deltaSeconds;
  return true;
}

function applySeparation() {
  const list = [...actors.values()].filter((actor) => !actor.dragging && !actor.transition);
  for (let leftIndex = 0; leftIndex < list.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < list.length; rightIndex += 1) {
      const left = list[leftIndex];
      const right = list[rightIndex];
      const minimum = (avatarSizeFor(left.agent) + avatarSizeFor(right.agent)) * 0.475;
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance >= minimum) continue;
      const force = (minimum - distance) * 0.055;
      left.x -= (dx / distance) * force;
      left.y -= (dy / distance) * force;
      right.x += (dx / distance) * force;
      right.y += (dy / distance) * force;
    }
  }
}

function constrainActor(actor) {
  const zones = viewportZones();
  if (actor.transition) return;
  actor.zoneIndex = Number.isInteger(actor.zoneIndex) ? actor.zoneIndex % zones.length : 0;
  const selected = zones[actor.zoneIndex] || zones[0];
  const safe = safeArea(actor, selected);
  actor.x = clamp(actor.x, safe.minX, safe.maxX);
  actor.y = clamp(actor.y, safe.minY, safe.maxY);
}

function animate(time) {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const active = Boolean(draggedActor || chatActor) || [...actors.values()].some(actor=>
    !['idle','dormant'].includes(actor.agent.status) || actor.playState.mode!=='roam');
  if (!renderClock.due(time, active)) return;
  animationClock.advance(document.getAnimations(), time, animation=>animation instanceof CSSAnimation);
  const safe = !desktop || desktop.safeZones.length > 0;
  world.hidden = !safe;
  if (!safe) { decoy.hidden = true; closeChat(); return; }
  for (const actor of actors.values()) updateSpeech(actor);
  const deltaSeconds = Math.min(0.1, Math.max(0, (time - previousFrame) / 1000));
  previousFrame = time;
  for (const actor of actors.values()) {
    updatePlay(actor);
    const moving = moveActor(actor, deltaSeconds, time);
    applySpriteFrame(actor, time, moving);
  }
  applySeparation();
  for (const actor of actors.values()) {
    constrainActor(actor);
    actor.element.style.setProperty('--avatar-size', `${avatarSizeFor(actor.agent)}px`);
    actor.element.style.setProperty('--interaction-scale', String(actorScale(actor.agent)));
    actor.element.style.transform = `translate3d(${actor.x.toFixed(2)}px, ${actor.y.toFixed(2)}px, 0)`;
    positionChat(actor);
  }
  updateSurface();
}

function positionChat(actor) {
  if (actor.chat.hidden) return;
  const selected = viewportZones()[actor.zoneIndex] || viewportZones()[0];
  const scale = actorScale(actor.agent);
  const width = Math.min(340 * scale, selected.width - 16);
  actor.chat.style.width = `${width}px`;
  actor.chat.style.left = `${clamp(actor.x - 80, selected.x + 8, selected.x + selected.width - width - 8) - actor.x}px`;
  const top = actor.y > selected.y + 260 * scale ? actor.y - 245 * scale : actor.y + actorHeight(actor) + 12;
  actor.chat.style.top = `${clamp(top, selected.y + 8, Math.max(selected.y + 8, selected.y + selected.height - 245 * scale)) - actor.y}px`;
}

function updatePlay(actor) {
  const zones = viewportZones(); const selected = zones[actor.zoneIndex] || zones[0];
  const reduced = settings?.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cursor = desktop?.cursor || { x: -10000, y: -10000 };
  const size = avatarSizeFor(actor.agent);
  const peekWindow = (desktop?.windows || []).find((rect) => rect.width > size && rect.height > size
    && rect.x + rect.width + size * .7 < selected.x + selected.width
    && rect.x + rect.width > selected.x + size && rect.y + 24 > selected.y + 56
    && rect.y + size + 24 < selected.y + selected.height);
  const cursorAvailable = cursor.x > selected.x + size && cursor.y > selected.y + size
    && cursor.x < selected.x + selected.width - size && cursor.y < selected.y + selected.height - size
    && desktop?.safeZones.length > 0;
  const nearCursor = cursorAvailable && Math.hypot(cursor.x - actor.x, cursor.y - actor.y) < 180;
  if (nearCursor && desktop?.moved) actor.awakeUntil = Date.now() + 6000;
  const previous = actor.playState.mode;
  if (!actor.dragging) actor.playState.update({ now: Date.now(), idleMs: desktop?.idleMs || 0,
    moved: desktop?.moved, reduced: reduced || !settings?.companionPlayful,
    interacting: chatActor === actor || actor.agent.status === 'attention', nearCursor, cursorAvailable, canPeek: Boolean(peekWindow) });
  if (actor.playState.mode === 'peek' && !peekWindow) actor.playState.mode = 'roam';
  const mode = actor.playState.mode;
  actor.sprite.style.clipPath = mode === 'peek' && peekWindow
    ? `inset(0 0 0 ${clamp(peekWindow.x + peekWindow.width - actor.x, 0, size)}px)` : '';
  if (previous !== mode) {
    actor.route = []; actor.transition = null;
    if (mode === 'escape') void playRemark('escaped', actor);
    if (mode === 'pounce') void playRemark('cursor_play', actor);
    if (mode === 'roam') chooseTarget(actor);
  }
  if (mode === 'escape') {
    const target = play.escapeTarget(cursor, { size }, selected);
    actor.targetX = target.x; actor.targetY = target.y; actor.targetAt = Infinity;
  } else if (mode === 'peek' && peekWindow) {
    actor.peekWindowId = peekWindow.id;
    actor.targetX = peekWindow.x + peekWindow.width - size * .45;
    actor.targetY = peekWindow.y + 24; actor.targetAt = Infinity;
    if (actor.peekSpoken !== actor.playState.until && Math.hypot(actor.x - actor.targetX, actor.y - actor.targetY) < 15) {
      actor.peekSpoken = actor.playState.until; void playRemark('peeking', actor);
    }
  } else if (mode === 'pounce' || mode === 'stalk') {
    actor.targetX = cursor.x - size * .6; actor.targetY = cursor.y - size * .5; actor.targetAt = Infinity;
    if (mode === 'stalk') return;
    const phase = (Date.now() % 900) / 900;
    decoy.hidden = false;
    decoy.style.transform = `translate(${cursor.x + Math.sin(phase * Math.PI) * 55}px, ${cursor.y - Math.sin(phase * Math.PI) * 35}px) rotate(${phase * 90}deg)`;
  }
  actor.element.classList.toggle('is-peeking', mode === 'peek');
}

function updateInteractiveClass() {
  document.body.classList.toggle('is-interactive', settings && !settings.passive);
  document.body.classList.toggle('is-reduced-motion', Boolean(settings?.reducedMotion));
}

function updateHitTests(x, y) {
  if (draggedActor) return;
  const target = document.elementFromPoint(x, y);
  const control = Boolean(target?.closest('.companion-spirit, .companion-chat, .companion-bubble'));
  if (control !== lastControlHitTest) {
    lastControlHitTest = control; void api.setControlHitTest(control);
  }
  const hit = Boolean(target?.closest('.avatar'));
  if (hit !== lastHitTest) {
    lastHitTest = hit;
    void api.setOverlayHitTest(hit);
  }
}
document.addEventListener('mousemove', (event) => updateHitTests(event.clientX, event.clientY));

document.addEventListener('pointermove', (event) => {
  if (!draggedActor) return;
  draggedActor.x = (surface ? event.screenX - surface.world.x : event.clientX) - dragOffset.x;
  draggedActor.y = (surface ? event.screenY - surface.world.y : event.clientY) - dragOffset.y;
  const zones = viewportZones();
  const centerX = draggedActor.x + avatarSizeFor(draggedActor.agent) / 2;
  const centerY = draggedActor.y + actorHeight(draggedActor) / 2;
  const enteredZoneIndex = topology.zoneIndexAtPoint(zones, centerX, centerY);
  if (enteredZoneIndex >= 0 && (enteredZoneIndex === draggedActor.zoneIndex
    || topology.sharedEdge(zones[draggedActor.zoneIndex], zones[enteredZoneIndex]))) {
    draggedActor.zoneIndex = enteredZoneIndex;
  }
});

world.addEventListener('pointerdown', (event) => {
  if (settings?.passive) return;
  const element = event.target.closest('.avatar');
  if (!element) return;
  const actor = actors.get(element.dataset.agentId);
  if (!actor) return;
  draggedActor = actor;
  actor.dragging = true;
  actor.awakeUntil = Date.now() + 12000;
  actor.playState.pickup(Date.now());
  actor.route = [];
  actor.transition = null;
  dragOffset = { x: (surface ? event.screenX - surface.world.x : event.clientX) - actor.x,
    y: (surface ? event.screenY - surface.world.y : event.clientY) - actor.y };
  element.setPointerCapture(event.pointerId);
  updateActorElement(actor);
  updateSurface();
});

function finishDrag(event) {
  if (!draggedActor) return;
  const actor = draggedActor;
  actor.dragging = false;
  actor.awakeUntil = Date.now() + 12000;
  const dropMode = actor.playState.drop(Date.now());
  constrainActor(actor);
  chooseTarget(actor);
  updateActorElement(actor);
  draggedActor = null;
  if (actor.element.hasPointerCapture?.(event.pointerId)) actor.element.releasePointerCapture(event.pointerId);
  actor.element.classList.add('just-dropped');
  setTimeout(() => actor.element.classList.remove('just-dropped'), 500);
  if (settings.companionRemarks) void playRemark(dropMode === 'escape' ? 'escaped' : 'moved', actor);
}

document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', finishDrag);
world.addEventListener('lostpointercapture', (event) => {
  if (draggedActor && event.target === draggedActor.element) finishDrag(event);
});

document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && chatActor) { event.preventDefault(); closeChat(); }
});
window.addEventListener('resize', () => {
  if (surface) return;
  let index = 0;
  for (const actor of actors.values()) {
    actor.zoneIndex = index % Math.max(1, viewportZones().length);
    chooseTarget(actor, { immediate: true, initialIndex: index });
    index += 1;
  }
});

api.onState((value) => {
  snapshot = value || { sessions: [] };
  reactions.observe(snapshot, { enabled: settings?.companionRemarks, language: settings?.language, cloud: settings?.companionCloudEnabled });
  for (const session of snapshot.sessions || []) for (const agent of session.agents || []) {
    const message = reactions.get(session.id, agent.id);
    if (message) remember({ ...message, source: 'agent', sessionId: session.id, speaker: agent.label });
  }
  reconcileActors();
});
api.onSettings((value) => {
  const nextZoneSignature = JSON.stringify(value.zone || null);
  const zoneChanged = nextZoneSignature !== zoneSignature;
  settings = value.settings;
  voice.configure(settings);
  voice.setMuted(settings.companionVoiceMuted || !settings.companionRemarks || !settings.overlayEnabled);
  reactions.observe(snapshot, { enabled: settings?.companionRemarks, language: settings?.language, cloud: settings?.companionCloudEnabled });
  zone = value.zone;
  if(surface&&zoneChanged&&zone?.windowBounds){
    surfaceGeneration++;surfaceCheckedAt=0;surfaceFailed=false;
    applySurface({x:0,y:0,width:zone.windowBounds.width,height:zone.windowBounds.height,world:zone.windowBounds});
  }
  zoneSignature = nextZoneSignature;
  updateInteractiveClass();
  if (zoneChanged) {
    let index = 0;
    for (const actor of actors.values()) {
      actor.zoneIndex = index % Math.max(1, viewportZones().length);
      chooseTarget(actor, { immediate: true, initialIndex: index });
      index += 1;
    }
  }
  reconcileActors();
});
api.onLibrary((value) => {
  avatars = value.avatars || [];
  reconcileActors();
});

api.onReaction((reaction) => {
  if (!settings?.companionRemarks || !settings?.companionCloudEnabled) return;
  if (reactions.accept(reaction)) {
    remember({ ...reaction, text: '', source: 'agent', sessionId: reaction.sessionId });
    reconcileActors();
  }
});

api.onDesktop((value) => {
  const previous = JSON.stringify(desktop?.safeZones || []);
  desktop = value;
  if (!value.safeZones.length) closeChat();
  const mask = value.safeZones.map((rect) => `M${rect.x},${rect.y}h${rect.width}v${rect.height}h${-rect.width}Z`).join(' ');
  world.style.clipPath = mask ? `path("${mask}")` : '';
  decoy.hidden = true;
  voice.setMuted(settings?.companionVoiceMuted || !settings?.companionRemarks || !value.safeZones.length);
  if (previous !== JSON.stringify(value.safeZones)) {
    let index = 0;
    for (const actor of actors.values()) {
      actor.zoneIndex = index++ % Math.max(1, viewportZones().length);
      actor.route = []; actor.transition = null; constrainActor(actor); chooseTarget(actor);
    }
  }
  if (value.moved) {
    for (const actor of actors.values()) {
      if (['pounce', 'stalk', 'peek'].includes(actor.playState.mode)) {
        actor.playState.mode = 'roam'; actor.playState.nextPlayAt = Date.now() + 10000;
        actor.sprite.style.clipPath = ''; chooseTarget(actor);
      }
    }
  }
  updateHitTests(value.cursor.x-(surface?.x||0), value.cursor.y-(surface?.y||0));
});

api.onConversation(({ text, result, origin }) => {
  remember({ id: `user:${result.id}`, text, source: 'you', expiresAt: 0 });
  if (result.quip) remember({ ...result, text: '', source: 'nova', silent: origin !== 'overlay' });
});
api.onProfile(() => {
  awaitingName = false; firstIntroduction = null;
  for (const actor of actors.values()) renderNameState(actor);
});
api.onMemoryCleared(() => {
  history.length = 0; historyIds.clear(); latestMessage = null; reactions.messages.clear();
  voice.stop();
  for (const actor of actors.values()) renderHistory(actor);
  void api.companionHistory().then((memory) => { if (!memory.error && memory.introduction) showIntroduction(memory.introduction); });
});

// Remove briefly retained idle actors after their final speech expires.
setInterval(reconcileActors, 1000);

async function initialize() {
  const bootstrap = await api.getBootstrap();
  snapshot = bootstrap.state;
  reactions.observe(snapshot, { enabled: false });
  settings = bootstrap.settings;
  voice.configure(settings);
  voice.setMuted(settings.companionVoiceMuted || !settings.companionRemarks || !settings.overlayEnabled);
  avatars = bootstrap.avatars;
  zone = bootstrap.zone;
  if (bootstrap.surface) applySurface(bootstrap.surface);
  zoneSignature = JSON.stringify(zone || null);
  updateInteractiveClass();
  reconcileActors();
  const memory = await api.companionHistory();
  for (const [index, turn] of (memory.turns || []).entries()) remember({ id: `memory:${index}`,
    text: turn.text, source: turn.role === 'user' ? 'you' : 'nova', expiresAt: 0 });
  if (!memory.error && memory.introduction) showIntroduction(memory.introduction);
  requestAnimationFrame(animate);
}

void initialize().catch((error) => console.error(error));
