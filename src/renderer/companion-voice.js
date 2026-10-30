'use strict';

(function expose(root) {
  class CompanionVoice {
    constructor({ synthesis, createUtterance, now = Date.now, requestSpeech = null, createAudio = null, onError = () => {} }) {
      Object.assign(this, { requestSpeech, createAudio, onError });
      this.provider = 'local'; this.busy = false; this.generation = 0; this.activeUtterance = null; this.activeAudio = null;
      this.synthesis = synthesis;
      this.createUtterance = createUtterance;
      this.now = now;
      this.seen = new Set();
      this.muted = true;
    }

    configure(settings) {
      const provider = settings.companionVoiceProvider || 'local';
      if (provider !== this.provider) { this.stop(); this.provider = provider; }
    }
    stop() {
      this.generation++; this.activeAudio?.pause(); this.activeAudio = null;
      this.activeUtterance = null; this.busy = false; this.synthesis?.cancel();
    }
    setMuted(muted) {
      const next = Boolean(muted);
      if (next && !this.muted) this.stop();
      this.muted = next;
    }
    async speakCloud(message) {
      const generation = this.generation;
      this.busy = true;
      try {
        const result = await this.requestSpeech(message);
        if (generation !== this.generation || this.muted || message.expiresAt <= this.now()) return;
        if (!result.audio) { if (result.error) this.onError(result.error); return; }
        const audio = this.createAudio(result.audio); this.activeAudio = audio;
        await new Promise((resolve,reject) => {
          audio.onended = resolve; audio.onerror = () => reject(new Error('Audio playback unavailable.'));
          audio.onpause = resolve;
          Promise.resolve(audio.play()).catch(reject);
        });
      } catch { this.onError('Cloud voice unavailable. Check voice settings and API access.'); }
      finally { if (generation === this.generation) { this.activeAudio = null; this.busy = false; } }
    }

    offer(message, language = 'en') {
      if (!message || this.seen.has(message.id)) return false;
      this.seen.add(message.id);
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value);
      // Never voice status text, replay muted remarks, or queue stale chatter.
      if (this.muted || this.busy || !message.quip || message.expiresAt <= this.now()) return false;
      if (this.provider === 'cloud') {
        if (!this.requestSpeech || !this.createAudio) return false;
        void this.speakCloud(message); return true;
      }
      if (!this.synthesis || this.synthesis.speaking || this.synthesis.pending) return false;
      const utterance = this.createUtterance(message.quip);
      this.activeUtterance = utterance;
      utterance.onend = utterance.onerror = () => { if (this.activeUtterance === utterance) this.activeUtterance = null; };
      utterance.lang = language === 'fr' ? 'fr-FR' : 'en-US';
      try {
        this.synthesis.speak(utterance);
        return true;
      } catch {
        return false; // A voice failure must never stop the animation loop.
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { CompanionVoice };
  else root.NovaCompanionVoice = { CompanionVoice };
}(typeof window !== 'undefined' ? window : globalThis));
