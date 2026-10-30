'use strict';
const menu = document.querySelector('#menu');
window.novaTray.onContent(items => {
  menu.replaceChildren();
  items.forEach((item, index) => {
    if (item.type === 'separator') {
      const separator = document.createElement('div'); separator.className = 'separator';
      separator.setAttribute('role', 'separator'); menu.append(separator); return;
    }
    const button = document.createElement('button');
    button.disabled = !item.enabled;
    button.setAttribute('role', item.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem');
    if (item.type === 'checkbox') button.setAttribute('aria-checked', String(item.checked));
    const check = document.createElement('span'); check.className = 'check'; check.setAttribute('aria-hidden', 'true');
    check.textContent = item.type === 'checkbox' && item.checked ? '✓' : '';
    const label = document.createElement('span'); label.textContent = item.label;
    button.append(check, label); button.addEventListener('click', () => window.novaTray.choose(index));
    menu.append(button);
  });
  menu.querySelector('button:not(:disabled)')?.focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); window.novaTray.choose('close'); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
  if (!buttons.length) return;
  const current = buttons.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
});
