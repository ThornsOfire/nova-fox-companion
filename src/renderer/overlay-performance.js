'use strict';
(function expose(root) {
  function fitSurface(rects, world, current, full = false) {
    const whole = { x: 0, y: 0, width: world.width, height: world.height };
    if (full) return whole;
    const valid = (Array.isArray(rects) ? rects : []).slice(0, 256).filter(r => r && [r.x,r.y,r.width,r.height].every(Number.isFinite)
      && r.width > 0 && r.height > 0).map(r => ({ x: Math.max(0,r.x), y: Math.max(0,r.y),
      right: Math.min(world.width,r.x+r.width), bottom: Math.min(world.height,r.y+r.height) }))
      .filter(r => r.right > r.x && r.bottom > r.y);
    if (!valid.length) return current || whole;
    const left = Math.min(...valid.map(r=>r.x)), top = Math.min(...valid.map(r=>r.y));
    const right = Math.max(...valid.map(r=>r.right)), bottom = Math.max(...valid.map(r=>r.bottom));
    const width = Math.min(world.width, Math.max(640, Math.ceil((right-left+256)/64)*64));
    const height = Math.min(world.height, Math.max(480, Math.ceil((bottom-top+256)/64)*64));
    const proposed = { x: Math.round(Math.max(0, Math.min(world.width-width,(left+right-width)/2))),
      y: Math.round(Math.max(0, Math.min(world.height-height,(top+bottom-height)/2))), width, height };
    if (current && left >= current.x+48 && top >= current.y+48 && right <= current.x+current.width-48
      && bottom <= current.y+current.height-48 && current.width*current.height <= width*height*1.5) return current;
    return proposed;
  }
  class FrameClock {
    constructor() { this.last = -Infinity; }
    due(now, active) {
      const interval = 1000/(active ? 30 : 12);
      if (now-this.last < interval-0.5) return false;
      this.last = now; return true;
    }
    reset() { this.last = -Infinity; }
  }
  class AnimationClock {
    constructor() { this.anchors = new WeakMap(); }
    advance(animations, now, isCssAnimation) {
      for (const animation of animations) {
        if (!isCssAnimation(animation)) continue;
        let anchor = this.anchors.get(animation);
        if (!anchor) {
          anchor = { time: now, position: Number(animation.currentTime)||0 };
          this.anchors.set(animation,anchor); animation.pause();
        }
        animation.currentTime = anchor.position + now-anchor.time;
      }
    }
  }
  const api = { fitSurface, FrameClock, AnimationClock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovaOverlayPerformance = api;
}(typeof window !== 'undefined' ? window : globalThis));
