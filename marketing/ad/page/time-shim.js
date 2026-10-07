// Time control for the ad page. Must run before any other script.
//
// ?record=1  → fully virtual time: requestAnimationFrame, timers, Date, performance.now and
//              CSS/Web animations only advance when the recorder calls window.__advance(ms).
//              Rendering speed no longer matters, so every captured frame is perfectly smooth.
// otherwise  → real time, but the calendar/clock reads as the shoot date (for live preview).
(() => {
  if (window.__timeShim) return;
  const params = new URLSearchParams(location.search);
  const shoot = new Date(params.get('date') || '2026-10-07T10:30:00').getTime();
  const RealDate = Date;
  const realNow = performance.now.bind(performance);
  const record = params.get('record') === '1';
  let vt = 0; // virtual milliseconds since page start (record mode)
  const elapsed = () => (record ? vt : realNow());

  class ShootDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(shoot + elapsed());
      else super(...args);
    }
    static now() {
      return shoot + elapsed();
    }
  }
  window.Date = ShootDate;
  window.__timeShim = { record };
  if (!record) return;

  performance.now = () => vt;

  let rafId = 0;
  const raf = new Map();
  window.requestAnimationFrame = (cb) => {
    raf.set(++rafId, cb);
    return rafId;
  };
  window.cancelAnimationFrame = (id) => raf.delete(id);

  let timerId = 0;
  const timers = new Map();
  window.setTimeout = (cb, ms = 0, ...args) => {
    timers.set(++timerId, { at: vt + Math.max(0, Number(ms) || 0), cb, args });
    return timerId;
  };
  window.setInterval = (cb, ms = 0, ...args) => {
    const every = Math.max(1, Number(ms) || 0);
    timers.set(++timerId, { at: vt + every, cb, args, every });
    return timerId;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);

  const animStart = new WeakMap();
  window.__advance = (ms) => {
    const target = vt + ms;
    // Fire due timers in time order (including ones scheduled while firing).
    for (;;) {
      let nextId = null;
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (!next || t.at < next.at)) {
          nextId = id;
          next = t;
        }
      }
      if (!next) break;
      vt = Math.max(vt, next.at);
      if (next.every) next.at += next.every;
      else timers.delete(nextId);
      try {
        if (typeof next.cb === 'function') next.cb(...next.args);
      } catch (err) {
        console.error(err);
      }
    }
    vt = target;
    const cbs = [...raf.values()];
    raf.clear();
    for (const cb of cbs) {
      try {
        cb(vt);
      } catch (err) {
        console.error(err);
      }
    }
    // Drive every CSS transition/animation from the virtual clock too.
    for (const a of document.getAnimations()) {
      if (!animStart.has(a)) animStart.set(a, vt - (a.currentTime || 0));
      a.pause();
      a.currentTime = Math.max(0, vt - animStart.get(a));
    }
  };
})();
