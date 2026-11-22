/* Team Empire FX engine: animated page backgrounds, sci-fi logo-glow page transition, audit intro, welcome galaxy.
   No dependencies. Scenes live in fx-scenes.js. Honours prefers-reduced-motion, pauses when the tab is hidden and
   lowers its own resolution if the device is slow. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const Q0 = ((navigator.hardwareConcurrency || 4) <= 4 || Math.min(screen.width, screen.height) < 600) ? 0.62 : 1;
const LOGO = new Image(); LOGO.src = 'logo.png';
const spr = (w, h, fn) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); fn(c.getContext('2d'), c.width, c.height); return c; };
const glow = (c, x, y, r, rgb, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const logo = (c, x, y, s, a) => { if (!LOGO.complete || !LOGO.naturalWidth) return; c.save(); c.globalAlpha = a == null ? 1 : a; rr(c, x - s / 2, y - s / 2, s, s, s * .22); c.clip(); c.drawImage(LOGO, x - s / 2, y - s / 2, s, s); c.restore(); };

const Scenes = {};
const stages = [];
let raf = 0, last = 0;

function addStage(id) {
  const cv = document.getElementById(id); if (!cv) return null;
  let st = stages.find((s) => s.id === id); if (st) { st.cv = cv; st.ctx = cv.getContext('2d', { alpha: false }); return st; }
  st = { id, cv, ctx: cv.getContext('2d', { alpha: false }), w: 0, h: 0, dpr: 1, res: 1, q: Q0, t: 0, scene: null, name: null, active: false, cs: 0, n: 0 };
  stages.push(st); return st;
}
function sizeStage(st) {
  const w = st.cv.clientWidth || innerWidth, h = st.cv.clientHeight || innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * st.res;
  st.w = w; st.h = h; st.dpr = dpr;
  st.cv.width = Math.max(2, Math.round(w * dpr)); st.cv.height = Math.max(2, Math.round(h * dpr));
  st.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function build(st) { sizeStage(st); st.scene = Scenes[st.name] ? Scenes[st.name](st) : null; }
function setScene(st, name) {
  st.name = name; st.t = 0; st.cs = 0; st.n = 0;
  if (!name || !Scenes[name]) { st.scene = null; st.active = false; return; }
  build(st);
  if (reduced()) { try { st.scene.draw(st, 6, 0); } catch (e) { /* ignore */ } st.active = false; return; }
  st.active = true; kick();
}
function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
function loop(now) {
  raf = 0;
  let any = false;
  for (const st of stages) if (st.active && st.scene) any = true;
  if (!any) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(100, now - last);
  if (dt < 22) return;
  last = now;
  for (const st of stages) {
    if (!st.active || !st.scene) continue;
    st.t += dt / 1000;
    const t0 = performance.now();
    try { st.scene.draw(st, st.t, dt / 1000); } catch (e) { console.error('[fx]', st.name, e); st.scene = null; st.active = false; continue; }
    const cost = performance.now() - t0;
    st.cs = st.cs ? st.cs * .92 + cost * .08 : cost; st.n++;
    if (st.n > 45 && st.cs > 13 && st.res > .56) { st.res = Math.max(.56, st.res * .8); st.n = 0; st.cs = 0; build(st); }   /* slow device: render smaller */
  }
}
let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { stages.forEach((st) => { if (!st.name || !st.cv.clientWidth) return; build(st); if (!st.active && st.scene) { try { st.scene.draw(st, 6, 0); } catch (e) { /* ignore */ } } }); }, 160); });

const FX = window.FX = {
  scenes: Scenes, helpers: { TAU, clamp, lerp, rng, spr, glow, rr, logo, LOGO, reduced },
  faces: [], wl: { warp: 1, warpTarget: .07, geom: null, bursts: [] },
  scene(name) {
    const root = document.documentElement;
    if (!name) { root.classList.remove('fx-on'); root.removeAttribute('data-scene'); const st = stages.find((s) => s.id === 'bgfx'); if (st) { st.active = false; st.scene = null; st.name = null; } return; }
    root.classList.add('fx-on'); root.setAttribute('data-scene', name);
    const st = addStage('bgfx') || (() => { const cv = document.createElement('canvas'); cv.id = 'bgfx'; cv.setAttribute('aria-hidden', 'true'); document.body.insertBefore(cv, document.body.firstChild); return addStage('bgfx'); })();
    if (st.name === name && st.scene) return;
    setScene(st, name);
  },
  setFaces(urls) { FX.faces = []; (urls || []).slice(0, 40).forEach((u) => { const im = new Image(); im.decoding = 'async'; im.src = u; FX.faces.push(im); }); },
  busy() { return busy; },
  run(kind, swap, done) { return runTransition(kind, swap, done); },
  welcome: {
    start() { const st = addStage('wlfx'); if (!st) return; const W = FX.wl; W.warp = 1; W.warpTarget = .07; W.bursts.length = 0; W.born = performance.now(); setScene(st, 'welcome'); },
    stop() { const st = stages.find((s) => s.id === 'wlfx'); if (st) { st.active = false; st.scene = null; } },
    geom(g) { FX.wl.geom = g; },
    warp(v) { FX.wl.warpTarget = v; },
    burst(x, y, n) { FX.wl.bursts.push({ x, y, n: n || 40 }); },
  },
};

/* ---------- logo-glow page transition ---------- */
let overlay = null, busy = false;
const AUDIT_SVG = (() => {
  const bars = Array.from({ length: 28 }, (_, i) => { const h = 8 + ((Math.sin(i * 1.7) + 1) / 2) * 38 + ((i * 37) % 11); return `<rect x="${(22 + i * 5.2).toFixed(1)}" y="${(118 - h / 2).toFixed(1)}" width="3" height="${h.toFixed(1)}" rx="1.5" style="animation-delay:${(-(i % 7) * .09).toFixed(2)}s;animation-duration:${(.34 + (i % 5) * .06).toFixed(2)}s"/>`; }).join('');
  const rows = ['Greeting', 'Empathy', 'Resolution', 'Closing'].map((t, k) => `<g class="au-row" transform="translate(404 ${66 + k * 26})"><circle cx="8" cy="0" r="7"/><path class="au-ck" style="--d:${(.62 + k * .3).toFixed(2)}s" d="M4.6 .2l2.4 2.5 4.7-5.2"/><text x="24" y="4" class="au-t" style="font-size:10.5px;letter-spacing:.04em">${t}</text><text x="148" y="4" text-anchor="end" class="au-pass" style="--d:${(.7 + k * .3).toFixed(2)}s">PASS</text></g>`).join('');
  return `<svg class="au-svg" viewBox="0 0 560 430" aria-hidden="true">
  <g class="au-panel" style="--d:.3s"><rect x="10" y="38" width="170" height="132" rx="10" fill="rgba(12,48,92,.62)" stroke="#5fe3ff" stroke-width="1.2"/><path d="M10 62H180" stroke="#5fe3ff" stroke-opacity=".35"/><circle class="au-rec" cx="26" cy="50" r="4" fill="#ff5d6c"/><text x="36" y="53.5" class="au-t">CALL AUDIT · LIVE</text>
    <path d="M22 118H162" stroke="#5fe3ff" stroke-opacity=".25"/><g class="au-bars">${bars}</g><line class="au-play" x1="22" y1="72" x2="22" y2="162"/><g class="au-mag"><circle cx="24" cy="118" r="15" fill="rgba(255,255,255,.08)" stroke="#c4f7ff" stroke-width="2"/><path d="M35 129l11 11" stroke="#c4f7ff" stroke-width="3.6" stroke-linecap="round"/><path d="M15 112a11 11 0 0 1 8-6" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none" stroke-linecap="round"/></g></g>
  <path class="au-beam" d="M180 98C225 78 268 76 305 94"/>
  <g class="au-list" style="--d:.42s"><rect x="392" y="38" width="160" height="142" rx="10" fill="rgba(12,48,92,.62)" stroke="#5fe3ff" stroke-width="1.2"/><text x="404" y="56" class="au-t">QUALITY CHECKLIST</text>${rows}
    <text x="404" y="170" class="au-t" style="font-size:9px">QUALITY</text><rect x="448" y="163" width="92" height="7" rx="3.5" fill="rgba(255,255,255,.12)"/><rect class="au-fill" x="448" y="163" width="92" height="7" rx="3.5" fill="#3dffb6"/></g>
  <g class="au-man">
    <rect class="au-leg l" x="322" y="194" width="15" height="58" rx="7.5" fill="#2a4474"/><rect class="au-leg r" x="340" y="194" width="15" height="58" rx="7.5" fill="#2a4474"/>
    <rect class="au-leg l" x="317" y="249" width="24" height="10" rx="5" fill="#0f1623"/><rect class="au-leg r" x="337" y="249" width="24" height="10" rx="5" fill="#0f1623"/>
    <rect x="310" y="190" width="56" height="13" rx="6.5" fill="#26406b"/>
    <path d="M308 140c0-10 9-17 30-17s30 7 30 17v57a6 6 0 0 1-6 6h-48a6 6 0 0 1-6-6z" fill="#1d3157"/><path d="M327 123l11 31 11-31z" fill="#f5f8ff"/><path d="M335 129h6l2.5 24-5.5 6-5.5-6z" fill="#d9ac69"/><path d="M327 123l-4 36M349 123l4 36" stroke="rgba(255,255,255,.22)" stroke-width="1.2"/><rect x="352" y="159" width="12" height="8" rx="2" fill="#3de0c0"/>
    <rect x="332" y="112" width="12" height="13" rx="3" fill="#e5b490"/>
    <path d="M312 140L300 168L322 180" stroke="#1d3157" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <g><rect x="314" y="156" width="34" height="44" rx="4" fill="#eef2fa" stroke="#8aa0c4" stroke-width="1.2"/><rect x="324" y="152" width="14" height="8" rx="2" fill="#6a7fa6"/><path d="M320 172h22M320 180h22M320 188h14" stroke="#9fb3d6" stroke-width="1.6" stroke-linecap="round"/><path d="M318 171l1.6 1.6 3-3.2" stroke="#2fbf86" stroke-width="1.2" fill="none"/></g>
    <circle cx="322" cy="182" r="5.5" fill="#efc19f"/>
    <path d="M364 140L376 168L352 178" stroke="#1d3157" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="350" cy="178" r="5.5" fill="#efc19f"/>
    <g class="au-pen"><path d="M350 178L342 189" stroke="#d9ac69" stroke-width="3.2" stroke-linecap="round"/><path d="M342 189l-1.4 2.6" stroke="#222" stroke-width="2" stroke-linecap="round"/></g>
    <g class="au-head"><circle cx="338" cy="94" r="21" fill="#efc19f"/><path d="M317 91c0-17 9-27 21-27s21 10 21 27c-6-9-13-12-21-12s-15 3-21 12z" fill="#2a1d14"/><circle cx="317" cy="98" r="4" fill="#e5b490"/><circle cx="359" cy="98" r="4" fill="#e5b490"/>
      <circle class="au-eye" cx="330" cy="97" r="2.3" fill="#1b1b1b"/><circle class="au-eye" cx="346" cy="97" r="2.3" fill="#1b1b1b"/><path d="M331 106q7 6 14 0" stroke="#8a4b34" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M313 92a25 25 0 0 1 50 0" stroke="#2b3a55" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="307" y="89" width="9" height="19" rx="4.5" fill="#1f2c46"/><rect x="360" y="89" width="9" height="19" rx="4.5" fill="#1f2c46"/><circle cx="311.5" cy="98" r="1.8" fill="#3de0c0"/>
      <path d="M364 106c1 11-8 16-18 11" stroke="#2b3a55" stroke-width="2.8" fill="none" stroke-linecap="round"/><circle cx="346" cy="117" r="3.2" fill="#3de0c0"/>
      <path class="au-wave" style="--d:0s" d="M302 90q-6 8 0 16"/><path class="au-wave" style="--d:.3s" d="M297 85q-10 13 0 26"/><path class="au-wave" style="--d:.6s" d="M292 80q-14 18 0 36"/></g>
  </g>
  <g class="au-stamp" transform="translate(112 238)"><g transform="rotate(-14)"><rect x="-64" y="-17" width="128" height="34" rx="7" fill="rgba(0,40,28,.5)" stroke="#46ffb5" stroke-width="2.4"/><text x="8" y="6" text-anchor="middle">AUDITED</text><path d="M-52 0l6 7 11-14" stroke="#46ffb5" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>
  <g class="au-cap"><text x="280" y="421" text-anchor="middle" class="doing">AUDITING CALL …</text><text x="280" y="421" text-anchor="middle" class="done" style="fill:#46ffb5">AUDIT COMPLETE</text></g></svg>`;
})();
function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div'); overlay.id = 'fxOverlay'; overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `<div class="fxo-back"></div><div class="fxo-stage">
    <div class="fxo-rays"></div><div class="fxo-bloom"></div>
    <svg class="fxo-ring c" viewBox="-100 -100 200 200"><circle r="96"/></svg><svg class="fxo-ring a" viewBox="-100 -100 200 200"><circle r="96"/></svg><svg class="fxo-ring b" viewBox="-100 -100 200 200"><circle r="96"/></svg>
    <div class="fxo-logo"><img class="gr" src="logo.png" alt=""><img class="gc" src="logo.png" alt=""><img class="main" src="logo.png" alt=""><span class="sweep"></span></div>
    <i class="fxo-flare"></i><i class="fxo-flare v"></i><i class="fxo-ghost g1"></i><i class="fxo-ghost g2"></i><i class="fxo-ghost g3"></i><i class="fxo-shock"></i></div>
    <canvas class="fxo-sparks"></canvas><div class="fxo-flash"></div>
    <div class="fxo-audit"><div class="au"><div class="au-glow"></div><img class="au-logo" src="logo.png" alt="">${AUDIT_SVG}</div></div>`;
  document.body.appendChild(overlay);
  return overlay;
}
/* energy gathers into the logo while it charges, then bursts outwards at the flash */
function sparks(T, at) {
  const cv = overlay.querySelector('.fxo-sparks'); cv.width = innerWidth; cv.height = innerHeight;
  const c = cv.getContext('2d'), cx = innerWidth / 2, cy = innerHeight / 2, P = [];
  let raf2 = 0;
  const cols = ['255,240,200', '255,200,110', '140,210,255', '255,255,255'];
  let alive = true, prev = performance.now(); const t0 = prev, b = { a: false, b: false };
  const burst = (n, v0, v1) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = lerp(v0, v1, Math.random()); P.push({ x: cx + Math.cos(a) * 36, y: cy + Math.sin(a) * 36, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, L: .45 + Math.random() * .75, s: .8 + Math.random() * 2.3, c: cols[(Math.random() * 4) | 0], k: 0 }); } };
  const inflow = () => { const a = Math.random() * TAU, r = lerp(Math.min(innerWidth, innerHeight) * .32, Math.min(innerWidth, innerHeight) * .62, Math.random()), v = 420 + Math.random() * 520; P.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v, l: 0, L: r / v * .92, s: .8 + Math.random() * 1.8, c: cols[(Math.random() * 4) | 0], k: 1 }); };
  (function frame(now) {
    if (!alive) return; const dt = Math.min(.05, (now - prev) / 1000); prev = now; const t = (now - t0) / 1000;
    c.clearRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    if (t > T * .1 && t < at * .98) { inflow(); inflow(); if (t > at * .5) { inflow(); inflow(); } }
    if (!b.a && t > at * .36) { b.a = true; burst(22, 40, 150); }
    if (!b.b && t > at * .985) { b.b = true; burst(110, 160, 720); }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.l += dt; const k = 1 - p.l / p.L; if (k <= 0) { P.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (!p.k) { p.vx *= .985; p.vy = p.vy * .985 + 14 * dt; }
      const a = p.k ? Math.min(1, p.l * 5) * (.4 + .6 * (1 - k)) : k;
      c.strokeStyle = `rgba(${p.c},${a})`; c.lineWidth = p.s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); c.stroke();
    }
    raf2 = requestAnimationFrame(frame);
  })(prev);
  return () => { alive = false; cancelAnimationFrame(raf2); c.clearRect(0, 0, cv.width, cv.height); };
}
const KINDS = { glow: { T: 1.72, at: 1.2, cls: 'f' }, quick: { T: .86, at: .6, cls: 'f' }, audit: { T: 2.3, at: 2.0, cls: 'audit' } };
function runTransition(kind, swap, done) {
  const cfg = KINDS[kind] || KINDS.glow;
  if (reduced()) { swap(); if (done) done(); return; }
  ensureOverlay(); busy = true;
  overlay.className = 'on ' + cfg.cls; overlay.style.setProperty('--T', cfg.T + 's');
  void overlay.offsetWidth; overlay.classList.add('go');
  const stop = cfg.cls === 'audit' ? null : sparks(cfg.T, cfg.at);
  setTimeout(() => { try { swap(); } catch (e) { console.error('[fx] swap', e); } }, cfg.at * 1000);
  setTimeout(() => { overlay.className = ''; busy = false; if (stop) stop(); if (done) { try { done(); } catch (e) { console.error('[fx] done', e); } } }, cfg.T * 1000 + 50);
}
})();
