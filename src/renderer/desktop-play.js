'use strict';
(function expose(root) {
  const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
  function covers(window, display, tolerance = 3) {
    return window.x <= display.x + tolerance && window.y <= display.y + tolerance
      && window.x + window.width >= display.x + display.width - tolerance
      && window.y + window.height >= display.y + display.height - tolerance;
  }
  function blockedDisplays(windows, displays) {
    return displays.filter((display) => windows.some((window) => covers(window, display.bounds || display)))
      .map((display) => display.bounds || display);
  }
  function subtract(rect, obstacle) {
    if (!intersects(rect, obstacle)) return [rect];
    const left = Math.max(rect.x, obstacle.x), right = Math.min(rect.x + rect.width, obstacle.x + obstacle.width);
    const top = Math.max(rect.y, obstacle.y), bottom = Math.min(rect.y + rect.height, obstacle.y + obstacle.height);
    return [
      { x: rect.x, y: rect.y, width: rect.width, height: top - rect.y },
      { x: rect.x, y: bottom, width: rect.width, height: rect.y + rect.height - bottom },
      { x: rect.x, y: top, width: left - rect.x, height: bottom - top },
      { x: right, y: top, width: rect.x + rect.width - right, height: bottom - top },
    ].filter((value) => value.width > 0 && value.height > 0);
  }
  function safeZones(zones, blocked) {
    return blocked.reduce((remaining, obstacle) => remaining.flatMap((rect) => subtract(rect, obstacle)), zones);
  }
  function escapeTarget(cursor, actor, zone) {
    const size = actor.size || 118;
    const corners = [{ x: zone.x + 12, y: zone.y + 56 },
      { x: zone.x + zone.width - size - 12, y: zone.y + 56 },
      { x: zone.x + 12, y: zone.y + zone.height - size * 1.4 },
      { x: zone.x + zone.width - size - 12, y: zone.y + zone.height - size * 1.4 }];
    return corners.sort((a, b) => Math.hypot(b.x - cursor.x, b.y - cursor.y) - Math.hypot(a.x - cursor.x, a.y - cursor.y))[0];
  }
  class PlayState {
    constructor() { this.pickups = []; this.escapeUntil = 0; this.nextPlayAt = 0; this.mode = 'roam'; this.until = 0; }
    pickup(now) {
      this.pickups = this.pickups.filter((time) => now - time < 12000);
      this.pickups.push(now); this.mode = 'carried';
    }
    drop(now) {
      if (this.pickups.length >= 3) {
        this.escapeUntil = now + 3500; this.pickups = []; this.mode = 'escape';
      } else this.mode = 'roam';
      this.nextPlayAt = now + 10000;
      return this.mode;
    }
    update({ now, idleMs, moved, reduced, interacting, nearCursor, canPeek, cursorAvailable = true }) {
      if (reduced || interacting) { this.mode = 'roam'; return this.mode; }
      if (now < this.escapeUntil) { this.mode = 'escape'; return this.mode; }
      if (moved) { this.mode = 'roam'; this.nextPlayAt = now + 10000; return this.mode; }
      if (this.mode === 'escape') this.mode = 'roam';
      if (this.mode === 'stalk' && nearCursor) { this.mode = 'pounce'; this.until = now + 2200; }
      if (['pounce', 'peek', 'stalk'].includes(this.mode) && now >= this.until) {
        this.mode = 'roam'; this.nextPlayAt = now + 20000;
      }
      if (idleMs >= 6000 && now >= this.nextPlayAt && this.mode === 'roam') {
        this.mode = nearCursor ? 'pounce' : canPeek ? 'peek' : cursorAvailable ? 'stalk' : 'roam';
        this.until = now + (this.mode === 'peek' ? 4500 : this.mode === 'stalk' ? 12000 : 2200);
        this.nextPlayAt = now + 20000;
      }
      return this.mode;
    }
  }
  const api = { covers, blockedDisplays, subtract, safeZones, escapeTarget, PlayState, intersects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovaDesktopPlay = api;
}(typeof window !== 'undefined' ? window : globalThis));
