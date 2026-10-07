// Overlay pieces shared by both cuts.
import { store } from '/js/net.js';

/** Live counters bound to the app's real store; numbers glide up and bump when they change. */
export function liveCard(d, overlay, { from, to, rows }) {
  const el = overlay.live;
  const shown = rows.map(() => 0);
  let built = false;
  const build = () => {
    el.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'live-head';
    head.innerHTML = '<span class="live-dot"></span>LIVE NOW';
    el.append(head);
    rows.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'live-row';
      const ic = document.createElement('span');
      ic.className = 'ic';
      ic.textContent = r.ic;
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = r.lbl;
      const b = document.createElement('b');
      b.textContent = '0';
      row.append(ic, lbl, b);
      r.el = row;
      r.b = b;
      el.append(row);
    });
    built = true;
  };
  d.at(from, () => {
    if (!built) build();
    el.classList.add('on');
  });
  d.during(from, to, () => {
    rows.forEach((r, i) => {
      const target = r.get(store);
      if (Math.round(shown[i]) !== target) {
        shown[i] += (target - shown[i]) * 0.35;
        if (Math.abs(target - shown[i]) < 0.5) shown[i] = target;
        const v = Math.round(shown[i]);
        if (r.b.textContent !== String(v)) {
          r.b.textContent = String(v);
          r.el.classList.remove('bump');
          void r.el.offsetWidth; // restart the bump animation
          r.el.classList.add('bump');
        }
      }
    });
  });
  d.at(to, () => el.classList.remove('on'));
}

export function endCard(d, overlay, t, config) {
  d.at(t, () => {
    const el = overlay.end;
    el.innerHTML = '';
    const add = (cls, text) => {
      if (!text) return;
      const n = document.createElement('div');
      n.className = cls;
      n.textContent = text;
      el.append(n);
    };
    add('end-logo', '🏢');
    add('end-brand', config.brand);
    add('end-tag', config.tagline);
    add('end-cta', config.cta);
    add('end-url', config.url);
    add('end-small', config.smallPrint);
    el.classList.add('on');
  }, 'end');
}
