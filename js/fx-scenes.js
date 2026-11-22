/* Team Empire FX scenes: one animated canvas background per page. Every scene carries the Team Empire logo. */
(() => {
'use strict';
const { TAU, clamp, lerp, rng, spr, glow, rr, logo } = FX.helpers;
const S = FX.scenes, PI = Math.PI;
const font = (w, s) => `${w} ${s}px "Space Grotesk",Inter,"Noto Sans Bengali","Nirmala UI",system-ui,sans-serif`;
const frame = (fn) => (st, t, dt) => { const c = st.ctx; c.save(); try { fn(c, st, t, dt); } finally { c.restore(); } };
const blobs = (c, W, H, list) => list.forEach(([x, y, r, rgb, a]) => { const rad = r * Math.max(W, H), g = c.createRadialGradient(x * W, y * H, 0, x * W, y * H, rad); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H); });
const vgrad = (c, W, H, stops) => { const g = c.createLinearGradient(0, 0, 0, H); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, W, H); };
const star5 = (c, x, y, R0, r0) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? r0 : R0; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };
const spark4 = (c, x, y, s, a) => { c.globalAlpha = a; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.fill(); c.globalAlpha = 1; };

/* =============== DASHBOARD: deep space, small planets, a meteor every 5 s, a tiny far black hole =============== */
S.space = (st) => {
  const { w, h } = st, R = rng(7), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#02030a'], [.5, '#050921'], [1, '#090820']]); blobs(c, W, H, [[.18, .22, .55, '92,72,214', .30], [.82, .18, .45, '40,150,230', .22], [.55, .82, .55, '178,62,176', .20], [.08, .88, .38, '30,176,166', .16], [.92, .72, .32, '230,150,60', .10], [.5, .45, .7, '30,60,150', .12]]); });
  const stars = Array.from({ length: Math.round(clamp(w * h / 4300, 90, 520) * q) }, () => { const l = R(); return { x: R() * w, y: R() * h, s: l < .72 ? 1 : l < .94 ? 1.6 : 2.4, p: R() * TAU, v: .6 + R() * 2.4, d: l < .72 ? 2.5 : l < .94 ? 6 : 11, c: R() < .2 ? '185,212,255' : R() < .32 ? '255,224,190' : '255,255,255' }; });
  const bh = { x: Math.min(w - 80, w * .5 + 130), y: 104, rh: 7 };
  const PAL = [
    { a: '#a6dcff', b: '#2f7fd1', d: '#0a2a5c', glow: '110,190,255' }, { a: '#ffb27a', b: '#d2582a', d: '#4a1408', glow: '255,140,80' },
    { a: '#f4e2b8', b: '#c79a5a', d: '#4d3418', bands: '110,70,30' }, { a: '#d7f4ff', b: '#7fc6e6', d: '#1d4a66', glow: '160,230,255' },
    { a: '#dcb8ff', b: '#8a52d6', d: '#2a0f5a', glow: '180,120,255', bands: '60,20,120' }, { a: '#b6f2a5', b: '#4aa84e', d: '#12401a', glow: '120,230,130' },
    { a: '#ffd9a0', b: '#e29a3a', d: '#5c2f06', bands: '150,70,10' }, { a: '#ffb8d6', b: '#d6568c', d: '#4a0f2c', glow: '255,130,190' },
    { a: '#c9d3e6', b: '#7c88a3', d: '#1f2638' }, { a: '#ff9a6a', b: '#8a1f0f', d: '#220402', glow: '255,90,40' }];
  const planets = []; let guard = 0;
  while (planets.length < Math.round(17 * Math.max(.72, q)) && guard++ < 500) {
    const r = 3 + Math.pow(R(), 2.2) * 15, x = R() * w, y = R() * h;
    if (Math.hypot(x - bh.x, y - bh.y) < 130 || planets.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 56)) continue;
    const pal = PAL[(R() * PAL.length) | 0];
    planets.push({ x, y, r, pal, amp: 5 + R() * 16, sp: .05 + R() * .12, ph: R() * TAU, moon: r > 7 && R() < .5, ring: r > 6 && R() < .25, tilt: -.5 + R() });
  }
  const planet = (c, x, y, r, p, t) => {
    const ring = (front) => { c.save(); c.translate(x, y); c.rotate(p.tilt); c.strokeStyle = 'rgba(230,205,160,.55)'; c.lineWidth = r * .26; c.beginPath(); c.ellipse(0, 0, r * 1.95, r * .5, 0, front ? 0 : PI, front ? PI : TAU); c.stroke(); c.strokeStyle = 'rgba(255,240,210,.35)'; c.lineWidth = r * .07; c.beginPath(); c.ellipse(0, 0, r * 2.3, r * .6, 0, front ? 0 : PI, front ? PI : TAU); c.stroke(); c.restore(); };
    if (p.ring) ring(false);
    if (p.pal.glow) glow(c, x, y, r * 1.9, p.pal.glow, .3);
    let g = c.createRadialGradient(x - r * .42, y - r * .42, r * .08, x, y, r * 1.02); g.addColorStop(0, p.pal.a); g.addColorStop(.55, p.pal.b); g.addColorStop(1, p.pal.d);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (p.pal.bands) { c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); for (let i = -2; i <= 2; i++) { c.fillStyle = `rgba(${p.pal.bands},${.16 + (i & 1) * .1})`; c.fillRect(x - r, y + i * r * .36 - r * .09, r * 2, r * .18); } c.restore(); }
    g = c.createRadialGradient(x - r * .55, y - r * .55, r * .25, x + r * .1, y + r * .1, r * 1.18); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.62, 'rgba(0,0,8,.18)'); g.addColorStop(1, 'rgba(0,0,12,.84)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (p.ring) ring(true);
    if (p.moon) { const a = t * (.5 + p.sp * 4) + p.ph, mx = x + Math.cos(a) * r * 2.2, my = y + Math.sin(a) * r * .8, mr = Math.max(1.4, r * .22); const mg = c.createRadialGradient(mx - mr * .4, my - mr * .4, 0, mx, my, mr); mg.addColorStop(0, '#f2f2f2'); mg.addColorStop(1, '#4b4f5c'); c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); }
  };
  const blackHole = (c, t) => {
    const { x, y, rh } = bh; c.save(); c.translate(x, y);
    glow(c, 0, 0, 60, '255,140,60', .15 + .04 * Math.sin(t * 1.3)); glow(c, 0, 0, 30, '255,190,120', .12);
    c.rotate(-.22); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,196,120,.85)'; c.lineWidth = 1.6; c.shadowColor = 'rgba(255,150,60,.95)'; c.shadowBlur = 9; c.beginPath(); c.arc(0, 0, rh + 3.2, 0, TAU); c.stroke(); c.shadowBlur = 0;
    const disc = (front) => { const a0 = front ? 0 : PI, a1 = front ? PI : TAU; [[31, 7.6, 'rgba(130,40,80,.55)', 4.4], [25, 6.3, 'rgba(255,120,50,.8)', 3.4], [19, 5, 'rgba(255,214,150,.95)', 2.6], [14, 3.8, 'rgba(255,255,240,1)', 1.5]].forEach(([rx, ry, col, lw]) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, a0, a1); c.stroke(); }); };
    disc(false);
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, rh, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,225,180,.9)'; c.lineWidth = .9; c.beginPath(); c.arc(0, 0, rh + .4, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'lighter'; disc(true);
    for (let k = 0; k < 3; k++) { const a = t * 1.7 + k * 2.1, front = Math.sin(a) > 0; glow(c, Math.cos(a) * 22, Math.sin(a) * 5.4, front ? 6 : 4, '255,230,190', front ? .9 : .35); }
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const u = (t * .2 + i / 9) % 1, r = lerp(66, rh + 2, Math.pow(u, 1.5)), a = i * 2.4 + t * .8 + (1 - u) * 6; c.fillStyle = `rgba(255,205,150,${(Math.sin(u * PI) * .85).toFixed(3)})`; c.fillRect(bh.x + Math.cos(a) * r - .7, bh.y + Math.sin(a) * r * .45 - .7, 1.5, 1.5); }
    c.restore();
  };
  let nextM = 1.4; const M = [], P = [];
  const spawn = (t) => { const sx = w * (.45 + R() * .6), D = 1.5 + R() * .3; M.push({ sx, sy: -30, ex: sx - w * (.38 + R() * .3), ey: h * (.62 + R() * .3), D, t0: t }); };
  return { draw: frame((c, st, t, dt) => {
    c.drawImage(bg, 0, 0, w, h);
    for (const s of stars) { const x = (s.x + t * s.d) % w, a = .35 + .65 * (.5 + .5 * Math.sin(t * s.v + s.p)); c.fillStyle = `rgba(${s.c},${a.toFixed(3)})`; c.fillRect(x, s.y, s.s, s.s); if (s.s > 2) glow(c, x + 1, s.y + 1, 7, s.c, .22 * a); }
    blackHole(c, t);
    for (const p of planets) planet(c, p.x + Math.sin(t * p.sp + p.ph) * p.amp, p.y + Math.cos(t * p.sp * .8 + p.ph) * p.amp * .6, p.r, p, t);
    if (t >= nextM) { nextM += 5; spawn(t); }            /* one meteor every 5 seconds */
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = M.length - 1; i >= 0; i--) {
      const m = M[i], u = (t - m.t0) / m.D; if (u > 1.1) { M.splice(i, 1); continue; }
      const p = Math.min(1, u), e = p * p * .3 + p * .7, hx = lerp(m.sx, m.ex, e), hy = lerp(m.sy, m.ey, e);
      const L = Math.hypot(m.ex - m.sx, m.ey - m.sy), ux = (m.ex - m.sx) / L, uy = (m.ey - m.sy) / L;
      const tl = 320 * Math.min(1, u * 5) * (u > 1 ? Math.max(0, 1 - (u - 1) / .1) : 1), tx = hx - ux * tl, ty = hy - uy * tl, fade = u > .86 ? Math.max(0, 1 - (u - .86) / .2) : 1;
      c.globalAlpha = fade;
      let g = c.createLinearGradient(hx, hy, tx, ty); g.addColorStop(0, 'rgba(255,205,140,.55)'); g.addColorStop(.5, 'rgba(255,110,50,.18)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      c.strokeStyle = g; c.lineWidth = 13; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
      g = c.createLinearGradient(hx, hy, tx, ty); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,238,200,.95)'); g.addColorStop(.45, 'rgba(255,170,90,.5)'); g.addColorStop(1, 'rgba(255,90,30,0)');
      c.strokeStyle = g; c.lineWidth = 3.4; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
      glow(c, hx, hy, 28, '255,220,170', .85); glow(c, hx, hy, 8, '255,255,255', 1);
      c.strokeStyle = 'rgba(255,230,190,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - 22, hy); c.lineTo(hx + 22, hy); c.moveTo(hx, hy - 22); c.lineTo(hx, hy + 22); c.stroke();
      if (P.length < 90 && u < 1) P.push({ x: hx, y: hy, vx: -ux * 50 + (Math.random() - .5) * 80, vy: -uy * 50 + (Math.random() - .5) * 80, l: 0, L: .45 + Math.random() * .5 });
      c.globalAlpha = 1;
    }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.l += dt; if (p.l > p.L) { P.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const k = 1 - p.l / p.L; c.fillStyle = `rgba(255,${(150 + k * 90) | 0},90,${(k * .9).toFixed(3)})`; c.fillRect(p.x, p.y, 1.8, 1.8); }
    c.globalCompositeOperation = 'source-over';
    const lx = w - 76, ly = h - 76 + Math.sin(t * .9) * 3;                      /* Team Empire beacon */
    glow(c, lx, ly, 76, '120,170,255', .2); c.strokeStyle = 'rgba(150,195,255,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(lx, ly, 56, 17, -.35, 0, TAU); c.stroke();
    logo(c, lx, ly, 62, .92); const sa = t * .8; glow(c, lx + Math.cos(sa) * 56 * Math.cos(-.35) - Math.sin(sa) * 17 * Math.sin(-.35), ly + Math.cos(sa) * 56 * Math.sin(-.35) + Math.sin(sa) * 17 * Math.cos(-.35), 7, '200,225,255', .9);
  }) };
};

/* =============== AUDIT: quality lab, call waveforms scanned by a beam, ticks and crosses =============== */
S.audit = (st) => {
  const { w, h } = st, R = rng(21), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#02121a'); g.addColorStop(.55, '#04303a'); g.addColorStop(1, '#021019'); c.fillStyle = g; c.fillRect(0, 0, W, H); blobs(c, W, H, [[.15, .2, .5, '30,200,190', .16], [.85, .75, .55, '40,120,230', .16], [.6, .1, .4, '60,230,170', .08]]); });
  const gl = Array.from({ length: Math.round(26 * q) }, () => ({ x: R() * w, y: R() * h, v: 7 + R() * 14, s: 14 + R() * 22, p: R() * TAU, ok: R() < .8, k: R() < .2 }));
  const wave = (x, t, k) => (.55 + .45 * Math.sin(x * .0042 + t * .6 + k * 2)) * (Math.sin(x * .021 + t * 2.3 + k) + .55 * Math.sin(x * .049 - t * 3.1 + k * 3) + .3 * Math.sin(x * .113 + t * 5.3));
  const rib = [[.22, .07, '61,224,192', 0], [.52, .055, '95,203,247', 1.7], [.8, .07, '61,224,192', 3.1]];
  return { draw: frame((c, st, t) => {
    c.drawImage(bg, 0, 0, w, h);
    const gs = 64, ox = (t * 8) % gs, oy = (t * 5) % gs; c.strokeStyle = 'rgba(80,220,200,.05)'; c.lineWidth = 1; c.beginPath(); for (let x = -ox; x < w; x += gs) { c.moveTo(x, 0); c.lineTo(x, h); } for (let y = -oy; y < h; y += gs) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
    const bx = ((t * 150) % (w + 340)) - 170;
    c.globalCompositeOperation = 'lighter';
    let g = c.createLinearGradient(bx - 110, 0, bx, 0); g.addColorStop(0, 'rgba(61,224,192,0)'); g.addColorStop(1, 'rgba(61,224,192,.14)'); c.fillStyle = g; c.fillRect(bx - 110, 0, 110, h);
    c.fillStyle = 'rgba(170,255,235,.75)'; c.fillRect(bx - 1, 0, 2, h);
    rib.forEach(([yf, af, rgb, k]) => {
      const base = yf * h, amp = af * h; c.beginPath(); for (let x = 0; x <= w + 5; x += 5) { const y = base + amp * wave(x, t, k); x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = `rgba(${rgb},.12)`; c.lineWidth = 7; c.lineJoin = 'round'; c.stroke(); c.strokeStyle = `rgba(${rgb},.8)`; c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = `rgba(${rgb},.18)`; c.lineWidth = 1; c.beginPath(); for (let x = 0; x <= w; x += 8) { const a = Math.abs(wave(x, t, k)) * amp * .9; c.moveTo(x, base - a); c.lineTo(x, base + a); } c.stroke();
      glow(c, bx, base + amp * wave(bx, t, k), 15, rgb, .85);
    });
    c.globalCompositeOperation = 'source-over';
    for (const o of gl) {
      const y = (((o.y - t * o.v) % (h + 80)) + h + 80) % (h + 80) - 40, a = .12 + .14 * Math.sin(t * .9 + o.p); if (a <= 0) continue;
      c.save(); c.translate(o.x, y); c.globalAlpha = a; c.lineCap = c.lineJoin = 'round'; c.lineWidth = 2.4; const s = o.s;
      if (o.k) { c.strokeStyle = '#5fcbf7'; c.beginPath(); c.arc(0, 0, s * .7, 0, TAU); c.globalAlpha = a * .35; c.stroke(); c.globalAlpha = a; c.beginPath(); c.arc(0, 0, s * .7, -PI / 2, -PI / 2 + TAU * (.78 + .2 * Math.sin(o.p))); c.stroke(); }
      else { c.strokeStyle = o.ok ? '#3dffb6' : '#ff6f7b'; rr(c, -s / 2, -s / 2, s, s, s * .22); c.stroke(); c.beginPath(); if (o.ok) { c.moveTo(-s * .24, 0); c.lineTo(-s * .06, s * .2); c.lineTo(s * .28, -s * .2); } else { c.moveTo(-s * .2, -s * .2); c.lineTo(s * .2, s * .2); c.moveTo(s * .2, -s * .2); c.lineTo(-s * .2, s * .2); } c.stroke(); }
      c.restore();
    }
    const mx = w * (.5 + .3 * Math.sin(t * .21)), my = h * (.5 + .2 * Math.sin(t * .33 + 1));      /* magnifier */
    c.save(); c.translate(mx, my); c.strokeStyle = 'rgba(190,255,245,.34)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 46, 0, TAU); c.stroke(); c.fillStyle = 'rgba(190,255,245,.05)'; c.fill();
    c.lineWidth = 7; c.lineCap = 'round'; c.strokeStyle = 'rgba(190,255,245,.26)'; c.beginPath(); c.moveTo(33, 33); c.lineTo(68, 68); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 36, PI * 1.05, PI * 1.45); c.stroke(); c.restore();
    const lx = w < 700 ? w - 70 : w - 130, ly = h - 120, near = Math.abs(bx - lx) < 70;
    glow(c, lx, ly, 100, '61,224,192', .14); c.strokeStyle = 'rgba(95,230,255,.4)'; c.lineWidth = 1.5; c.setLineDash([6, 8]); c.lineDashOffset = -t * 20; c.beginPath(); c.arc(lx, ly, 74, 0, TAU); c.stroke(); c.setLineDash([]);
    logo(c, lx, ly, 98, near ? .95 : .55);
  }) };
};

/* =============== PARAMETER EMPATHY: heart aurora, rising hearts, heartbeat line =============== */
S.emp = (st) => {
  const { w, h } = st, R = rng(41), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#14061a'], [.6, '#2a0b30'], [1, '#1a0716']]); blobs(c, W, H, [[.2, .2, .55, '255,90,170', .2], [.85, .3, .45, '255,170,90', .13], [.5, .95, .6, '160,60,200', .2]]); });
  const heart = (c1, c2) => spr(64, 64, (c) => { c.translate(32, 34); const g = c.createRadialGradient(-7, -9, 2, 0, 0, 32); g.addColorStop(0, c1); g.addColorStop(1, c2); c.fillStyle = g; c.shadowColor = c2; c.shadowBlur = 9; c.beginPath(); c.moveTo(0, 15); c.bezierCurveTo(-28, -4, -17, -25, 0, -11); c.bezierCurveTo(17, -25, 28, -4, 0, 15); c.fill(); });
  const hs = [heart('#ffd0e4', '#ff4f93'), heart('#ffe3c2', '#ff8a5c'), heart('#ffc2ea', '#d04fd0'), heart('#fff0c8', '#ffb347'), heart('#ffd0d6', '#ff5d6c')];
  const hearts = Array.from({ length: Math.round(34 * q) }, () => ({ x: R() * w, y: R() * h, s: 12 + R() * 38, v: 14 + R() * 34, sw: 10 + R() * 26, p: R() * TAU, k: (R() * 5) | 0, a: .22 + R() * .5 }));
  const bok = Array.from({ length: 14 }, () => ({ x: R() * w, y: R() * h, r: 18 + R() * 70, v: 3 + R() * 8, p: R() * TAU }));
  const beat = (u) => (u < .12 ? 0 : u < .2 ? Math.sin((u - .12) / .08 * PI) * .12 : u < .3 ? 0 : u < .34 ? -(u - .3) / .04 * .15 : u < .4 ? -.15 + (u - .34) / .06 * 1.15 : u < .46 ? 1 - (u - .4) / .06 * 1.35 : u < .5 ? -.35 + (u - .46) / .04 * .35 : u < .62 ? 0 : u < .78 ? Math.sin((u - .62) / .16 * PI) * .22 : 0);
  return { draw: frame((c, st, t) => {
    c.drawImage(bg, 0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    [[.16, '255,90,170', .9, .0], [.26, '255,170,110', 1.3, 1.7], [.1, '190,100,255', .7, 3.2]].forEach(([yf, rgb, sp, ph], k) => {
      const base = yf * h, amp = h * .07, th = h * .2; c.beginPath(); for (let x = 0; x <= w + 10; x += 10) { const y = base + Math.sin(x * .004 + t * .35 * sp + ph) * amp + Math.sin(x * .011 - t * .5 + ph) * amp * .4; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      for (let x = w + 10; x >= 0; x -= 10) { const y = base + Math.sin(x * .004 + t * .35 * sp + ph) * amp + Math.sin(x * .011 - t * .5 + ph) * amp * .4 + th * (.7 + .3 * Math.sin(x * .007 + t * .4 + k)); c.lineTo(x, y); }
      c.closePath(); const g = c.createLinearGradient(0, base - amp, 0, base + th + amp); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(.35, `rgba(${rgb},.2)`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fill();
    });
    for (const b of bok) { const y = (((b.y - t * b.v) % (h + 200)) + h + 200) % (h + 200) - 100; c.fillStyle = `rgba(255,170,210,${(.04 + .03 * Math.sin(t * .6 + b.p)).toFixed(3)})`; c.beginPath(); c.arc(b.x, y, b.r, 0, TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    for (const o of hearts) {
      const y = (((o.y - t * o.v) % (h + 100)) + h + 100) % (h + 100) - 50, x = o.x + Math.sin(t * .5 + o.p) * o.sw;
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * .7 + o.p) * .35); const sc = o.s / 52 * (1 + .07 * Math.sin(t * 3 + o.p)); c.scale(sc, sc); c.globalAlpha = o.a * (.7 + .3 * Math.sin(t * 1.4 + o.p)); c.drawImage(hs[o.k], -32, -32); c.restore();
    }
    const by = h * .9, bw = 280, head = ((t * .32) % 1.15) * w;                                   /* heartbeat monitor */
    c.beginPath(); for (let x = 0; x <= w; x += 3) { const y = by - beat(((x / bw) + t * .55) % 1) * 62; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = 'rgba(255,110,160,.22)'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
    c.save(); c.beginPath(); c.rect(head - 240, 0, 240, h); c.clip(); c.beginPath(); for (let x = 0; x <= w; x += 3) { const y = by - beat(((x / bw) + t * .55) % 1) * 62; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,140,190,.95)'; c.lineWidth = 2.4; c.shadowColor = '#ff5fa2'; c.shadowBlur = 12; c.stroke(); c.restore();
    c.globalCompositeOperation = 'lighter'; glow(c, head, by - beat(((head / bw) + t * .55) % 1) * 62, 12, '255,200,225', .95);
    c.globalCompositeOperation = 'source-over';
    const pulse = Math.pow(Math.max(0, Math.sin(t * PI * 1.2)), 6), lx = w < 700 ? w - 70 : w - 110, ly = 120;
    glow(c, lx, ly, 96 + pulse * 26, '255,90,160', .26 + pulse * .2); logo(c, lx, ly, 76 * (1 + .05 * pulse), .92);
  }) };
};

/* =============== FCR, QUIZ & SD: target radar with lock-on =============== */
S.fcr = (st) => {
  const { w, h } = st, R = rng(33), q = st.q;
  const cx = w < 700 ? w * .5 : w * .7, cy = h * .5, rad = Math.min(w < 700 ? w * .46 : w * .3, h * .46);
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#021412'], [.55, '#04312c'], [1, '#021713']]); blobs(c, W, H, [[cx / w, cy / h, .45, '40,230,160', .12], [.1, .1, .4, '30,170,200', .1]]); });
  const bl = Array.from({ length: 16 }, () => ({ a: R() * TAU, r: .15 + R() * .8, s: 2 + R() * 2.5 }));
  const bits = Array.from({ length: Math.round(30 * q) }, () => ({ x: R() * w, y: R() * h, v: 10 + R() * 18, p: R() * TAU, k: (R() * 3) | 0, s: 12 + R() * 16 }));
  const ch = ['?', '✓', '!'];
  return { draw: frame((c, st, t) => {
    c.drawImage(bg, 0, 0, w, h);
    c.strokeStyle = 'rgba(66,230,149,.2)'; c.lineWidth = 1; for (let i = 1; i <= 4; i++) { c.beginPath(); c.arc(cx, cy, rad * i / 4, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(cx - rad, cy); c.lineTo(cx + rad, cy); c.moveTo(cx, cy - rad); c.lineTo(cx, cy + rad); c.stroke();
    c.strokeStyle = 'rgba(66,230,149,.4)'; c.beginPath(); for (let i = 0; i < 72; i++) { const a = i * TAU / 72, l = i % 6 ? 6 : 13; c.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); c.lineTo(cx + Math.cos(a) * (rad + l), cy + Math.sin(a) * (rad + l)); } c.stroke();
    const sw = (t * .9) % TAU; c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 38; i++) { const a1 = sw - i * .036, a0 = a1 - .036, al = Math.pow(1 - i / 38, 2) * .3; c.fillStyle = `rgba(66,230,149,${al.toFixed(3)})`; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, rad, a0, a1 + .002); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(160,255,210,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sw) * rad, cy + Math.sin(sw) * rad); c.stroke();
    bl.forEach((b) => { const d = (((sw - b.a) % TAU) + TAU) % TAU, al = Math.pow(1 - d / TAU, 3); glow(c, cx + Math.cos(b.a) * b.r * rad, cy + Math.sin(b.a) * b.r * rad, 7 + b.s * 2, '120,255,190', .15 + al * .85); });
    const k = Math.floor(t / 3.2) % bl.length, u = (t % 3.2) / 3.2, tg = bl[k], tx = cx + Math.cos(tg.a) * tg.r * rad, ty = cy + Math.sin(tg.a) * tg.r * rad;   /* lock-on */
    const sz = lerp(64, 15, 1 - Math.pow(1 - clamp(u * 2.5, 0, 1), 3)), locked = u > .4; c.save(); c.translate(tx, ty); c.rotate(t * 1.4 * (1 - clamp(u * 2.5, 0, 1))); c.strokeStyle = locked ? 'rgba(120,255,190,.95)' : 'rgba(255,130,120,.9)'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.rotate(PI / 2); c.beginPath(); c.moveTo(sz, sz - 9); c.lineTo(sz, sz); c.lineTo(sz - 9, sz); c.stroke(); } c.restore();
    if (locked) { c.strokeStyle = `rgba(120,255,190,${(1 - (u - .4) / .6).toFixed(3)})`; c.beginPath(); c.arc(tx, ty, 15 + (u - .4) / .6 * 60, 0, TAU); c.stroke(); }
    c.globalCompositeOperation = 'source-over'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const b of bits) { const y = (((b.y - t * b.v) % (h + 60)) + h + 60) % (h + 60) - 30; c.globalAlpha = .12 + .16 * Math.sin(t + b.p) ** 2; c.fillStyle = b.k === 1 ? '#42e695' : '#7fe8d8'; c.font = font(700, b.s); c.fillText(ch[b.k], b.x, y); }
    c.globalAlpha = 1; glow(c, cx, cy, rad * .5, '66,230,149', .1); c.strokeStyle = 'rgba(66,230,149,.35)'; c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, rad * .24, 0, TAU); c.stroke(); logo(c, cx, cy, rad * .3, .75);
  }) };
};

/* =============== COMPLAINT & DKB: night city, search-lights, Team Empire flag =============== */
S.dkb = (st) => {
  const { w, h } = st, R = rng(55), q = st.q;
  const sky = spr(w / 3, h / 3, (c, W, H) => vgrad(c, W, H, [[0, '#060a22'], [.45, '#1a1040'], [.78, '#5a1f4a'], [1, '#a8463f']]));
  const stars = Array.from({ length: Math.round(140 * q) }, () => ({ x: R() * w, y: R() * h * .6, p: R() * TAU, v: .6 + R() * 2 }));
  const layers = [0, 1, 2].map((l) => { const bs = []; let x = -20; const hMin = [.2, .14, .09][l] * h, hMax = [.42, .32, .24][l] * h;
    while (x < w + 40) { const bw = (34 + R() * 60) * (1 + (2 - l) * .25), bh = hMin + R() * (hMax - hMin), wins = [], cols = Math.max(1, Math.floor((bw - 8) / 7)), rows = Math.floor((bh - 10) / 9);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (R() < .4) wins.push({ x: 4 + i * 7, y: 6 + j * 9, p: R() * TAU, v: .12 + R() * .4, on: R() });
      bs.push({ x, w: bw, h: bh, wins }); x += bw + R() * 6; } return bs; });
  const LC = ['#2c1b4a', '#1b1033', '#0c0819'], WC = ['255,200,120', '255,214,130', '255,226,150'];
  const tx = w < 700 ? w - 40 : w * .9, ty = h * .5;
  return { draw: frame((c, st, t) => {
    c.drawImage(sky, 0, 0, w, h);
    for (const s of stars) { c.fillStyle = `rgba(255,255,255,${(.25 + .6 * (.5 + .5 * Math.sin(t * s.v + s.p))).toFixed(3)})`; c.fillRect(s.x, s.y, 1.4, 1.4); }
    glow(c, w * .8, h * .16, 90, '255,240,200', .16); c.fillStyle = '#f3ecd2'; c.beginPath(); c.arc(w * .8, h * .16, 24, 0, TAU); c.fill(); c.fillStyle = 'rgba(160,150,120,.35)'; [[-8, -6, 5], [7, 5, 4], [-3, 10, 3]].forEach(([a, b, r]) => { c.beginPath(); c.arc(w * .8 + a, h * .16 + b, r, 0, TAU); c.fill(); });
    const ap = ((t * 42) % (w + 240)) - 120; c.fillStyle = Math.sin(t * 6) > 0 ? '#ff4d5d' : '#ffffff'; c.fillRect(ap, h * .13, 2.4, 2.4); glow(c, ap + 1, h * .13 + 1, 8, '255,255,255', .5);
    layers.forEach((bs, l) => {
      const off = (t * [3, 6, 10][l]) % w;
      for (const rep of [0, w]) for (const b of bs) {
        const x = b.x - off + rep; if (x > w + 20 || x + b.w < -20) continue;
        c.fillStyle = LC[l]; c.fillRect(x, h - b.h, b.w, b.h);
        for (const wn of b.wins) { const lit = (Math.sin(t * wn.v + wn.p) + 1) / 2 > wn.on * .6; if (!lit) continue; c.fillStyle = `rgba(${WC[l]},${(.35 + .15 * l).toFixed(2)})`; c.fillRect(x + wn.x, h - b.h + wn.y, 3, 4); }
      }
      if (l === 1) {
        c.globalCompositeOperation = 'lighter';
        [[.2, 0], [.62, 2]].forEach(([fx, k]) => { const sx = w * fx, sy = h * .8, a = -PI / 2 + Math.sin(t * .45 + k) * .55, L = h * 1.2, g = c.createLinearGradient(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L); g.addColorStop(0, 'rgba(255,244,214,.34)'); g.addColorStop(1, 'rgba(255,244,214,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a - .05) * L, sy + Math.sin(a - .05) * L); c.lineTo(sx + Math.cos(a + .05) * L, sy + Math.sin(a + .05) * L); c.closePath(); c.fill(); glow(c, sx, sy, 14, '255,240,200', .8); });
        c.globalCompositeOperation = 'source-over';
      }
    });
    c.fillStyle = '#0a0716'; c.fillRect(tx - 11, ty, 22, h - ty); c.fillRect(tx - 1.5, ty - 70, 3, 72);            /* tower + flag */
    for (let i = 0; i < 22; i++) { const x = tx + 1.5 + i * 3.3, yo = Math.sin(t * 4.2 - i * .55) * (1 + i * .3), fh = 32 - i * .35; c.fillStyle = '#0e2a63'; c.fillRect(x, ty - 70 + yo, 3.5, fh); c.fillStyle = '#d9ac69'; c.fillRect(x, ty - 70 + yo + fh * .42, 3.5, fh * .16); c.fillStyle = `rgba(0,0,0,${(.1 + .18 * Math.sin(t * 4.2 - i * .55 + 1.2)).toFixed(3)})`; c.fillRect(x, ty - 70 + yo, 3.5, fh); }
    glow(c, tx, ty - 72, 10, '255,240,200', .9);
    const bx = w * .62, by = h * .5;                                                                                   /* neon billboard */
    c.strokeStyle = 'rgba(255,157,92,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx - 26, by + 44); c.lineTo(bx - 26, h); c.moveTo(bx + 26, by + 44); c.lineTo(bx + 26, h); c.stroke();
    glow(c, bx, by, 90, '255,93,154', .24 + .06 * Math.sin(t * 2)); c.strokeStyle = `rgba(255,170,110,${(.7 + .2 * Math.sin(t * 5)).toFixed(2)})`; c.lineWidth = 2.5; rr(c, bx - 48, by - 48, 96, 96, 12); c.stroke(); logo(c, bx, by, 84, .95);
  }) };
};

/* =============== LAG & ADHERENCE: time machine, gears, live clock =============== */
S.lag = (st) => {
  const { w, h } = st, R = rng(63), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#07051a'], [.6, '#140a33'], [1, '#1d1040']]); blobs(c, W, H, [[.2, .15, .5, '130,90,255', .18], [.8, .85, .5, '255,190,90', .12], [.55, .45, .4, '90,60,200', .1]]); });
  const gear = (c, x, y, r, n, ang, a) => { c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); const ro = r, ri = r * .84, tw = TAU / n;
    for (let i = 0; i < n; i++) { const a0 = i * tw; c.lineTo(Math.cos(a0 - tw * .2) * ri, Math.sin(a0 - tw * .2) * ri); c.lineTo(Math.cos(a0 - tw * .11) * ro, Math.sin(a0 - tw * .11) * ro); c.lineTo(Math.cos(a0 + tw * .11) * ro, Math.sin(a0 + tw * .11) * ro); c.lineTo(Math.cos(a0 + tw * .2) * ri, Math.sin(a0 + tw * .2) * ri); }
    c.closePath(); c.moveTo(r * .3, 0); c.arc(0, 0, r * .3, 0, TAU, true); c.fillStyle = `rgba(167,139,250,${a * .55})`; c.fill('evenodd'); c.strokeStyle = `rgba(255,203,107,${a * 2.2})`; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); for (let i = 0; i < 5; i++) { const sa = i * TAU / 5; c.moveTo(Math.cos(sa) * r * .3, Math.sin(sa) * r * .3); c.lineTo(Math.cos(sa) * ri * .95, Math.sin(sa) * ri * .95); } c.strokeStyle = `rgba(255,203,107,${a * 1.3})`; c.stroke(); c.restore(); };
  const G = [[.1, .18, 120, 14, 1, .1], [.24, .36, 70, 10, -1, .12], [.92, .8, 150, 18, -1, .09], [.78, .94, 86, 12, 1, .12], [.56, .06, 56, 9, 1, .11], [.04, .86, 90, 12, -1, .1]];
  const tok = Array.from({ length: Math.round(16 * q) }, () => ({ x: R() * w, y: R() * h, v: 8 + R() * 16, p: R() * TAU, s: 16 + R() * 12, t: pad2((R() * 24) | 0) + ':' + pad2(((R() * 4) | 0) * 15) }));
  function pad2(n) { return String(n).padStart(2, '0'); }
  const cx = w < 700 ? w * .5 : w * .72, cy = h * .5, CR = Math.min(h * .34, w < 700 ? w * .4 : w * .28);
  return { draw: frame((c, st, t) => {
    c.drawImage(bg, 0, 0, w, h);
    G.forEach(([fx, fy, r, n, dir, a], i) => gear(c, w * fx, h * fy, r, n, dir * t * (.18 + i * .02), a));
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffcb6b';
    for (const o of tok) { const y = (((o.y - t * o.v) % (h + 60)) + h + 60) % (h + 60) - 30; c.globalAlpha = .08 + .12 * Math.sin(t * .8 + o.p) ** 2; c.font = font(700, o.s); c.fillText(o.t, o.x, y); }
    c.globalAlpha = 1;
    for (let k = 0; k < 3; k++) { const u = ((t * .25 + k / 3) % 1); c.strokeStyle = `rgba(255,203,107,${((1 - u) * .22).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, CR * (1 + u * .6), 0, TAU); c.stroke(); }
    glow(c, cx, cy, CR * 1.3, '130,90,255', .13);
    c.strokeStyle = 'rgba(255,203,107,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, CR, 0, TAU); c.stroke(); c.lineWidth = 1; c.strokeStyle = 'rgba(180,150,255,.5)'; c.beginPath(); c.arc(cx, cy, CR * .93, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,225,160,.55)'; c.beginPath(); for (let i = 0; i < 60; i++) { const a = i * TAU / 60, l = i % 5 ? CR * .03 : CR * .08; c.moveTo(cx + Math.cos(a) * CR * .93, cy + Math.sin(a) * CR * .93); c.lineTo(cx + Math.cos(a) * (CR * .93 - l), cy + Math.sin(a) * (CR * .93 - l)); } c.stroke();
    c.fillStyle = 'rgba(255,225,160,.8)'; c.font = font(700, CR * .13); [['12', 0], ['3', 1], ['6', 2], ['9', 3]].forEach(([s, i]) => c.fillText(s, cx + Math.sin(i * PI / 2) * CR * .74, cy - Math.cos(i * PI / 2) * CR * .74));
    const d = new Date(), sec = d.getSeconds() + d.getMilliseconds() / 1000, min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
    const hand = (ang, len, wd, col) => { c.strokeStyle = col; c.lineWidth = wd; c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.moveTo(cx - Math.sin(ang) * len * .12, cy + Math.cos(ang) * len * .12); c.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); c.stroke(); c.shadowBlur = 0; };
    hand(hr / 12 * TAU, CR * .5, 5, '#ffcb6b'); hand(min / 60 * TAU, CR * .74, 3.4, '#ffe9b0'); hand(sec / 60 * TAU, CR * .82, 1.6, '#ff6d7a');
    c.fillStyle = '#ffcb6b'; c.beginPath(); c.arc(cx, cy, 6, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const a = t * .5 + i * TAU / 12; glow(c, cx + Math.cos(a) * CR * 1.12, cy + Math.sin(a) * CR * 1.12, 5, '255,203,107', .55 + .4 * Math.sin(t * 2 + i)); } c.globalCompositeOperation = 'source-over';
    logo(c, cx, cy - CR * .42, CR * .26, .9);
  }) };
};

/* =============== AHT & CFS: call signal, equalizer, happy stars =============== */
S.aht = (st) => {
  const { w, h } = st, R = rng(71), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#010714'], [.6, '#03234a'], [1, '#02101f']]); blobs(c, W, H, [[.1, .85, .5, '47,211,255', .16], [.9, .15, .45, '255,95,210', .12], [.5, .5, .5, '40,110,255', .1]]); });
  const nb = Math.max(12, Math.floor(w / 14)), peaks = new Float32Array(nb);
  const ic = Array.from({ length: Math.round(18 * q) }, () => ({ x: R() * w, y: R() * h, v: 10 + R() * 22, p: R() * TAU, s: 9 + R() * 14, sm: R() < .35 }));
  const src = [{ x: w * .1, y: h * .82, ph: 0, rgb: '47,211,255' }, { x: w * .92, y: h * .18, ph: .5, rgb: '255,95,210' }];
  return { draw: frame((c, st, t, dt) => {
    c.drawImage(bg, 0, 0, w, h); c.globalCompositeOperation = 'lighter';
    src.forEach((s) => { for (let k = 0; k < 5; k++) { const u = (t * .5 + k / 5 + s.ph) % 1; c.strokeStyle = `rgba(${s.rgb},${(Math.pow(1 - u, 1.5) * .34).toFixed(3)})`; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, u * 440, 0, TAU); c.stroke(); } glow(c, s.x, s.y, 26, s.rgb, .5); });
    [['47,211,255', 0, 1], ['255,95,210', 2, -1]].forEach(([rgb, ph, dir]) => { c.beginPath(); for (let x = 0; x <= w + 6; x += 6) { const y = h * .46 + Math.sin(x * .011 + t * 1.4 * dir + ph) * h * .07 + Math.sin(x * .027 - t * 2.1 + ph) * h * .03; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = `rgba(${rgb},.12)`; c.lineWidth = 7; c.stroke(); c.strokeStyle = `rgba(${rgb},.55)`; c.lineWidth = 1.6; c.stroke(); });
    const maxH = h * .3, g = c.createLinearGradient(0, h, 0, h - maxH); g.addColorStop(0, 'rgba(47,150,255,.75)'); g.addColorStop(.6, 'rgba(47,211,255,.85)'); g.addColorStop(1, 'rgba(255,95,210,.9)');
    const beatK = Math.pow(Math.max(0, Math.sin(t * 3.4)), 6); c.fillStyle = g;
    for (let i = 0; i < nb; i++) { const v = .5 + .5 * Math.sin(t * 2.1 + i * .55) * Math.sin(t * 1.3 + i * .21 + 1.7), hh = (.1 + .5 * v + .4 * beatK * (.5 + .5 * Math.sin(i))) * maxH, x = i * (w / nb) + 2; rr(c, x, h - hh, w / nb - 5, hh, 3); c.fill(); peaks[i] = Math.max(hh, peaks[i] - dt * 70); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(x, h - peaks[i] - 5, w / nb - 5, 2); c.fillStyle = g; }
    c.globalCompositeOperation = 'source-over';
    for (const o of ic) {
      const y = (((o.y - t * o.v) % (h + 80)) + h + 80) % (h + 80) - 40, x = o.x + Math.sin(t * .6 + o.p) * 14, a = .2 + .22 * Math.sin(t * 1.2 + o.p) ** 2;
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * .7 + o.p) * .3); c.globalAlpha = a;
      if (o.sm) { const gg = c.createRadialGradient(-o.s * .3, -o.s * .3, 1, 0, 0, o.s); gg.addColorStop(0, '#fff2a8'); gg.addColorStop(1, '#ffb932'); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, o.s, 0, TAU); c.fill(); c.fillStyle = '#6a3b00'; c.beginPath(); c.arc(-o.s * .35, -o.s * .2, o.s * .1, 0, TAU); c.arc(o.s * .35, -o.s * .2, o.s * .1, 0, TAU); c.fill(); c.strokeStyle = '#6a3b00'; c.lineWidth = o.s * .1; c.lineCap = 'round'; c.beginPath(); c.arc(0, o.s * .05, o.s * .5, .2, PI - .2); c.stroke(); }
      else { const gg = c.createLinearGradient(0, -o.s, 0, o.s); gg.addColorStop(0, '#fff2a8'); gg.addColorStop(1, '#ffb932'); c.fillStyle = gg; c.shadowColor = '#ffd25a'; c.shadowBlur = 12; star5(c, 0, 0, o.s, o.s * .45); c.fill(); }
      c.restore();
    }
    const lx = w < 700 ? w - 76 : w - 130, ly = h * .3;
    glow(c, lx, ly, 100, '47,211,255', .22); c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { c.strokeStyle = ['rgba(47,211,255,.7)', 'rgba(255,95,210,.55)', 'rgba(255,255,255,.4)'][i]; c.beginPath(); c.arc(lx, ly, 56 + i * 9, t * (i % 2 ? -1 : 1) * (.8 + i * .3), t * (i % 2 ? -1 : 1) * (.8 + i * .3) + 1.5 + i * .4); c.stroke(); }
    logo(c, lx, ly, 80, .95);
  }) };
};

/* =============== PUNCH DATA: biometric fingerprint scan + time rain =============== */
S.punch = (st) => {
  const { w, h } = st, R = rng(83), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#010807'], [.6, '#02140f'], [1, '#010a08']]); blobs(c, W, H, [[.78, .5, .4, '40,255,160', .1], [.1, .9, .4, '30,200,200', .08]]); });
  const hexS = 30, hex = spr(w, h, (c, W, H) => { c.strokeStyle = 'rgba(125,255,155,.07)'; c.lineWidth = 1; c.beginPath(); for (let row = -1; row < H / (hexS * 1.5) + 1; row++) for (let col = -1; col < W / (hexS * 1.732) + 1; col++) { const x = col * hexS * 1.732 + (row & 1 ? hexS * .866 : 0), y = row * hexS * 1.5; for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3, px = x + Math.cos(a) * hexS, py = y + Math.sin(a) * hexS; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); } c.stroke(); });
  const atlas = spr(11 * 14, 18, (c) => { c.font = font(600, 14); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#9dffb8'; '0123456789:'.split('').forEach((ch, i) => c.fillText(ch, i * 14 + 7, 10)); });
  const cols = Array.from({ length: Math.round(Math.floor(w / 30) * Math.max(.6, q)) }, (_, i) => ({ x: i * (w / Math.round(Math.floor(w / 30) * Math.max(.6, q))) + 8, y: R() * h, v: 50 + R() * 130, len: 7 + ((R() * 8) | 0), o: (R() * 11) | 0 }));
  const FW = 250, FH = 300, fcx = w < 700 ? w * .5 : w * .76, fcy = h * .5;
  const ridge = (rgb, a, lw) => spr(FW, FH, (c, W, H) => { const r2 = rng(5); c.translate(W / 2, H / 2); c.strokeStyle = `rgba(${rgb},${a})`; c.lineWidth = lw; c.lineCap = 'round';
    for (let rad = 8; rad < 128; rad += 7.2) { const segs = 2 + ((r2() * 2) | 0); let a0 = r2() * TAU; for (let s = 0; s < segs; s++) { const span = TAU / segs * (.7 + r2() * .25); c.beginPath(); c.ellipse(Math.sin(rad * .13) * 3, Math.cos(rad * .09) * 3, rad * (1 + .05 * Math.sin(rad * .3)), rad * 1.17, 0, a0, a0 + span); c.stroke(); a0 += span + TAU / segs * .06 + r2() * .2; } } });
  const dim = ridge('61,255,170', .32, 2.2), bright = ridge('190,255,220', 1, 2.6);
  return { draw: frame((c, st, t) => {
    c.drawImage(bg, 0, 0, w, h); c.drawImage(hex, 0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    for (const k of cols) { const hy = ((k.y + t * k.v) % (h + k.len * 18 + 40)) - 20; for (let i = 0; i < k.len; i++) { const y = hy - i * 18; if (y < -18 || y > h) continue; c.globalAlpha = i ? Math.max(0, .5 - i / k.len * .5) * .55 : .95; const idx = (k.o + i * 5 + Math.floor(t * 4 + i * .7)) % 11; c.drawImage(atlas, idx * 14, 0, 14, 18, k.x, y, 14, 18); } }
    c.globalAlpha = 1;
    glow(c, fcx, fcy, 210, '40,255,160', .1);
    const by = fcy + Math.sin(t * 1.1) * FH * .45; c.globalAlpha = .9; c.drawImage(dim, fcx - FW / 2, fcy - FH / 2);
    c.save(); c.beginPath(); c.rect(fcx - FW / 2, by - 26, FW, 52); c.clip(); c.globalAlpha = 1; c.drawImage(bright, fcx - FW / 2, fcy - FH / 2); c.restore();
    const g = c.createLinearGradient(0, by - 30, 0, by + 30); g.addColorStop(0, 'rgba(125,255,155,0)'); g.addColorStop(.5, 'rgba(160,255,200,.5)'); g.addColorStop(1, 'rgba(125,255,155,0)'); c.fillStyle = g; c.fillRect(fcx - FW / 2 - 14, by - 30, FW + 28, 60);
    c.fillStyle = 'rgba(210,255,230,.95)'; c.fillRect(fcx - FW / 2 - 14, by - 1, FW + 28, 2);
    c.strokeStyle = 'rgba(125,255,155,.8)'; c.lineWidth = 3; c.lineCap = 'round'; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const x = fcx + sx * (FW / 2 + 12), y = fcy + sy * (FH / 2 + 12); c.beginPath(); c.moveTo(x - sx * 24, y); c.lineTo(x, y); c.lineTo(x, y - sy * 24); c.stroke(); });
    c.globalCompositeOperation = 'source-over'; logo(c, fcx, fcy, 62, .6 + .35 * Math.abs(Math.sin(t * 1.3)));
    const d = new Date(), tm = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');       /* live punch clock */
    c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.font = font(700, w < 700 ? 34 : 62); c.fillStyle = 'rgba(125,255,155,.14)'; c.fillText(tm, w - 24, h - 26);
  }) };
};

/* =============== SALARY DATA: money rain, gold shimmer, rising profit line =============== */
S.salary = (st) => {
  const { w, h } = st, R = rng(91), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#01120a'], [.6, '#04301c'], [1, '#03180f']]); blobs(c, W, H, [[.5, 1.05, .7, '255,200,60', .24], [.15, .2, .4, '61,220,132', .12], [.9, .3, .4, '255,210,74', .08]]); });
  const coin = (gl) => spr(64, 64, (c) => { c.translate(32, 32); let g = c.createRadialGradient(-8, -10, 4, 0, 0, 31); g.addColorStop(0, '#fff3b0'); g.addColorStop(.5, '#f6c445'); g.addColorStop(1, '#b57a10'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fill(); c.lineWidth = 3; c.strokeStyle = '#a56a0a'; c.stroke(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,245,190,.85)'; c.beginPath(); c.arc(0, 0, 23, 0, TAU); c.stroke(); c.fillStyle = '#8a5606'; c.font = font(700, 30); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(gl, 0, 2); });
  const note = (gl, c1, c2) => spr(120, 60, (c) => { let g = c.createLinearGradient(0, 0, 120, 60); g.addColorStop(0, c1); g.addColorStop(1, c2); rr(c, 2, 2, 116, 56, 8); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(230,255,230,.8)'; c.stroke(); rr(c, 8, 8, 104, 44, 5); c.lineWidth = 1; c.strokeStyle = 'rgba(230,255,230,.45)'; c.stroke(); c.beginPath(); c.arc(60, 30, 17, 0, TAU); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill(); c.fillStyle = 'rgba(240,255,240,.95)'; c.font = font(700, 24); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(gl, 60, 32); c.font = font(700, 11); c.fillText(gl, 20, 17); c.fillText(gl, 100, 45); });
  const cs = [coin('৳'), coin('$'), coin('৳')], ns = [note('৳', '#1f8f4d', '#0d5a30'), note('$', '#2aa05c', '#0f6a38')];
  const items = [];
  for (let i = 0; i < Math.round(26 * q); i++) items.push({ coin: 1, x: R() * w, y: R() * (h + 120), v: 55 + R() * 90, sw: 14 + R() * 26, ph: R() * TAU, rs: 1.2 + R() * 2.2, s: 12 + R() * 14, k: (R() * 3) | 0, tilt: R() - .5 });
  for (let i = 0; i < Math.round(11 * q); i++) items.push({ coin: 0, x: R() * w, y: R() * (h + 120), v: 40 + R() * 60, sw: 20 + R() * 36, ph: R() * TAU, rs: .8 + R() * 1.4, s: 40 + R() * 30, k: (R() * 2) | 0, tilt: 0 });
  items.sort((a, b) => a.s - b.s);
  const sp = Array.from({ length: Math.round(40 * q) }, () => ({ x: R() * w, y: R() * h, p: R() * TAU, v: .8 + R() * 2, s: 3 + R() * 6 }));
  const pts = Array.from({ length: 40 }, (_, i) => { const u = i / 39; return [w * (.05 + .9 * u), h * (.9 - .42 * Math.pow(u, 1.2)) + (R() - .5) * h * .07 * (1 - u * .3)]; });
  return { draw: frame((c, st, t) => {
    c.drawImage(bg, 0, 0, w, h);
    const prog = clamp((t * .12) % 1.4, 0, 1), n = Math.max(2, Math.floor(prog * 39) + 1);                 /* profit line */
    c.beginPath(); pts.slice(0, n).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); const ex = pts[n - 1];
    c.save(); c.lineTo(ex[0], h); c.lineTo(pts[0][0], h); c.closePath(); const ag = c.createLinearGradient(0, h * .45, 0, h); ag.addColorStop(0, 'rgba(61,220,132,.16)'); ag.addColorStop(1, 'rgba(61,220,132,0)'); c.fillStyle = ag; c.fill(); c.restore();
    c.beginPath(); pts.slice(0, n).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = 'rgba(120,255,170,.5)'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.shadowColor = '#3ddc84'; c.shadowBlur = 12; c.stroke(); c.shadowBlur = 0;
    c.globalCompositeOperation = 'lighter'; glow(c, ex[0], ex[1], 20, '255,230,120', .9);
    const sx = ((t * .14) % 1.7 - .35) * w, sg = c.createLinearGradient(sx - 120, 0, sx + 120, 0); sg.addColorStop(0, 'rgba(255,240,170,0)'); sg.addColorStop(.5, 'rgba(255,240,170,.1)'); sg.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = sg; c.save(); c.transform(1, 0, -.4, 1, 0, 0); c.fillRect(sx - 120, 0, 240, h); c.restore();
    c.fillStyle = '#fff4b8'; for (const s of sp) spark4(c, s.x, s.y, s.s, Math.max(0, Math.sin(t * s.v + s.p)) * .8);
    c.globalCompositeOperation = 'source-over';
    for (const o of items) {
      const y = (((o.y + t * o.v) % (h + 140)) + h + 140) % (h + 140) - 70, x = o.x + Math.sin(t * .7 + o.ph) * o.sw;
      c.save(); c.translate(x, y);
      if (o.coin) { const ca = Math.cos(t * o.rs + o.ph), wd = Math.max(.12, Math.abs(ca)); c.rotate(o.tilt + Math.sin(t * .6 + o.ph) * .3); if (wd < .3) { c.fillStyle = '#a56a0a'; c.fillRect(-o.s * .09, -o.s, o.s * .18, o.s * 2); } c.globalAlpha = .55 + .4 * wd; c.drawImage(cs[o.k], -o.s * wd, -o.s, o.s * 2 * wd, o.s * 2); }
      else { c.rotate(Math.sin(t * .8 + o.ph) * .7); c.scale(1, Math.cos(t * o.rs + o.ph) * .85 + .15 * Math.sign(Math.cos(t * o.rs + o.ph) || 1)); c.globalAlpha = .8; c.drawImage(ns[o.k], -o.s, -o.s / 2, o.s * 2, o.s); }
      c.restore();
    }
    const lx = w < 700 ? w - 70 : w - 112, ly = h - 112; c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { const a = t * .25 + i * TAU / 12; c.fillStyle = 'rgba(255,214,90,.13)'; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.cos(a - .09) * 130, ly + Math.sin(a - .09) * 130); c.lineTo(lx + Math.cos(a + .09) * 130, ly + Math.sin(a + .09) * 130); c.closePath(); c.fill(); }
    glow(c, lx, ly, 96, '255,210,74', .35); c.globalCompositeOperation = 'source-over'; logo(c, lx, ly, 84, .96);
  }) };
};

/* =============== MY ALL COLLEAGUE DETAILS: the team as a living constellation (with their photos) =============== */
S.team = (st) => {
  const { w, h } = st, R = rng(77), q = st.q;
  const bg = spr(w / 3, h / 3, (c, W, H) => { vgrad(c, W, H, [[0, '#030a1c'], [.6, '#081a3c'], [1, '#050f26']]); blobs(c, W, H, [[.2, .2, .5, '47,110,240', .16], [.85, .8, .5, '232,192,127', .08], [.5, .5, .6, '40,80,200', .08]]); });
  const nf = Math.min(FX.faces.length, 25), nd = Math.round(34 * q), N = [];
  for (let i = 0; i < nf + nd; i++) { const face = i < nf; N.push({ x: R() * w, y: R() * h, vx: (R() - .5) * (face ? 12 : 20), vy: (R() - .5) * (face ? 10 : 16), r: face ? 16 + R() * 6 : 1.5 + R() * 1.7, face, p: R() * TAU, im: face ? FX.faces[i] : null }); }
  const hub = { x: w < 700 ? w * .5 : w * .72, y: h * .5 }, pl = Array.from({ length: 12 }, () => ({ i: 0, j: 0, u: 0, sp: .25 + R() * .4 }));
  const pick = (p) => { for (let tries = 0; tries < 20; tries++) { const i = (R() * N.length) | 0, j = (R() * N.length) | 0; if (i !== j && Math.hypot(N[i].x - N[j].x, N[i].y - N[j].y) < 190) { p.i = i; p.j = j; p.u = 0; return; } } };
  pl.forEach((p) => { pick(p); p.u = R(); });
  return { draw: frame((c, st, t, dt) => {
    c.drawImage(bg, 0, 0, w, h);
    for (const n of N) { n.x += n.vx * dt; n.y += n.vy * dt; if (n.x < -30) n.x = w + 30; else if (n.x > w + 30) n.x = -30; if (n.y < -30) n.y = h + 30; else if (n.y > h + 30) n.y = -30; }
    c.globalCompositeOperation = 'lighter'; c.lineWidth = 1;
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const a = N[i], b = N[j], D = a.face || b.face ? 200 : 150, d = Math.hypot(a.x - b.x, a.y - b.y); if (d > D) continue; c.strokeStyle = `rgba(${a.face && b.face ? '232,192,127' : '120,170,255'},${(Math.pow(1 - d / D, 1.2) * .42).toFixed(3)})`; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    for (const n of N) { const d = Math.hypot(n.x - hub.x, n.y - hub.y); if (d < 280 && (n.face || d < 190)) { c.strokeStyle = `rgba(232,192,127,${((1 - d / 280) * .5).toFixed(3)})`; c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(hub.x, hub.y); c.stroke(); } }
    for (const p of pl) { p.u += dt * p.sp; const a = N[p.i], b = N[p.j]; if (p.u >= 1 || Math.hypot(a.x - b.x, a.y - b.y) > 200) { pick(p); continue; } glow(c, lerp(a.x, b.x, p.u), lerp(a.y, b.y, p.u), 8, '255,225,160', .95); }
    for (const n of N) if (!n.face) { glow(c, n.x, n.y, n.r * 4, '120,170,255', .35 + .25 * Math.sin(t * 1.5 + n.p)); c.fillStyle = 'rgba(210,230,255,.9)'; c.fillRect(n.x - n.r / 2, n.y - n.r / 2, n.r, n.r); }
    c.globalCompositeOperation = 'source-over';
    for (const n of N) if (n.face) {
      glow(c, n.x, n.y, n.r * 2.4, '232,192,127', .22); c.save(); c.beginPath(); c.arc(n.x, n.y, n.r, 0, TAU); c.clip(); const im = n.im;
      if (im && im.complete && im.naturalWidth) { const s = Math.min(im.naturalWidth, im.naturalHeight); c.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) * .15, s, s, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); } else { c.fillStyle = '#1b3a78'; c.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); }
      c.restore(); c.strokeStyle = 'rgba(232,192,127,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, n.r, 0, TAU); c.stroke();
    }
    glow(c, hub.x, hub.y, 120, '232,192,127', .2); for (let k = 0; k < 3; k++) { const u = (t * .3 + k / 3) % 1; c.strokeStyle = `rgba(232,192,127,${((1 - u) * .35).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(hub.x, hub.y, 50 + u * 90, 0, TAU); c.stroke(); }
    logo(c, hub.x, hub.y, 96, .95);
  }) };
};

/* =============== WELCOME: galaxy + hyperspace (sits behind the welcome stage) =============== */
S.welcome = (st) => {
  const { w, h } = st, R = rng(99), q = st.q, W = FX.wl;
  const bg = spr(w / 3, h / 3, (c, Wd, H) => { vgrad(c, Wd, H, [[0, '#02050f'], [.5, '#071536'], [1, '#02050f']]); blobs(c, Wd, H, [[.5, .38, .6, '40,90,220', .3], [.15, .8, .4, '120,60,200', .16], [.9, .2, .4, '232,192,127', .1]]); });
  const gal = Array.from({ length: Math.round(1000 * q) }, () => { const arm = (R() * 3) | 0, r = Math.pow(R(), .7), k = r; return { r, a: arm * TAU / 3 + r * 5.4 + (R() - .5) * (.7 - r * .4), z: R(), cs: `rgba(${lerp(255, 130, k) | 0},${lerp(226, 170, k) | 0},${lerp(160, 255, k) | 0},` }; });
  const str = Array.from({ length: Math.round(240 * q) }, () => ({ a: R() * TAU, d: R(), k: .4 + R() * 1.2 }));
  const dust = Array.from({ length: Math.round(50 * q) }, () => ({ x: R() * w, y: R() * h, v: 6 + R() * 14, p: R() * TAU, s: .8 + R() * 1.8 }));
  const P = []; let nextShoot = 1.5, sh = null;
  return { draw: frame((c, st, t, dt) => {
    const cx = W.geom ? W.geom.cx : w / 2, cy = W.geom ? W.geom.cy : h * .4, Rmax = Math.hypot(w, h) * .55;
    W.warp += (W.warpTarget - W.warp) * Math.min(1, dt * (W.warpTarget > W.warp ? 2.4 : 1.5)); const wp = W.warp;
    c.drawImage(bg, 0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    glow(c, cx, cy, Math.min(w, h) * .6, '255,210,140', .13); glow(c, cx, cy, Math.min(w, h) * .22, '255,226,170', .2);
    const rot = t * .05, Rg = Math.max(w, h) * .5;
    for (const g of gal) { const x = cx + Math.cos(g.a + rot) * g.r * Rg, y = cy + Math.sin(g.a + rot) * g.r * Rg * .5; c.fillStyle = g.cs + (.25 + .55 * g.z * (1 - g.r * .4)).toFixed(2) + ')'; const s = .8 + g.z * 1.2; c.fillRect(x, y, s, s); }
    c.lineCap = 'round';
    for (const s of str) {
      s.d += dt * (.02 + wp * 1.3) * s.k; if (s.d > 1) { s.d = .01 + Math.random() * .05; s.a = Math.random() * TAU; }
      const r = Math.pow(s.d, 1.6) * Rmax, tl = (.004 + wp * .16) * Rmax * s.d, ca = Math.cos(s.a), sa = Math.sin(s.a);
      c.strokeStyle = `rgba(${wp > .5 ? '200,225,255' : '255,255,255'},${(Math.min(1, s.d * 3) * (.3 + .7 * wp)).toFixed(3)})`; c.lineWidth = .6 + s.d * (1.2 + wp * 1.4);
      c.beginPath(); c.moveTo(cx + ca * r, cy + sa * r); c.lineTo(cx + ca * Math.max(0, r - tl - 1), cy + sa * Math.max(0, r - tl - 1)); c.stroke();
    }
    const u0 = (t - .3) / 2; if (u0 > 0 && u0 < 1) { c.strokeStyle = `rgba(255,214,140,${(Math.pow(1 - u0, 2) * .6).toFixed(3)})`; c.lineWidth = 3 + (1 - u0) * 6; c.beginPath(); c.arc(cx, cy, u0 * Rmax * .8, 0, TAU); c.stroke(); }
    const g = W.geom;
    if (g) {
      c.strokeStyle = 'rgba(120,190,255,.1)'; c.lineWidth = 9; c.beginPath(); c.ellipse(g.cx, g.cy, g.rx, g.ry, 0, 0, TAU); c.stroke();
      const lg = c.createLinearGradient(g.cx - g.rx, 0, g.cx + g.rx, 0); lg.addColorStop(0, 'rgba(217,172,105,.55)'); lg.addColorStop(.5, 'rgba(120,190,255,.5)'); lg.addColorStop(1, 'rgba(217,172,105,.55)'); c.strokeStyle = lg; c.lineWidth = 1.4; c.beginPath(); c.ellipse(g.cx, g.cy, g.rx, g.ry, 0, 0, TAU); c.stroke();
      for (let k = 0; k < 4; k++) { const a = t * .55 + k * PI / 2; glow(c, g.cx + Math.sin(a) * g.rx, g.cy + Math.cos(a) * g.ry, 11, '255,226,170', .85); }
    }
    for (const d of dust) { const y = (((d.y - t * d.v) % h) + h) % h; c.fillStyle = `rgba(255,222,150,${(.15 + .35 * Math.sin(t + d.p) ** 2).toFixed(3)})`; c.fillRect(d.x + Math.sin(t * .4 + d.p) * 10, y, d.s, d.s); }
    if (t >= nextShoot) { nextShoot = t + 2.2 + Math.random() * 3; sh = { x: Math.random() * w * .8 + w * .2, y: Math.random() * h * .35, t0: t }; }
    if (sh) { const u = (t - sh.t0) / .8; if (u > 1) sh = null; else { const x = sh.x - u * 360, y = sh.y + u * 170; const gg = c.createLinearGradient(x, y, x + 140, y - 66); gg.addColorStop(0, `rgba(255,255,255,${(1 - u).toFixed(2)})`); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = gg; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 140, y - 66); c.stroke(); } }
    while (W.bursts.length) { const b = W.bursts.pop(); for (let i = 0; i < b.n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 260; P.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, l: 0, L: .7 + Math.random() * .9, s: 1 + Math.random() * 2.2 }); } }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.l += dt; if (p.l > p.L) { P.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; p.vy = p.vy * .985 + 80 * dt; const k = 1 - p.l / p.L; c.fillStyle = `rgba(255,${(190 + k * 50) | 0},${(110 + k * 60) | 0},${k.toFixed(3)})`; c.fillRect(p.x, p.y, p.s, p.s); }
    if (wp > .55) { const a = Math.min(1, (wp - .55) * 2.2); glow(c, cx, cy, Math.max(w, h) * .7, '190,220,255', a * .55); }
  }) };
};
})();
