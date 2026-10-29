'use strict';

(async function companionSettings() {
  const api = window.codexAvatars;
  const element = (id) => document.getElementById(`nova-${id}`);
  const voice = new window.NovaCompanionVoice.CompanionVoice({
    synthesis: window.speechSynthesis, createUtterance: (text) => new SpeechSynthesisUtterance(text),
  });
  let settings;
  function render(value) {
    settings = value;
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
    voice.setMuted(value.companionVoiceMuted || !value.companionRemarks || !value.companionCloudEnabled);
  }
  async function refresh() {
    const status = await api.companionStatus();
    element('connection').textContent = status.error || [
      status.configured ? 'API key saved' : 'No API key saved',
      status.secureStorage ? 'OS encryption available' : 'Secure storage unavailable',
      `${status.usage?.requests || 0} requests · $${(status.usage?.reservedUsd || 0).toFixed(3)} reserved (${status.usage?.day || 'today'})`,
      `Up to $${status.reservationUsd?.toFixed(3)} reserved per attempt`,
      status.desktopAvailable ? 'Window awareness ready' : (settings.avoidFullscreen ? 'Waiting for window awareness; fullscreen protection may hide Nova' : 'Window awareness unavailable'),
    ].join(' · ');
    if (status.memory?.error) element('connection').textContent += ' · Memory unavailable';
    if (document.activeElement !== element('notes')) element('notes').value = status.memory?.notes || '';
    const log = element('chat-log');
    log.replaceChildren();
    for (const turn of status.memory?.turns || []) {
      const line = document.createElement('p');
      line.textContent = `${turn.role === 'user' ? 'You' : 'Nova'}: ${turn.text}`;
      log.append(line);
    }
    log.scrollTop = log.scrollHeight;
  }
  const fields = { cloud: 'companionCloudEnabled', single: 'singleCompanion', fullscreen: 'avoidFullscreen', play: 'companionPlayful',
    vision: 'companionVisionEnabled', 'excluded-apps': 'companionVisionExcludedApps', personality: 'companionPersonality', model: 'companionModel',
    cooldown: 'companionCooldownSeconds', limit: 'companionDailyRequests', budget: 'companionDailyBudgetUsd' };
  for (const [id, key] of Object.entries(fields)) {
    element(id).addEventListener('change', async () => {
      try {
        const control = element(id);
        await api.updateSettings({ [key]: ['cloud', 'single', 'fullscreen', 'play', 'vision'].includes(id) ? control.checked
          : id === 'excluded-apps' ? control.value.split(',')
          : ['personality', 'model'].includes(id) ? control.value : Number(control.value) });
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
      const result = await api.chatCompanion(text);
      element('preview-result').textContent = result.error || result.skipped || result.quip || 'Nova chose silence.';
      if (!result.error && !result.skipped) element('chat-input').value = '';
      if (result.quip) voice.offer(result, settings.language);
      await refresh();
    } catch { element('preview-result').textContent = 'Chat unavailable.'; }
    finally { element('chat-send').disabled = false; }
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
  api.onSettings((payload) => render(payload.settings));
  api.onReaction(() => void refresh().catch(() => {}));
  api.onConversation(() => void refresh().catch(() => {}));
  render((await api.getBootstrap()).settings);
  await refresh();
}()).catch(() => {
  document.getElementById('nova-connection').textContent = 'Companion settings could not be loaded.';
});
