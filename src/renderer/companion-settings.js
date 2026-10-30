'use strict';

(async function companionSettings() {
  const api = window.novaFoxCompanion;
  const element = (id) => document.getElementById(`nova-${id}`);
  const voice = new window.NovaCompanionVoice.CompanionVoice({
    requestSpeech: (message) => api.speakQuip(message), createAudio: (source) => new Audio(source),
    onError: (text) => { element('preview-result').textContent = text; },
    synthesis: window.speechSynthesis, createUtterance: (text) => new SpeechSynthesisUtterance(text),
  });
  let settings;
  let awaitingName = false;
  function render(value) {
    settings = value; voice.configure(value);
    element('voice-provider').value = value.companionVoiceProvider;
    element('speech-voice').value = value.companionSpeechVoice;
    element('speech-limit').value = value.companionSpeechDailyRequests;
    element('cloud').checked = value.companionCloudEnabled;
    element('single').checked = value.singleCompanion;
    element('fullscreen').checked = value.avoidFullscreen;
    element('play').checked = value.companionPlayful;
    element('vision').checked = value.companionVisionEnabled;
    element('excluded-apps').value = value.companionVisionExcludedApps.join(', ');
    element('personality').value = value.companionPersonality;
    element('model').value = value.companionModel;
    element('cooldown').value = value.companionCooldownSeconds;
    element('limit').value = value.companionDailyRequests;
    element('budget').value = value.companionDailyBudgetUsd;
    element('mute').textContent = value.companionVoiceMuted ? 'Unmute voice' : 'Mute voice';
    element('mute').setAttribute('aria-pressed', String(value.companionVoiceMuted));
    voice.setMuted(value.companionVoiceMuted || !value.companionRemarks);
  }
  async function refreshIntegration() {
    try {
      const status = await api.integrationStatus();
      element('home-path').textContent = `${status.home} (${status.source})`;
      element('integration-status').textContent = [
        status.available ? 'Home available' : 'Home unavailable; Nova will keep waiting',
        status.bridgeError || 'Ready for activity',
        (status.hooks.upstreamDetected || status.hooks.upstreamRunning) ? 'Codex Avatars detected—disable it before installing Nova hooks' : '',
      ].filter(Boolean).join(' · ');
      element('integration-detail').textContent = [
        status.hooks.error || (status.hooks.installed ? 'Nova standalone hooks installed' : 'No Nova standalone hooks installed'),
        status.lastHookAt ? `Last event: ${new Date(status.lastHookAt).toLocaleTimeString()}` : 'No live hook event received yet',
        'Checks this home’s configuration and the running Avatars bridge. Plugin-only and project-level integrations may need a manual check.',
      ].join(' · ');
    } catch { element('integration-status').textContent = 'Could not check Codex integration.'; }
  }
  for (const [id, useDefault] of [['pick-home', false], ['default-home', true]]) {
    element(id).addEventListener('click', async () => {
      element(id).disabled = true;
      try {
        const result = await api.selectCodexHome(useDefault);
        if (result.error) element('integration-status').textContent = result.error;
        else if (!result.canceled) await refreshIntegration();
      } catch { element('integration-status').textContent = 'Could not change Codex home.'; }
      finally { element(id).disabled = false; }
    });
  }
  element('check-integration').addEventListener('click', () => void refreshIntegration());
  async function refresh() {
    const status = await api.companionStatus();
    element('connection').textContent = status.error || [
      status.configured ? 'API key saved' : 'No API key saved',
      status.secureStorage ? 'OS encryption available' : 'Secure storage unavailable',
      `${status.usage?.requests || 0} requests · $${(status.usage?.reservedUsd || 0).toFixed(3)} reserved (${status.usage?.day || 'today'})`,
      `Up to $${status.reservationUsd?.toFixed(3)} reserved per attempt`,
      status.desktopAvailable ? 'Window awareness ready' : (settings.avoidFullscreen ? 'Waiting for window awareness; fullscreen protection may hide Nova' : 'Window awareness unavailable'),
    ].join(' · ');
    element('speech-usage').textContent = status.speech?.error || `${status.speech?.usage?.requests || 0} speech requests used today. Speech uses a separate API allowance.`;
    if (status.memory?.error) element('connection').textContent += ' · Memory unavailable';
    if (document.activeElement !== element('notes')) element('notes').value = status.memory?.notes || '';
    awaitingName = !status.memory?.error && !status.memory?.preferredName;
    element('chat-input').placeholder = awaitingName ? 'What should I call you?' : 'Tell Nova something…';
    if (document.activeElement !== element('name')) element('name').value = status.memory?.preferredName || '';
    const log = element('chat-log');
    log.replaceChildren();
    if (awaitingName) {
      const greeting = document.createElement('p');
      greeting.textContent = 'Nova: Hi! I’m Nova, your little spirit fox companion. What should I call you?';
      log.append(greeting);
    }
    for (const turn of status.memory?.turns || []) {
      const line = document.createElement('p');
      line.textContent = `${turn.role === 'user' ? 'You' : 'Nova'}: ${turn.text}`;
      log.append(line);
    }
    log.scrollTop = log.scrollHeight;
  }
  const fields = { 'voice-provider': 'companionVoiceProvider', 'speech-voice': 'companionSpeechVoice', 'speech-limit': 'companionSpeechDailyRequests', cloud: 'companionCloudEnabled', single: 'singleCompanion', fullscreen: 'avoidFullscreen', play: 'companionPlayful',
    vision: 'companionVisionEnabled', 'excluded-apps': 'companionVisionExcludedApps', personality: 'companionPersonality', model: 'companionModel',
    cooldown: 'companionCooldownSeconds', limit: 'companionDailyRequests', budget: 'companionDailyBudgetUsd' };
  for (const [id, key] of Object.entries(fields)) {
    element(id).addEventListener('change', async () => {
      try {
        const control = element(id);
        await api.updateSettings({ [key]: ['cloud', 'single', 'fullscreen', 'play', 'vision'].includes(id) ? control.checked
          : id === 'excluded-apps' ? control.value.split(',')
          : ['personality', 'model', 'voice-provider', 'speech-voice'].includes(id) ? control.value : Number(control.value) });
        await refresh();
      } catch { element('connection').textContent = 'Could not save settings.'; }
    });
  }
  element('mute').addEventListener('click', async () => {
    voice.setMuted(true);
    try { await api.updateSettings({ companionVoiceMuted: !settings.companionVoiceMuted }); }
    catch { element('connection').textContent = 'Could not save mute preference.'; }
  });
  async function updateKey(remove) {
    const key = remove ? null : element('key').value;
    element('key').value = '';
    try {
      const result = await api.setCompanionKey(key);
      if (result.error) element('connection').textContent = result.error;
      else await refresh();
    } catch { element('connection').textContent = 'Could not update the saved key.'; }
  }
  element('save-key').addEventListener('click', () => void updateKey(false));
  element('remove-key').addEventListener('click', () => void updateKey(true));
  async function updateMemory(notes) {
    try {
      const result = await api.updateCompanionMemory(notes);
      if (result.error) element('connection').textContent = result.error;
      else await refresh();
    } catch { element('connection').textContent = 'Memory could not be updated.'; }
  }
  element('save-name').addEventListener('click', async () => {
    try {
      const result = await api.setCompanionName(element('name').value);
      element('preview-result').textContent = result.error || result.reply;
      await refresh();
    } catch { element('preview-result').textContent = 'Could not save your name.'; }
  });
  api.onProfile(() => void refresh().catch(() => {}));
  element('save-notes').addEventListener('click', () => void updateMemory(element('notes').value));
  element('clear-memory').addEventListener('click', () => {
    if (window.confirm('Clear all Nova conversations and personal notes? This cannot be undone.')) void updateMemory(null);
  });
  element('chat-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = element('chat-input').value.trim();
    if (!text) return;
    element('chat-send').disabled = true;
    try {
      const result = await (awaitingName ? api.setCompanionName(text) : api.chatCompanion(text));
      element('preview-result').textContent = result.error || result.skipped || result.quip || 'Nova chose silence.';
      if (!result.error && !result.skipped) element('chat-input').value = '';
      if (result.quip) voice.offer(result, settings.language);
      await refresh();
    } catch { element('preview-result').textContent = 'Chat unavailable.'; }
    finally { element('chat-send').disabled = false; }
  });
  element('voice-preview').addEventListener('click', () => {
    element('preview-result').textContent = settings.companionVoiceMuted ? 'Unmute voice first.' : 'Preparing Nova’s voice…';
    const offered = voice.offer({id:`speech-preview:${Date.now()}`,quip:'Hello! Tiny paws, very important fox business.',expiresAt:Date.now()+30000},settings.language);
    if (!offered) element('preview-result').textContent = 'Unmute voice or wait for the current line to finish.';
  });
  element('restore-link').addEventListener('click', async () => {
    const result = await api.registerRestoreLink(); element('preview-result').textContent = result.message;
  });
  element('preview').addEventListener('click', async () => {
    element('preview').disabled = true;
    element('preview-result').textContent = 'Thinking of something worth saying…';
    try {
      const result = await api.previewCompanion();
      element('preview-result').textContent = result.error || result.skipped
        || (result.quip ? `${result.mood}: “${result.quip}”` : 'Nova chose a quiet moment.');
      if (result.quip) voice.offer(result, settings.language);
      await refresh();
    } catch { element('preview-result').textContent = 'Reaction preview unavailable.'; }
    finally { element('preview').disabled = false; }
  });
  element('vision-preview').addEventListener('click', async () => {
    element('vision-preview').disabled = true;
    element('preview-result').textContent = 'Checking the last active app…';
    try {
      const result = await api.previewCompanionVision();
      element('preview-result').textContent = result.error || result.skipped || result.quip || 'Nova chose silence.';
      if (result.quip) voice.offer(result, settings.language);
      await refresh();
    } catch { element('preview-result').textContent = 'Window vision is unavailable for this app.'; }
    finally { element('vision-preview').disabled = false; }
  });
  api.onSettings((payload) => { render(payload.settings); void refreshIntegration(); });
  api.onReaction(() => void refresh().catch(() => {}));
  api.onConversation(() => void refresh().catch(() => {}));
  render((await api.getBootstrap()).settings);
  await refresh();
  await refreshIntegration();
}()).catch(() => {
  document.getElementById('nova-connection').textContent = 'Companion settings could not be loaded.';
});
