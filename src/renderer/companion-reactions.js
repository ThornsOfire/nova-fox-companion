'use strict';

// Original Nova behavior. No transcript content or network access is needed.
(function expose(root) {
  const lines = {
    en: {
      working: ['I have assumed a supervisory pose.', 'Looking busy alongside you.'],
      attention: ['Your agent needs a decision. This one requires thumbs.'],
      idle: ['I supervised the whole thing. From a comfortable distance.'],
      done: ['Time for my extremely earned break.'],
    },
    fr: {
      working: ['Je prends ma pose de superviseur.', 'Je fais aussi semblant de travailler.'],
      attention: ["Votre agent attend une décision. Il faut des pouces pour ça."],
      idle: ["J’ai tout supervisé. De loin, bien au chaud."],
      done: ["C’est l’heure de ma pause bien méritée."],
    },
  };

  class CompanionReactions {
    constructor({ durationMs = 8000, cooldownMs = 20000 } = {}) {
      this.durationMs = durationMs;
      this.cooldownMs = cooldownMs;
      this.previous = new Map();
      this.messages = new Map();
      this.lastRemark = -Infinity;
      this.sequence = 0;
      this.initialized = false;
    }

    observe(snapshot, { enabled = true, language = 'en', cloud = false, now = Date.now() } = {}) {
      const next = new Map();
      for (const session of snapshot.sessions || []) {
        for (const agent of session.agents || []) {
          const key = `${session.id}/${agent.id}`;
          next.set(key, agent.status);
          const previous = this.previous.get(key);
          const changed = previous !== agent.status;
          // Bootstrap is silent; metadata refreshes never repeat a remark.
          if (!enabled || !this.initialized || !changed || !lines.en[agent.status]) continue;
          // Requests for input always take priority over casual remarks.
          if (agent.status === 'working' && now - this.lastRemark < this.cooldownMs) continue;
          const choices = (lines[language] || lines.en)[agent.status];
          const mayQuip = !cloud && agent.status !== 'attention' && now - this.lastRemark >= this.cooldownMs;
          const quip = mayQuip ? choices[this.sequence++ % choices.length] : null;
          const statuses = language === 'fr'
            ? { working: 'Au travail', attention: 'Décision requise', idle: 'Tour terminé', done: 'Agent arrêté' }
            : { working: 'Working', attention: 'Needs your input', idle: 'Turn finished', done: 'Agent stopped' };
          this.messages.set(key, {
            id: `${key}:${now}:${this.sequence}`, text: statuses[agent.status], quip,
            status: agent.status, expiresAt: now + this.durationMs,
          });
          if (quip) this.lastRemark = now;
        }
      }
      for (const [key, message] of this.messages) {
        if (!enabled || !next.has(key) || message.expiresAt <= now
          || next.get(key) !== message.status) this.messages.delete(key);
      }
      this.previous = next;
      this.initialized = true;
    }

    get(sessionId, agentId, now = Date.now()) {
      const key = `${sessionId}/${agentId}`;
      const message = this.messages.get(key);
      if (message && message.expiresAt > now) return message;
      this.messages.delete(key);
      return null;
    }

    accept(reaction, now = Date.now()) {
      const key = `${reaction.sessionId}/${reaction.agentId}`;
      if (this.previous.get(key) !== reaction.status || reaction.expiresAt <= now) return false;
      const previous = this.messages.get(key);
      const statuses = { working: 'Working', idle: 'Turn finished', done: 'Agent stopped',
        attention: 'Needs your input', dormant: 'Resting' };
      this.messages.set(key, { ...reaction, text: previous?.text || statuses[reaction.status] || 'Nova' });
      return true;
    }

    moved(sessionId, agentId, now = Date.now()) {
      if (now - this.lastRemark < this.cooldownMs) return;
      const key = `${sessionId}/${agentId}`;
      const status = this.previous.get(key);
      if (!status) return;
      this.lastRemark = now;
      this.accept({ sessionId, agentId, status, id: `moved:${now}:${this.sequence++}`,
        quip: 'Ah. An unscheduled relocation.', mood: 'amused', expiresAt: now + this.durationMs }, now);
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { CompanionReactions };
  else root.NovaCompanion = { CompanionReactions };
}(typeof window !== 'undefined' ? window : globalThis));
