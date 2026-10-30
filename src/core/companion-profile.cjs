'use strict';

function introduction(language = 'en') {
  return language === 'fr'
    ? 'Bonjour ! Je suis Nova, votre petit renard spirituel. Comment dois-je vous appeler ?'
    : "Hi! I’m Nova, your little spirit fox companion. What should I call you?";
}

function preferredName(value) {
  if (typeof value !== 'string') throw new Error('Please tell Nova what to call you.');
  const name = value.trim().replace(/^(?:my name is|please call me|call me|i am|i'm|i’m)\s+/iu, '').trim();
  if (!name || [...name].length > 60 || /[\x00-\x1f\x7f<>]/u.test(name)) {
    throw new Error('Choose a name of 1–60 characters without control characters or angle brackets.');
  }
  return name;
}

function welcome(name, language = 'en', changed = false) {
  if (language === 'fr') return changed ? `D’accord, ${name}. Je m’en souviendrai !`
    : `Enchantée, ${name} ! Je vais veiller sur le programme des siestes.`;
  return changed ? `Got it, ${name}. I’ll remember that!`
    : `Lovely to meet you, ${name}! I’ll be supervising the nap schedule.`;
}

module.exports = { introduction, preferredName, welcome };
