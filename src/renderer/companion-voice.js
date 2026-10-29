'use strict';

(function expose(root) {
  class CompanionVoice {
    constructor({ synthesis, createUtterance, now = Date.now }) {
      this.synthesis = synthesis;
      this.createUtterance = createUtterance;
      this.now = now;
      this.seen = new Set();
      this.muted = true;
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      if (this.muted) this.synthesis?.cancel();
    }

    offer(message, language = 'en') {
      if (!message || this.seen.has(message.id)) return false;
      this.seen.add(message.id);
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value);
      // Never voice status text, replay muted remarks, or queue stale chatter.
      if (this.muted || !message.quip || message.expiresAt <= this.now()
        || !this.synthesis || this.synthesis.speaking || this.synthesis.pending) return false;
      const utterance = this.createUtterance(message.quip.slice(0, 240));
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
