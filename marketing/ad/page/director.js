// Timeline engine for the ads. Everything is a pure function of ad time `t` (seconds),
// evaluated once per rendered frame, so recordings are deterministic.
import * as THREE from 'three';
import { focusPoint, clearFocus } from '/js/scene/core.js';
import { emit } from '/js/net.js';

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * k * (k * (6 * k - 15) + 10)); // smootherstep

function catmull(p0, p1, p2, p3, k) {
  const k2 = k * k;
  const k3 = k2 * k;
  return 0.5 * (2 * p1 + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3);
}

export function createDirector({ overlay }) {
  const once = []; // { t, fn, fired }
  const spans = []; // { from, to, fn }
  const cues = []; // sound cues { t, name }
  let lastT = -1;

  const d = {
    cues,
    /** Run fn once when ad time passes t. Optional sound cue. */
    at(t, fn, sound) {
      once.push({ t, fn, fired: false });
      if (sound) cues.push({ t, name: sound });
      return d;
    },
    sound(t, name) {
      cues.push({ t, name });
      return d;
    },
    /** Call fn(localSeconds, progress0to1) every frame between from and to. */
    during(from, to, fn) {
      spans.push({ from, to, fn });
      return d;
    },

    /**
     * A colleague's cursor following recorded-looking waypoints: [{ t, p: [x,y,z], click? }].
     * Smooth Catmull-Rom path plus a little organic hand wobble, like motion capture.
     */
    cursor(id, keys, { seed = 1, wobble = 0.05 } = {}) {
      const ks = keys.map((k) => ({ ...k, v: new THREE.Vector3(...k.p) }));
      const first = ks[0].t;
      const last = ks[ks.length - 1].t;
      let visible = false;
      d.during(first, last + 0.05, (lt, prog, t) => {
        let i = 0;
        while (i < ks.length - 2 && t > ks[i + 1].t) i++;
        const a = ks[Math.max(0, i - 1)];
        const b = ks[i];
        const c = ks[i + 1] || b;
        const e = ks[Math.min(ks.length - 1, i + 2)];
        const k = c === b ? 1 : ease((t - b.t) / (c.t - b.t));
        const p = ['x', 'y', 'z'].map((ax) => catmull(a.v[ax], b.v[ax], c.v[ax], e.v[ax], k));
        p[0] += Math.sin(t * 2.3 + seed) * wobble + Math.sin(t * 7.1 + seed * 3) * wobble * 0.3;
        p[1] += Math.cos(t * 1.9 + seed * 2) * wobble * 0.8 + Math.sin(t * 6.3 + seed) * wobble * 0.25;
        emit('cursor', { id, p: p.map((n) => +n.toFixed(3)) });
        visible = true;
      });
      ks.filter((k) => k.click).forEach((k) => d.at(k.t, () => emit('ping', { id }), 'click'));
      d.at(last + 0.06, () => {
        if (visible) emit('cursor', { id, p: null });
      });
      return d;
    },

    /** Camera keyframes: [{ t, pos:[...], look:[...] } | { t, home: true }]. */
    camera(keys) {
      for (let i = 0; i < keys.length; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (a.home) {
          d.at(a.t, () => clearFocus());
          continue;
        }
        if (!b || b.home) {
          d.at(a.t, () => focusPoint(new THREE.Vector3(...a.pos), new THREE.Vector3(...a.look)));
          continue;
        }
        const pa = new THREE.Vector3(...a.pos);
        const pb = new THREE.Vector3(...b.pos);
        const la = new THREE.Vector3(...a.look);
        const lb = new THREE.Vector3(...b.look);
        const pos = new THREE.Vector3();
        const look = new THREE.Vector3();
        d.during(a.t, b.t, (lt, prog) => {
          const k = b.linear ? prog : ease(prog);
          focusPoint(pos.lerpVectors(pa, pb, k), look.lerpVectors(la, lb, k));
        });
      }
      return d;
    },

    /** Big kinetic caption. lines: [{ text, cls }] or a string. */
    caption(from, to, lines, { pos = 'bottom-left', cls = '' } = {}) {
      let el = null;
      d.at(from, () => {
        el = document.createElement('div');
        el.className = `ad-cap ${pos} ${cls}`;
        (typeof lines === 'string' ? [{ text: lines }] : lines).forEach((ln, i) => {
          const span = document.createElement('div');
          span.className = `ad-line ${ln.cls || ''}`;
          span.style.setProperty('--i', i);
          span.textContent = ln.text;
          el.append(span);
        });
        overlay.captions.append(el);
      });
      d.at(to, () => {
        if (!el) return;
        el.classList.add('out');
        const gone = el;
        setTimeout(() => gone.remove(), 600);
      });
      return d;
    },

    /** Fade to/from black: [{ t, a }] opacity keys. */
    fade(keys) {
      d.during(keys[0].t, keys[keys.length - 1].t, (lt, prog, t) => {
        let i = 0;
        while (i < keys.length - 2 && t > keys[i + 1].t) i++;
        const a = keys[i];
        const b = keys[i + 1];
        overlay.fade.style.opacity = String(lerp(a.a, b.a, ease((t - a.t) / (b.t - a.t))));
      });
      d.at(keys[keys.length - 1].t, () => {
        overlay.fade.style.opacity = String(keys[keys.length - 1].a);
      });
      return d;
    },

    update(t) {
      if (!d.sorted) {
        once.sort((a, b) => a.t - b.t);
        d.sorted = true;
      }
      for (const e of once) {
        if (!e.fired && t >= e.t) {
          e.fired = true;
          try {
            e.fn();
          } catch (err) {
            console.error('ad event failed at', e.t, err);
          }
        }
      }
      for (const s of spans) {
        if (t >= s.from && t <= s.to) {
          try {
            s.fn(t - s.from, (t - s.from) / (s.to - s.from), t);
          } catch (err) {
            console.error('ad span failed', err);
          }
        }
      }
      lastT = t;
    },
    get time() {
      return lastT;
    },
  };
  return d;
}
