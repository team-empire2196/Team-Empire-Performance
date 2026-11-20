/* Team Empire Performance Hub – static site (GitHub Pages). All logic runs in the browser. */
(() => {
'use strict';
const CONFIG = { team: 'Team Empire', dataUrl: 'data/data.enc.json', photoMap: 'photos/map.json', defaultId: 'Team Empire', defaultPass: '0000', agentPass: '1234', tlName: 'Md Ariful Mowla Neloy' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isN = (v) => typeof v === 'number' && isFinite(v);
const avg = (a) => { a = a.filter(isN); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const sum = (a) => a.filter(isN).reduce((x, y) => x + y, 0);
const pad = (n) => String(n).padStart(2, '0');
const safe = (fn) => { try { return fn(); } catch (e) { return null; } };

/* ---------- formatting ---------- */
const fPct = (v, d = 1) => (isN(v) ? (v * 100).toFixed(d) + '%' : (v == null || v === '' ? '—' : esc(v)));
const fNum = (v, d = 2) => (isN(v) ? String(+v.toFixed(d)) : (v == null || v === '' ? '—' : esc(v)));
const fSec = (v) => (isN(v) ? Math.round(v) + ' s' : (v == null ? '—' : esc(v)));
const fDur = (s) => { if (!isN(s)) return '—'; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = Math.round(s % 60); return h + ':' + pad(m) + ':' + pad(x); };
const fmtBy = { p1: (v) => fPct(v, 1), p2: (v) => fPct(v, 2), n: (v) => fNum(v, 2), s: fSec, d: fDur };
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const pill = (st, txt) => `<span class="pill ${st}">${esc(txt)}</span>`;
const fDate = (iso) => { try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };

/* ---------- KPI definitions (from the KPI sheet) ---------- */
const KPIS = [
  { id: 'ce', name: 'Critical Error', v: 'ce', t: 'ceT', k: 'ceK', f: 'p1', tf: 'p1', max: .8, dir: 'low' },
  { id: 'emp', name: 'Empathy', v: 'emp', t: 'empT', k: 'empK', f: 'p1', tf: 'p1', max: .6, dir: 'high' },
  { id: 'fcr', name: 'First Call Resolution', v: 'fcr', t: 'fcrT', k: 'fcrK', f: 'p1', tf: 'p1', max: .2, dir: 'high' },
  { id: 'esc', name: 'Complaint Escalation Accuracy', v: 'esc', t: 'escT', k: 'escK', f: 'p1', tf: 'p1', max: .1, dir: 'high' },
  { id: 'sd', name: 'Service Delivery', v: 'sd', t: 'sdT', k: 'sdK', f: 'n', tf: 'n', max: .2, dir: 'low' },
  { id: 'adh', name: 'Schedule Adherence', v: 'adh', t: 'adhT', k: 'adhK', f: 'p1', tf: 'p1', max: .2, dir: 'high' },
  { id: 'comp', name: 'Login Hour Compliance', v: 'comp', t: null, k: 'compK', f: 'p1', max: .2, dir: 'high', tgt: '100%' },
  { id: 'aht', name: 'Average Handling Time', v: 'aht', t: 'ahtT', k: 'ahtK', f: 's', tf: 's', max: .8, dir: 'low' },
  { id: 'csat', name: 'CSAT (CFS)', v: 'csat', t: 'csatT', k: 'csatK', f: 'p1', tf: 'p1', max: .8, dir: 'high' },
  { id: 'brk', name: 'Break Time (extra break)', v: 'xbrk', t: null, k: 'brkK', f: 'd', max: .2, dir: 'low', tgt: 'No extra' },
  { id: 'dkb', name: 'DKB Attendance', v: 'dkb', t: null, k: 'dkbK', f: 'p1', max: .05, dir: 'high', tgt: '95%+' },
  { id: 'quiz', name: 'Quiz Score', v: 'quiz', t: null, k: 'quizK', f: 'p1', max: .05, dir: 'high', tgt: '95%+' },
];
const kStat = (k, max) => { if (!isN(k)) return 'mute'; const r = k / max; return r >= .999 ? 'good' : r > 0 ? 'warn' : 'bad'; };
const kLabel = { good: 'Full marks', warn: 'Partial', bad: 'No marks', mute: 'No data' };
const gradeCls = (g) => ({ 'A+': 'good', A: 'good', B: 'brand', C: 'warn', D: 'bad' }[g] || 'mute');
const ahtStat = (v, t) => (!isN(v) ? 'mute' : v <= t ? 'good' : v <= t * 1.15 ? 'warn' : 'bad');
const csatStat = (v, t) => (!isN(v) ? 'mute' : v >= t ? 'good' : v >= t - .02 ? 'warn' : 'bad');
const dkbStat = (v) => (!isN(v) ? ['mute', 'No data'] : v >= .95 ? ['good', 'Healthy'] : v >= .9 ? ['warn', 'Fair'] : ['bad', 'Low']);
const TARGET_AHT = 180, TARGET_CSAT = .93;

/* ---------- state ---------- */
const S = { data: null, agent: 'all', sec: 'dash', sub: null, month: null, status: 'login', photos: {}, tables: {}, tstate: {}, pending: null, cred: null, vaultSalt: null, dq: {}, lbAll: false, att: { only: true } };
const SECTIONS = [
  { id: 'dash', name: 'Dashboard', ic: 'i-dash' }, { id: 'agent', name: 'My Performance', ic: 'i-user' },
  { id: 'audit', name: 'Audit Details', ic: 'i-audit' }, { id: 'emp', name: 'Parameter Empathy', ic: 'i-heart' },
  { id: 'fcr', name: 'FCR, Quiz & SD', ic: 'i-target' }, { id: 'dkb', name: 'Complaint & DKB', ic: 'i-flag' },
  { id: 'lag', name: 'Lag & Adherence', ic: 'i-clock' }, { id: 'aht', name: 'AHT & CFS', ic: 'i-phone' },
  { id: 'punch', name: 'Shift & Punch', ic: 'i-cal' }, { id: 'team', name: 'My all Colleague Details', ic: 'i-user' },
];
const SUBS = ['ce', 'nce', 'emp', 'rtc', 'att', 'dkb', 'dkbabs', 'sd', 'comp', 'aht', 'csat', 'brk'];
const A = () => (S.data ? S.data.agents : []);
const cur = () => A().find((a) => a.id === S.agent) || null;
const pool = () => { const c = cur(); return c ? [c] : A(); };
const ranked = () => A().slice().sort((a, b) => (b.final ?? -9) - (a.final ?? -9));
const rankOf = (a) => ranked().findIndex((x) => x.id === a.id) + 1;
const dataThrough = () => { const d = S.data; if (!d) return null; let last = -1; A().forEach((a) => { (a.ahtDay || []).forEach((v, i) => { if (isN(v) && i > last) last = i; }); (a.csatDay || []).forEach((v, i) => { if (v > 0 && i > last) last = i; }); (a.cal || []).forEach((v, i) => { if (v && v !== 'o' && i > last) last = i; }); }); return last >= 0 ? d.days[last] : null; };

/* ---------- photos (EID based; photos/map.json is the only thing to edit) ---------- */
const photoUrl = (a) => (S.photos && S.photos[a.id] ? 'photos/' + encodeURIComponent(S.photos[a.id]) : null);
const avatar = (a, sz, cls = '') => { const u = photoUrl(a); return `<span class="avt ${cls}" style="--s:${sz}px" role="img" aria-label="${esc(a.name)}">${u ? `<img class="ph" alt="" decoding="async" src="${u}">` : ''}</span>`; };
document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('ph')) t.remove(); }, true);

/* ---------- Excel serial helpers ---------- */
const EPOCH = Date.UTC(1899, 11, 30);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const sdt = (n) => new Date(EPOCH + Math.round(n * 864e5));
const ymS = (n) => { const d = sdt(Math.floor(n)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
const fD = (n) => { if (!isN(n)) return '—'; const d = sdt(Math.floor(n)); return pad(d.getUTCDate()) + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const fWd = (n) => WD[sdt(Math.floor(n)).getUTCDay()];
const isoS = (n) => { const d = sdt(Math.floor(n)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
const fT = (n) => { if (!isN(n)) return '—'; let s = Math.round((n - Math.floor(n)) * 86400); s %= 86400; return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
const fHM = (n) => { if (!isN(n)) return '—'; const t = fT(n); return t.slice(0, 5); };
const monName = (ym) => { if (!ym) return ''; const [y, m] = ym.split('-'); return MONL[+m - 1] + ' ' + y; };
const fMin = (m) => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min'; };
const download = (name, text, type = 'text/csv;charset=utf-8') => { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

/* ---------- eagle chasing a snake (page-change transition + login theme) ---------- */
const EAGLE = () => `<svg class="eagle-svg" viewBox="0 0 220 130" aria-hidden="true">
  <g class="wing wing-far"><path d="M100 58C78 22 46 8 12 14C40 26 58 42 76 70Z" fill="#4a2c16"/><path d="M30 20C48 30 62 44 76 68M52 14C64 28 72 44 82 66" stroke="#2e1a0b" stroke-width="1.6" fill="none" opacity=".6"/></g>
  <path d="M58 68L6 80L12 94L62 82Z" fill="#f3efe6" stroke="#cfc8b8" stroke-width="1"/>
  <path d="M26 79L30 91M40 75L44 87" stroke="#cfc8b8" stroke-width="1.4"/>
  <ellipse cx="108" cy="72" rx="50" ry="18" fill="#6b4220" transform="rotate(-6 108 72)"/>
  <path d="M70 80C90 94 128 92 150 76C130 86 96 88 70 80Z" fill="#8a5a30" opacity=".8"/>
  <path d="M130 86L146 100L141 104L124 92Z" fill="#e9b53c"/><path d="M142 99l8 7M137 103l7 6" stroke="#c98f1c" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M118 88L134 104L129 108L112 94Z" fill="#e9b53c"/>
  <circle cx="156" cy="58" r="15" fill="#faf8f2"/>
  <path d="M168 54C186 55 190 66 180 70C175 66 171 65 166 64Z" fill="#eab63e" stroke="#c48b12" stroke-width="1"/>
  <circle cx="161" cy="53" r="3" fill="#1d1208"/><circle cx="162" cy="52" r="1" fill="#fff"/>
  <path d="M153 47L170 51" stroke="#cfc8b8" stroke-width="2.2" stroke-linecap="round"/>
  <g class="wing wing-near"><path d="M104 62C84 14 48 -6 6 4C38 20 58 42 78 76Z" fill="#7b4c26"/><path d="M26 10C46 22 62 42 78 72M50 2C64 18 74 40 84 70M76 -2C84 16 90 38 96 62" stroke="#4b2c14" stroke-width="1.8" fill="none" opacity=".65"/></g>
</svg>`;
const SNAKE = () => { const n = 20; let seg = ''; for (let i = n - 1; i >= 0; i--) { const x = 196 - i * 9.2, y = 38 + Math.sin(i * .62) * 8, r = i === 0 ? 8.5 : 7.6 - i * .27; seg += `<circle class="sg" style="animation-delay:${(-i * 0.085).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(1.8, r).toFixed(1)}" fill="${i % 3 === 0 ? '#1e7a35' : i % 3 === 1 ? '#2fa24b' : '#c9b13a'}"/>`; }
  return `<svg class="snake-svg" viewBox="0 0 220 76" aria-hidden="true"><g>${seg}<g class="sg" style="animation-delay:0s"><circle cx="196" cy="38" r="9" fill="#1e7a35"/><circle cx="199" cy="35" r="2.6" fill="#ffe14d"/><circle cx="200" cy="35" r="1.1" fill="#111"/><path class="tongue" d="M204 40L214 40M214 40L219 36M214 40L219 44" stroke="#e0293a" stroke-width="1.6" fill="none" stroke-linecap="round"/></g></g></svg>`; };
const CHASE = () => `<div class="snake">${SNAKE()}</div><div class="eagle">${EAGLE()}</div>`;
/* ---------- team stats ---------- */
function csatTeam(list) { const c = sum(list.map((a) => a.csatCnt)), d = sum(list.map((a) => a.dsatCnt)); return c + d > 0 ? c / (c + d) : null; }
function fcrTeam(list) { const c = sum(list.map((a) => a.fcrCalls)), f = sum(list.map((a) => a.fcrCount)); return c > 0 ? f / c : avg(list.map((a) => a.fcr)); }
function tiles(list, solo) {
  const t = (l, v, f, sub, st, raw, dec, suf) => ({ l, v, f, sub, st, raw, dec, suf });
  const aht = solo ? list[0].aht : avg(list.map((a) => a.aht));
  const csat = solo ? list[0].csat : csatTeam(list);
  const adh = avg(list.map((a) => a.adh)), ce = avg(list.map((a) => a.ce)), emp = avg(list.map((a) => a.emp));
  const fcr = solo ? list[0].fcr : fcrTeam(list), comp = avg(list.map((a) => a.comp)), dkb = avg(list.map((a) => a.dkb));
  const fin = avg(list.map((a) => a.final));
  const q = list.filter((a) => a.elig === 'Qualified').length;
  return [
    t('Average Final Score', fin, 'n2', solo ? 'Rank #' + rankOf(list[0]) + ' of ' + A().length : q + ' of ' + list.length + ' qualified', solo ? gradeCls(list[0].cat) : 'brand', fin, 2, '', solo ? 'Grade ' + (list[0].cat || '—') : null),
    t('Average Handling Time', aht, 's', 'Target ' + TARGET_AHT + ' s', ahtStat(aht, TARGET_AHT), aht, 0, ' s'),
    t('CSAT (CFS)', csat, 'p1', 'Target ' + TARGET_CSAT * 100 + '%', csatStat(csat, TARGET_CSAT), isN(csat) ? csat * 100 : null, 1, '%'),
    t('Schedule Adherence', adh, 'p1', 'Target 100%', adh >= .95 ? 'good' : adh >= .85 ? 'warn' : 'bad', isN(adh) ? adh * 100 : null, 1, '%'),
    t('Critical Error', ce, 'p1', 'Target 1.5% or less', !isN(ce) ? 'mute' : ce <= .015 ? 'good' : ce <= .05 ? 'warn' : 'bad', isN(ce) ? ce * 100 : null, 1, '%'),
    t('Empathy', emp, 'p1', 'Target 90%', !isN(emp) ? 'mute' : emp >= .9 ? 'good' : emp >= .85 ? 'warn' : 'bad', isN(emp) ? emp * 100 : null, 1, '%'),
    t('First Call Resolution', fcr, 'p1', 'Target 93%', !isN(fcr) ? 'mute' : fcr >= .93 ? 'good' : fcr >= .9 ? 'warn' : 'bad', isN(fcr) ? fcr * 100 : null, 1, '%'),
    t('Login Compliance', comp, 'p1', 'Target 100%', !isN(comp) ? 'mute' : comp >= .95 ? 'good' : comp >= .85 ? 'warn' : 'bad', isN(comp) ? comp * 100 : null, 1, '%'),
    t('DKB Attendance', dkb, 'p1', 'Target 95%+', dkbStat(dkb)[0], isN(dkb) ? dkb * 100 : null, 1, '%'),
  ];
}
const tileHTML = (x, i) => {
  const shown = x.f === 'n2' ? fNum(x.v, 2) : fmtBy[x.f](x.v);
  const cnt = isN(x.raw) ? `<b class="count" data-to="${x.raw}" data-dec="${x.dec}" data-suf="${esc(x.suf)}">${shown}</b>` : `<b>${shown}</b>`;
  return `<div class="card tile lift reveal" style="--i:${i}"><span class="l">${esc(x.l)}</span><span class="v num">${cnt}</span><span class="s">${pill(x.st, x.st === 'good' ? 'On track' : x.st === 'warn' ? 'Watch' : x.st === 'bad' ? 'Needs focus' : x.st === 'brand' ? 'Team' : 'No data')}${esc(x.sub)}</span></div>`;
};

/* ---------- charts ---------- */
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
function chart(o) {
  const W = 640, H = o.h || 230, L = 46, R = 12, T = 14, B = 26, n = o.labels.length;
  const all = []; o.series.forEach((s) => s.vals.forEach((v) => { if (isN(v)) all.push(v); })); if (isN(o.target)) all.push(o.target);
  if (!all.length) return `<div class="empty">No daily data yet.</div>`;
  let lo = o.zero ? 0 : Math.min(...all), hi = Math.max(...all);
  if (o.zero) hi = niceMax(hi * 1.05); else { const pd = (hi - lo) * .15 || hi * .05 || 1; lo -= pd; hi += pd; }
  const X = (i) => L + (n === 1 ? (W - L - R) / 2 : (i + (o.bars ? .5 : 0)) * (W - L - R) / (o.bars ? n : n - 1));
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = '', ticks = 4;
  for (let i = 0; i <= ticks; i++) { const v = lo + (hi - lo) * i / ticks, y = Y(v); g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${o.yf ? o.yf(v) : Math.round(v)}</text>`; }
  const step = n > 20 ? 3 : n > 12 ? 2 : 1;
  o.labels.forEach((l, i) => { if (i % step === 0) g += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle">${l}</text>`; });
  let body = '';
  const colors = ['var(--brand)', 'var(--sky)', 'var(--gold)'];
  o.series.forEach((s, si) => {
    const c = s.color || colors[si % 3];
    if (o.bars) {
      const bw = Math.max(3, (W - L - R) / n * .62);
      s.vals.forEach((v, i) => { if (isN(v) && v > 0) { const y = Y(v); body += `<rect class="col" style="animation-delay:${i * 18}ms" x="${X(i) - bw / 2}" y="${y}" width="${bw}" height="${Y(lo) - y}" rx="3" fill="${c}"/>`; } });
    } else {
      let d = '', pen = false, len = 0, px = 0, py = 0;
      s.vals.forEach((v, i) => { if (isN(v)) { const x = X(i), y = Y(v); if (pen) len += Math.hypot(x - px, y - py); d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); pen = true; px = x; py = y; } else pen = false; });
      body += `<path class="draw" style="--len:${Math.ceil(len + 400)}" d="${d}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      s.vals.forEach((v, i) => { if (isN(v)) body += `<circle cx="${X(i)}" cy="${Y(v)}" r="3.4" fill="var(--surface)" stroke="${c}" stroke-width="2"/>`; });
    }
  });
  if (isN(o.target)) body += `<line x1="${L}" x2="${W - R}" y1="${Y(o.target)}" y2="${Y(o.target)}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - R}" y="${Y(o.target) - 5}" text-anchor="end" style="fill:var(--bad)">${esc(o.tl || 'Target')}</text>`;
  let hits = '';
  const cw = (W - L - R) / (o.bars ? n : Math.max(1, n - 1));
  o.labels.forEach((l, i) => {
    const rows = o.series.map((s) => `${esc(s.name)}: ${isN(s.vals[i]) ? (o.tf || o.yf || String)(s.vals[i]) : '—'}`).join('<br>');
    hits += `<rect class="hit" x="${X(i) - cw / 2}" y="${T}" width="${cw}" height="${H - T - B}" data-tip="${esc('<b>' + (o.dayp || 'Day ') + l + '</b>' + rows)}"/>`;
  });
  const lg = o.series.length > 1 ? `<div class="legend">${o.series.map((s, si) => `<span style="--c:${s.color || colors[si % 3]}">${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Chart')}">${g}${body}${hits}</svg>${lg}`;
}
function barList(items, o = {}) {
  if (!items.length) return `<div class="empty">No data.</div>`;
  const max = o.max || Math.max(...items.map((x) => x.v), 0.0001);
  return `<div class="blist">${items.map((x, i) => `<div class="brow"><span class="nm" title="${esc(x.l)}">${x.av || ''}<span>${esc(x.l)}</span></span><div class="bar"><i class="${x.st || ''}" style="--w:${Math.max(2, Math.min(100, x.v / max * 100))}%;--i:${i}"></i>${isN(o.target) ? `<span class="tg" style="--t:${o.target / max * 100}%"></span>` : ''}</div><span class="vl num ${x.st ? 't-' + x.st : ''}">${(o.f || String)(x.v)}</span></div>`).join('')}</div>`;
}

/* ---------- tables ---------- */
function table(id, cols, rows, opt = {}) {
  S.tables[id] = { cols, rows, opt };
  const st = S.tstate[id] || (S.tstate[id] = { q: '', k: opt.sort || null, d: opt.dir || 'desc' });
  return `<div class="tbl-tools">${opt.search === false ? '<span></span>' : `<div class="field"><label for="q-${id}">Search</label><input id="q-${id}" data-q="${id}" type="search" placeholder="Agent name" value="${esc(st.q)}"></div>`}<button class="btn sm" data-csv="${id}"><svg><use href="#i-dl"/></svg>Export CSV</button></div><div class="tbl-wrap" id="tw-${id}">${tableBody(id)}</div>`;
}
function tableBody(id) {
  const T = S.tables[id], st = S.tstate[id]; let rows = T.rows.slice();
  if (st.q) rows = rows.filter((r) => (r.name || '').toLowerCase().includes(st.q.toLowerCase()));
  if (st.k != null) { const c = T.cols[st.k]; if (c && c.s) { const dir = st.d === 'asc' ? 1 : -1; rows.sort((a, b) => { const x = c.s(a), y = c.s(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; }); } }
  if (!rows.length) return `<div class="empty">No matching agents.</div>`;
  const me = S.agent;
  return `<table><thead><tr>${T.cols.map((c, i) => `<th class="${c.r ? 'r' : ''}" data-sort="${id}:${i}" ${st.k === i ? `aria-sort="${st.d === 'asc' ? 'ascending' : 'descending'}" data-arrow="${st.d === 'asc' ? '▲' : '▼'}"` : ''}>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.id === me ? 'me' : ''}">${T.cols.map((c) => `<td class="${c.nm ? 'nm' : ''} ${c.r ? 'r num' : 'num'}">${c.c(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const col = (h, c, o = {}) => Object.assign({ h, c }, o);
const valCol = (h, key, f = 'p1', o = {}) => col(h, (a) => (isN(a[key]) ? fmtBy[f](a[key]) : `<span class="t-mute">${a[key] == null ? '—' : esc(a[key])}</span>`), Object.assign({ r: 1, s: (a) => (isN(a[key]) ? a[key] : null), x: (a) => (isN(a[key]) ? a[key] : (a[key] ?? '')) }, o));
const kCol = (h, key, max) => col(h, (a) => (isN(a[key]) ? pill(kStat(a[key], max), (a[key] > 0 ? '+' : '') + fNum(a[key], 3)) : '—'), { r: 1, s: (a) => (isN(a[key]) ? a[key] : null), x: (a) => a[key] ?? '' });
const scope = () => { const c = cur(); return c ? [c] : A(); };
const AWARDS = [
  { t: 'Top Performer', ic: 'i-trophy', pick: (l) => best(l, (a) => a.final, 1), v: (a) => 'Final score ' + fNum(a.final, 2) },
  { t: 'Quality Champion', ic: 'i-shield', pick: (l) => best(l.filter((a) => a.audit && a.audit.total >= 3), (a) => (a.emp ?? 0) - (a.ce ?? 1), 1), v: (a) => 'Empathy ' + fPct(a.emp) + ' · CE ' + fPct(a.ce) },
  { t: 'Speed Star', ic: 'i-bolt', pick: (l) => best(l.filter((a) => isN(a.aht) && a.aht > 0), (a) => a.aht, -1), v: (a) => 'AHT ' + fSec(a.aht) },
  { t: 'CSAT Star', ic: 'i-star', pick: (l) => best(l.filter((a) => (a.csatCnt || 0) + (a.dsatCnt || 0) >= 20), (a) => a.csat, 1), v: (a) => 'CSAT ' + fPct(a.csat) },
  { t: 'Attendance Hero', ic: 'i-cal', pick: (l) => best(l.filter((a) => (a.roster || 0) > 0), (a) => (a.adh ?? 0) + (a.present || 0) / ((a.roster || 1) * 100), 1), v: (a) => 'Adherence ' + fPct(a.adh) + ' · ' + a.present + '/' + a.roster + ' days' },
];
function best(l, f, dir) { let b = null, bv = null; l.forEach((a) => { const v = f(a); if (!isN(v)) return; if (bv == null || (dir > 0 ? v > bv : v < bv)) { b = a; bv = v; } }); return b; }

/* ---------- name cells with photo ---------- */
const nameHTML = (a, sz = 26) => `<span class="nmw">${avatar(a, sz)}<span class="nmt">${esc(a.name)}</span></span>`;
const nameCol = (h = 'Agent') => col(h, (a) => nameHTML(a), { nm: 1, s: (a) => a.name.toLowerCase(), x: (a) => a.name });
const openBtn = (kind, a, label, cls = '') => `<button class="lnk ${cls}" data-open="${kind}:${esc(a.id)}" title="Open details">${label}</button>`;

/* ---------- section: Dashboard ---------- */
const SHORT = { ce: 'CE', emp: 'Empathy', fcr: 'FCR', esc: 'Esc.', sd: 'SD', adh: 'Adh.', comp: 'Login', aht: 'AHT', csat: 'CSAT', brk: 'Break', dkb: 'DKB', quiz: 'Quiz' };
function leaderboard(R, limit) {
  const list = limit ? R.slice(0, limit) : R;
  return `<div class="lb">${list.map((a, i) => `<button class="lb-row reveal ${a.id === S.agent ? 'me' : ''}" style="--i:${Math.min(i, 12)}" data-pick="${esc(a.id)}" title="Open ${esc(a.name)}'s performance"><span class="lb-n ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span>${avatar(a, 44)}<span class="lb-name"><b>${esc(a.name)}</b><small>${esc(a.id)} · ${esc(a.elig || '')}</small></span><span class="lb-bar"><div class="bar"><i class="${a.cat === 'D' ? 'bad' : a.cat === 'C' ? 'warn' : ''}" style="--w:${Math.max(2, (a.final || 0) / 4 * 100)}%;--i:${i}"></i></div></span><span class="lb-score num"><b>${fNum(a.final, 2)}</b></span>${pill(gradeCls(a.cat), a.cat || '—')}</button>`).join('')}</div>${R.length > (limit || R.length) ? `<button class="btn sm more" data-lbmore>Show all ${R.length} agents</button>` : ''}`;
}
function matrixHTML(R) {
  return `<div class="tbl-wrap"><table class="matrix"><thead><tr><th style="text-align:left">Agent</th>${KPIS.map((k) => `<th title="${esc(k.name)}">${SHORT[k.id]}</th>`).join('')}<th>Final</th></tr></thead><tbody>${R.map((a) => `<tr class="${a.id === S.agent ? 'me' : ''}"><td class="nm">${nameHTML(a, 24)}</td>${KPIS.map((k) => { const v = a[k.k], st = kStat(v, k.max); return `<td class="mk-${st}" title="${esc(k.name)}: ${isN(v) ? (v > 0 ? '+' : '') + fNum(v, 3) : 'no data'} of ${k.max}">${isN(v) ? (v > 0 ? '+' : '') + fNum(v, 2) : '·'}</td>`; }).join('')}<td><b>${fNum(a.final, 2)}</b></td></tr>`).join('')}</tbody></table></div><div class="legend2"><span><i style="background:var(--good-soft)"></i>Full marks</span><span><i style="background:var(--warn-soft)"></i>Partial</span><span><i style="background:var(--bad-soft)"></i>No / negative marks</span></div>`;
}
const dkbOf = (a) => { const r = (a.dkbRows || []).filter((x) => ymS(x.d) === S.data.ym); const P = r.filter((x) => x.s === 'P').length, Ab = r.filter((x) => x.s === 'A').length; return { P, A: Ab, pct: P + Ab > 0 ? P / (P + Ab) : null, rows: r }; };
const withAv = (a, o) => Object.assign({ av: avatar(a, 22) }, o);

function secDash() {
  const c = cur(), list = pool();
  const tl = tiles(list, !!c);
  const R = ranked();
  const grades = ['A+', 'A', 'B', 'C', 'D'], gc = { 'A+': '#0e9b74', A: '#46c9a0', B: '#2f8cf0', C: '#e0a31a', D: '#d6404c' };
  const G = A(); const gcount = grades.map((g) => ({ g, n: G.filter((a) => a.cat === g).length }));
  const att = KPIS.map((k) => { const have = G.filter((a) => isN(a[k.k])); return { l: k.name, v: have.length ? have.filter((a) => a[k.k] / k.max >= .999).length / have.length * 100 : 0, n: have.length }; }).sort((a, b) => b.v - a.v);
  const risk = R.filter((a) => a.cat === 'D' || a.elig !== 'Qualified').slice().reverse().slice(0, 8);
  const days = S.data.days;
  const teamAht = days.map((_, i) => avg(G.map((a) => (a.ahtDay || [])[i])));
  const teamCsat = days.map((_, i) => { const c1 = sum(G.map((a) => (a.csatDay || [])[i])), d1 = sum(G.map((a) => (a.dsatDay || [])[i])); return c1 + d1 > 0 ? c1 / (c1 + d1) * 100 : null; });
  const calls = days.map((_, i) => { const v = sum(G.map((a) => (a.calls || [])[i])); return v > 0 ? v : null; });
  const heads = days.map((_, i) => { const v = G.filter((a) => (a.cal || [])[i] === 'p').length; return v > 0 ? v : null; });
  const hist = S.data.hist || [];
  const histCard = hist.length >= 2 ? `<div class="card reveal" style="--i:12"><h3>Score history</h3><div class="sub">Team average final score at each Excel update</div>${chart({ labels: hist.map((h) => new Date(h.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), series: [{ name: 'Avg final score', vals: hist.map((h) => h.avg) }], yf: (v) => v.toFixed(2), dayp: '', aria: 'Score history' })}</div>` : `<div class="card reveal" style="--i:12"><h3>Score history</h3><div class="sub">Builds up with every Excel update</div><div class="empty">After the next update this chart compares the team's average score across updates.</div></div>`;
  const qa = G.flatMap((a) => a.qa || []); const ceN = qa.filter((r) => r.ce === 'Fail').length, nceN = qa.filter((r) => r.nceTxt).length;
  const qMonths = [...new Set(qa.map((r) => r.ym).filter(Boolean))].sort();
  const dk = G.map((a) => ({ a, d: dkbOf(a) }));
  const dkP = sum(dk.map((x) => x.d.P)), dkA = sum(dk.map((x) => x.d.A));
  const rosterTot = sum(G.map((a) => a.roster)), presentTot = sum(G.map((a) => a.present));
  const totalCalls = sum(calls);
  const sdTot = sum(G.map((a) => (a.sdRows || []).length)), sdValid = sum(G.map((a) => (a.sdRows || []).filter((r) => /^valid$/i.test(r.val)).length));
  const absentTop = dk.filter((x) => x.d.A > 0).sort((x, y) => y.d.A - x.d.A).slice(0, 6);
  const attLow = G.filter((a) => isN(a.adh)).sort((a, b) => a.adh - b.adh).slice(0, 6);
  const strip = [
    ['Agents', G.length], ['Qualified', G.filter((a) => a.elig === 'Qualified').length + ' / ' + G.length], ['Calls handled', totalCalls ? totalCalls.toLocaleString() : '—'],
    ['Attendance days', rosterTot ? presentTot + ' / ' + rosterTot : '—'], ['DKB present rate', dkP + dkA ? fPct(dkP / (dkP + dkA)) : '—'], ['DKB absent days', dkA],
    ['Audits (raw)', qa.length + (qMonths.length ? ' · ' + qMonths.map(monName).join(', ') : '')], ['CE / NCE calls (raw)', ceN + ' / ' + nceN],
    ['SD complaints (raw)', sdTot + (sdTot ? ' · ' + sdValid + ' valid' : '')],
  ];
  return `
  <div class="sec-h reveal"><div><h1>${c ? nameHTML(c, 40) : 'Team Overview'}</h1><p>${c ? 'Individual snapshot compared with the team' : 'How the whole team is performing this month'}</p></div>${stampHTML()}</div>
  <div class="grid g-tiles">${tl.map(tileHTML).join('')}</div>
  <div class="strip reveal" style="--i:2">${strip.map((s) => `<div class="s"><small>${esc(s[0])}</small><b class="num">${esc(String(s[1]))}</b></div>`).join('')}</div>
  <div class="grid g-2">
    <div class="card reveal" style="--i:2"><h3>Team leaderboard</h3><div class="sub">Rank, photo, final score and grade. Click an agent to open their performance.</div>${leaderboard(R, S.lbAll ? 0 : 10)}</div>
    <div style="display:grid;gap:14px">
      <div class="card reveal" style="--i:3"><h3>Gamification & awards</h3><div class="sub">Recognition from this month's data</div><div style="display:grid;gap:8px">${AWARDS.map((w) => { const a = w.pick(G); return a ? `<div class="award"><div class="ic"><svg><use href="#${w.ic}"/></svg></div><div>${avatar(a, 34)}</div><div><small>${w.t}</small><b>${esc(a.name)}</b><span class="t-mute" style="font-size:12px">${esc(w.v(a))}</span></div></div>` : ''; }).join('')}</div></div>
      <div class="card reveal" style="--i:4"><h3>Grade distribution</h3><div class="sub">${G.length} agents</div><div class="stack">${gcount.filter((x) => x.n).map((x, i) => `<i style="--w:${x.n / G.length * 100}%;background:${gc[x.g]};animation-delay:${i * 90}ms" title="${x.g}: ${x.n}"></i>`).join('')}</div><div class="legend">${gcount.map((x) => `<span style="--c:${gc[x.g]}">${x.g} · <b>${x.n}</b></span>`).join('')}</div></div>
    </div>
  </div>
  <div class="grid g-2">
    <div class="card reveal" style="--i:5"><h3>KPI target attainment</h3><div class="sub">Share of agents earning full marks on each KPI. Lowest rows are the team's weak spots.</div>${barList(att.map((x) => ({ l: x.l, v: x.v, st: x.v >= 70 ? 'good' : x.v >= 35 ? 'warn' : 'bad' })), { max: 100, f: (v) => Math.round(v) + '%' })}</div>
    <div class="card reveal" style="--i:6"><h3>Agents to support</h3><div class="sub">Grade D or not qualified, lowest scores first</div>${risk.length ? risk.map((a) => { const zero = KPIS.filter((k) => isN(a[k.k]) && a[k.k] <= 0 && k.max >= .1).slice(0, 3).map((k) => k.name.replace(/ \(.*\)/, '')).join(', '); return `<div class="rank"><span>${avatar(a, 30)}</span><span class="nm">${esc(a.name)}</span><span class="num"><b>${fNum(a.final, 2)}</b> ${a.elig !== 'Qualified' ? pill('bad', 'Not qualified') : ''}</span><div class="t-mute" style="grid-column:2/4;font-size:12px">${zero ? 'No marks on: ' + esc(zero) : 'Review KPI details'}</div></div>`; }).join('') : '<div class="empty">Everyone is qualified and above grade D.</div>'}</div>
  </div>
  <div class="grid g-2">
    <div class="card reveal" style="--i:6"><h3>Daily AHT</h3><div class="sub">Team average, seconds. Red line is the target.</div>${chart({ labels: days, series: [{ name: 'AHT (s)', vals: teamAht.map((v) => (isN(v) ? Math.round(v) : null)) }], target: TARGET_AHT, tl: 'Target 180s', yf: (v) => Math.round(v), tf: (v) => Math.round(v) + ' s', aria: 'Daily AHT' })}</div>
    <div class="card reveal" style="--i:7"><h3>Daily CSAT (CFS)</h3><div class="sub">Team satisfied-customer share per day</div>${chart({ labels: days, series: [{ name: 'CSAT %', vals: teamCsat.map((v) => (isN(v) ? +v.toFixed(1) : null)), color: 'var(--sky)' }], target: 93, tl: 'Target 93%', yf: (v) => Math.round(v) + '%', tf: (v) => v.toFixed(1) + '%', aria: 'Daily CSAT' })}</div>
    <div class="card reveal" style="--i:8"><h3>Daily calls handled</h3><div class="sub">From the attendance sheet</div>${chart({ labels: days, series: [{ name: 'Calls', vals: calls, color: 'var(--brand-2)' }], bars: 1, zero: 1, yf: (v) => Math.round(v), tf: (v) => Math.round(v) + ' calls', aria: 'Daily calls' })}</div>
    <div class="card reveal" style="--i:9"><h3>Agents on shift</h3><div class="sub">Present headcount per day</div>${chart({ labels: days, series: [{ name: 'Present', vals: heads, color: 'var(--gold)' }], bars: 1, zero: 1, yf: (v) => Math.round(v), tf: (v) => Math.round(v) + ' agents', aria: 'Agents on shift' })}</div>
  </div>
  <div class="grid g-2">
    <div class="card reveal" style="--i:10"><h3>Attendance watch</h3><div class="sub">Lowest schedule attendance this month</div>${barList(attLow.map((a) => withAv(a, { l: a.name, v: a.adh * 100, st: a.adh >= .95 ? 'good' : a.adh >= .85 ? 'warn' : 'bad' })), { max: 100, f: (v) => v.toFixed(1) + '%' })}</div>
    <div class="card reveal" style="--i:11"><h3>DKB absent days</h3><div class="sub">Most absent days in the DKB attendance raw sheet</div>${absentTop.length ? barList(absentTop.map((x) => withAv(x.a, { l: x.a.name, v: x.d.A, st: x.d.A >= 4 ? 'bad' : 'warn' })), { max: Math.max(...absentTop.map((x) => x.d.A)), f: (v) => v + ' d' }) : '<div class="empty">No DKB absences recorded.</div>'}</div>
  </div>
  <div class="card reveal" style="--i:12"><h3>KPI marks matrix</h3><div class="sub">Marks earned by every agent on every KPI. Sorted by final score.</div>${matrixHTML(R)}</div>
  ${histCard}`;
}
function stampHTML() {
  const d = S.data, th = dataThrough();
  return `<div class="stamp"><span class="chip">${esc(d.month || 'Current month')}</span>${th ? `<span>Data up to <b>${th} ${esc((d.month || '').split(' ')[0])}</b></span>` : ''}${d.at ? `<span>Last updated <b>${esc(fDate(d.at))}</b></span>` : ''}</div>`;
}
const noteStamp = (key) => { const n = S.data.notes && S.data.notes[key]; return n ? `<div class="stamp"><span>Source label: <b>${esc(n)}</b></span></div>` : ''; };
const head = (t, p, extra = '') => `<div class="sec-h reveal"><div><h1>${t}</h1><p>${p}</p></div>${stampHTML()}</div>${extra}`;

/* ---------- My Performance ---------- */
const DRILL = [
  { k: 'ce', t: 'Critical Error (CE)', ic: 'i-shield' }, { k: 'nce', t: 'Non-Critical (NCE)' }, { k: 'emp', t: 'Empathy' }, { k: 'rtc', t: 'RTC accuracy' },
  { k: 'att', t: 'Attendance' }, { k: 'dkb', t: 'DKB attendance' }, { k: 'sd', t: 'Service delivery' },
];
const KPI_SUB = { ce: 'ce', emp: 'emp', adh: 'att', dkb: 'dkb', sd: 'sd', comp: 'comp', aht: 'aht', csat: 'csat', brk: 'brk' };
const qaIn = (a, m) => (a.qa || []).filter((r) => !m || r.ym === m);
const qaMonths = (a) => [...new Set((a.qa || []).map((r) => r.ym).filter(Boolean))].sort().reverse();
const pickMonth = (months) => (S.month && months.includes(S.month) ? S.month : (months.includes(S.data.ym) ? S.data.ym : months[0] || null));
function drillStats(a) {
  const m = pickMonth(qaMonths(a)), q = qaIn(a, m), n = q.length;
  const ce = q.filter((r) => r.ce === 'Fail').length, nce = q.filter((r) => r.nceTxt).length, rtcF = q.filter((r) => r.rtc === 'Fail').length;
  const ep = sum(q.map((r) => r.ep)), ef = sum(q.map((r) => r.ef));
  const at = a.attRows || []; const ay = at.filter((r) => ymS(r.d) === S.data.ym);
  const attPct = ay.length ? sum(ay.map((r) => r.st)) / ay.length : null;
  const dk = dkbOf(a);
  const sdN = (a.sdRows || []).length;
  return {
    ce: [n ? fPct(ce / n) : '—', n ? ce + ' CE of ' + n + ' audits' : 'No audits in raw sheet'], nce: [n ? fPct(nce / n) : '—', n ? nce + ' NCE of ' + n + ' audits' : 'No audits in raw sheet'],
    emp: [ep + ef ? fPct(ep / (ep + ef)) : '—', n ? q.filter((r) => r.ef > 0).length + ' calls with empathy missing' : 'No audits in raw sheet'], rtc: [n ? fPct(1 - rtcF / n) : '—', n ? rtcF + ' RTC failures of ' + n : 'No audits in raw sheet'],
    att: [attPct != null ? fPct(attPct) : fPct(a.adh), ay.length ? ay.filter((r) => r.st < 1).length + ' affected days of ' + ay.length : 'See details'],
    dkb: [dk.pct != null ? fPct(dk.pct) : fPct(a.dkb), dk.A + ' absent · ' + dk.P + ' present'], sd: [String(sdN), sdN ? 'complaints in raw sheet' : 'No complaint rows in raw sheet'],
  };
}
function secAgent() {
  const a = cur();
  if (!a) {
    const R = ranked();
    return head('My Performance', 'Pick your name to see your KPI scorecard, day-wise CFS and day-wise AHT.') +
      `<div class="pick">${R.map((x, i) => `<button class="card-link reveal" style="--i:${Math.min(i, 14)}" data-pick="${esc(x.id)}">${avatar(x, 44)}<span><b>${esc(x.name)}</b><small>#${i + 1} · Score ${fNum(x.final, 2)} · ${esc(x.cat || '')}</small></span></button>`).join('')}</div>`;
  }
  if (S.sub) return detailPage(a);
  const days = S.data.days, rk = rankOf(a);
  const circ = 2 * Math.PI * 44, pg = Math.max(0, Math.min(1, (a.final || 0) / 4));
  const cfsScore = days.map((_, i) => { const c = (a.csatDay || [])[i] || 0, d = (a.dsatDay || [])[i] || 0; return c + d > 0 ? +(c / (c + d) * 100).toFixed(1) : null; });
  const rows = days.map((d, i) => ({ d, i, att: (a.cal || [])[i], calls: (a.calls || [])[i], aht: (a.ahtDay || [])[i], c: (a.csatDay || [])[i] || 0, s: (a.dsatDay || [])[i] || 0, sc: cfsScore[i] })).filter((r) => isN(r.aht) || r.c + r.s > 0 || r.calls > 0 || r.att === 'p' || r.att === 'a');
  const ds = drillStats(a);
  return `
  <div class="card hero reveal">${avatar(a, 128, 'big')}<div class="ring"><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="44" fill="none" stroke-width="9"/><circle class="pg" cx="50" cy="50" r="44" fill="none" stroke-width="9" style="--c:${(circ * pg).toFixed(1)}px"/></svg><div><b>${fNum(a.final, 2)}</b><small>Final score</small></div></div>
    <div><h2>${esc(a.name)}</h2><div class="meta"><span>ID ${esc(a.id)}</span>${a.vdi ? `<span>${esc(a.vdi)}</span>` : ''}<span>TL: ${esc(a.tl)}</span><span>Rank #${rk} of ${A().length}</span></div><div class="meta"><span>Roster ${a.roster ?? '—'} days</span><span>Present ${a.present ?? '—'}</span><span>Absent ${a.absent ?? '—'}</span><span>${esc(a.elig || '')}</span></div></div>
    <div class="side-r"><div class="grade">${esc(a.cat || '—')}</div></div></div>
  <div class="card reveal" style="--i:1"><h3>Breakdown & reasons</h3><div class="sub">Click any tile to see the exact calls, dates and reasons behind the number. Figures come from the raw sheets.</div>
    <div class="drill">${DRILL.map((d) => `<button data-sub="${d.k}"><small>${esc(d.t)}</small><b class="num">${ds[d.k][0]}</b><span>${esc(ds[d.k][1])}</span></button>`).join('')}</div></div>
  ${kpiCards(a)}
  <div class="grid g-2">
    <div class="card reveal" style="--i:2"><h3>Day-wise CFS score</h3><div class="sub">Monthly: ${fNum(a.csatCnt, 0)} CSAT, ${fNum(a.dsatCnt, 0)} DSAT, ${fPct(a.csat)} score</div>${chart({ labels: days, series: [{ name: 'CFS score %', vals: cfsScore, color: 'var(--sky)' }], target: 93, tl: 'Target 93%', yf: (v) => Math.round(v) + '%', tf: (v) => v.toFixed(1) + '%', aria: 'Day wise CFS score' })}</div>
    <div class="card reveal" style="--i:3"><h3>Day-wise AHT</h3><div class="sub">Monthly: ${fSec(a.aht)} · staff time ${fDur(a.ahtStaff)} · AUX ${fDur(a.ahtAux)}</div>${chart({ labels: days, series: [{ name: 'AHT (s)', vals: a.ahtDay || [] }], target: TARGET_AHT, tl: 'Target 180s', yf: (v) => Math.round(v), tf: (v) => Math.round(v) + ' s', aria: 'Day wise AHT' })}</div>
  </div>
  <div class="card reveal" style="--i:4"><h3>Attendance</h3><div class="sub">Green present, red absent, grey day off</div><div class="cal">${days.map((d, i) => { const s = (a.cal || [])[i]; return `<div class="${s || ''}"><b>${d}</b>${s === 'p' ? 'Present' : s === 'a' ? 'Absent' : s === 'o' ? 'Off' : '–'}</div>`; }).join('')}</div></div>
  <div class="card reveal" style="--i:5"><h3>Day-by-day record</h3><div class="sub">CFS, AHT and calls for each working day</div>
    <div class="tbl-wrap"><table><thead><tr><th>Day</th><th>Status</th><th class="r">Calls</th><th class="r">AHT</th><th class="r">CSAT</th><th class="r">DSAT</th><th class="r">CFS score</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="num"><b>${r.d}</b></td><td>${r.att === 'p' ? pill('good', 'Present') : r.att === 'a' ? pill('bad', 'Absent') : pill('mute', 'Off')}</td><td class="r num">${r.calls || '—'}</td><td class="r num">${isN(r.aht) ? pill(ahtStat(r.aht, TARGET_AHT), Math.round(r.aht) + ' s') : '—'}</td><td class="r num">${r.c || '—'}</td><td class="r num">${r.s || '—'}</td><td class="r num">${isN(r.sc) ? pill(csatStat(r.sc / 100, TARGET_CSAT), r.sc.toFixed(1) + '%') : '—'}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No daily records yet.</td></tr>'}</tbody></table></div></div>`;
}

/* ----- KPI cards + day-wise breakdown pages (login hours, AHT, CFS, break) ----- */
const dayLbl = (d) => d + ' ' + String(S.data.month || '').slice(0, 3);
const hrs = (f) => (isN(f) ? fDur(Math.round(f * 86400)) : '—');
function rtcOf(a) { const q = qaIn(a, pickMonth(qaMonths(a))), n = q.length, f = q.filter((r) => r.rtc === 'Fail').length; return { n, f, v: n ? 1 - f / n : null }; }
function kpiCards(a) {
  const cards = KPIS.map((k, i) => {
    const st = kStat(a[k.k], k.max), tg = k.t ? fmtBy[k.tf](a[k.t]) : (k.tgt || '—'); const sub = KPI_SUB[k.id];
    const ach = k.id === 'brk' && a.xbrk === 0 ? 'None' : fmtBy[k.f](a[k.v]); const pr = isN(a[k.k]) ? Math.max(0, a[k.k] / k.max * 100) : 0;
    return `<div class="card kcard lift reveal ${sub ? 'click' : ''}" style="--i:${Math.min(i, 12)}" ${sub ? `data-sub="${sub}" role="button" tabindex="0"` : ''}>
      <div class="kc-h"><span>${esc(k.name)}</span>${pill(st, isN(a[k.k]) ? (a[k.k] > 0 ? '+' : '') + fNum(a[k.k], 2) + ' / ' + k.max : kLabel[st])}</div>
      <div class="kc-v num">${ach}</div><div class="bar"><i class="${st}" style="--w:${Math.max(2, pr)}%;--i:${i}"></i></div>
      <div class="kc-f"><span>Target<b>${tg}</b></span><span>Achieved<b>${ach}</b></span></div>${sub ? '<div class="go">View breakdown ›</div>' : '<div class="go mute">&nbsp;</div>'}</div>`;
  });
  const r = rtcOf(a);
  cards.splice(1, 0, `<div class="card kcard lift reveal click" style="--i:1" data-sub="rtc" role="button" tabindex="0"><div class="kc-h"><span>RTC Accuracy</span>${pill(r.v == null ? 'mute' : r.f ? 'warn' : 'good', r.v == null ? 'No data' : r.f + ' failed')}</div>
    <div class="kc-v num">${r.v == null ? '—' : fPct(r.v, 1)}</div><div class="bar"><i class="${r.v == null ? 'mute' : r.f ? 'warn' : 'good'}" style="--w:${r.v == null ? 2 : Math.max(2, r.v * 100)}%"></i></div>
    <div class="kc-f"><span>Target<b>—</b></span><span>Achieved<b>${r.v == null ? '—' : fPct(r.v, 1)}</b></span></div><div class="go">View breakdown ›</div></div>`);
  return `<div class="card reveal" style="--i:2"><h3>KPI scorecard</h3><div class="sub">Every parameter with its target and what ${esc(a.name)} achieved. Total ${fNum(a.total, 3)}, final ${fNum(a.final, 3)}. Click a card for the day-wise or call-wise breakdown.</div><div class="kgrid">${cards.join('')}</div></div>`;
}
const dtable = (heads, rows, empty) => (rows.length ? `<div class="tbl-wrap"><table><thead><tr>${heads.map((h, i) => `<th class="${i ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? 'r' : ''} num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="empty">${esc(empty)}</div>`);
function compPage(a) {
  const R = (a.attRows || []).filter((r) => r.tr != null && r.tr > 0).slice().sort((x, y) => y.d - x.d);
  const rows = R.map((r) => { const c = r.rd != null ? r.rd / r.tr : null; return [fD(r.d) + ' <span class="t-mute">' + fWd(r.d) + '</span>', esc(r.sh || '—'), hrs(r.tr), hrs(r.rd), c == null ? '—' : fPct(c, 1), c == null ? pill('mute', 'No data') : c >= 1 ? pill('good', 'Met') : c >= .95 ? pill('warn', 'Short') : pill('bad', 'Below')]; });
  const tiles = [kvTile('Login hour compliance', fPct(a.comp, 1), 'Month, KPI sheet', a.comp >= 1 ? 'good' : 'warn'), kvTile('Target ready hours', hrs((a.tgtHr || 0) / 86400), 'Month'), kvTile('Ready hours', hrs((a.rdyHr || 0) / 86400), 'Month'), kvTile('Lag time', isN(a.lag) ? fDur(a.lag) : '—', a.lag ? 'Lag recorded' : 'No lag', a.lag ? 'warn' : 'good')];
  return `<div class="grid g-tiles">${tiles.join('')}</div><div class="card reveal"><h3>Day-wise login hour compliance</h3><div class="sub">Ready time against target ready time for each rostered day (Schedule Attendance Raw)</div>${dtable(['Date', 'Shift', 'Target ready', 'Ready time', 'Compliance', 'Status'], rows, 'No day-wise ready-time rows for this agent.')}</div>`;
}
function ahtPage(a) {
  const rows = S.data.days.map((d, i) => [dayLbl(d), (a.ahtDay || [])[i]]).filter((r) => isN(r[1])).map((r) => [r[0], fSec(r[1]) + ' ' + pill({ good: 'good', warn: 'warn', bad: 'bad' }[ahtStat(r[1], TARGET_AHT)], r[1] <= TARGET_AHT ? 'Within target' : 'Above target')]);
  return `<div class="grid g-tiles">${[kvTile('Monthly AHT', fSec(a.aht), 'Target ' + (a.ahtT || '180 s'), ahtStat(a.aht, TARGET_AHT) === 'good' ? 'good' : 'warn')].join('')}</div><div class="card reveal"><h3>Date-wise AHT</h3><div class="sub">Average handling time on each day with calls</div>${dtable(['Date', 'AHT'], rows, 'No AHT data for this agent.')}</div>`;
}
function csatPage(a) {
  const rows = S.data.days.map((d, i) => { const c = (a.csatDay || [])[i] || 0, s = (a.dsatDay || [])[i] || 0; return c + s > 0 ? [dayLbl(d), c / (c + s)] : null; }).filter(Boolean).map((r) => [r[0], fPct(r[1], 1) + ' ' + pill(csatStat(r[1], TARGET_CSAT), r[1] >= TARGET_CSAT ? 'On target' : 'Below target')]);
  return `<div class="grid g-tiles">${[kvTile('Monthly CFS score', fPct(a.csat, 1), 'Target ' + (a.csatT ? fPct(a.csatT, 0) : '93%'), a.csat >= TARGET_CSAT ? 'good' : 'warn')].join('')}</div><div class="card reveal"><h3>Date-wise CFS score</h3><div class="sub">Only days that had survey responses</div>${dtable(['Date', 'CFS score'], rows, 'No CFS responses for this agent.')}</div>`;
}
function brkPage(a) {
  const R = (a.attRows || []).filter((r) => r.bk != null && r.tb != null && r.bk > r.tb + 1 / 86400).slice().sort((x, y) => y.d - x.d);
  const rows = R.map((r) => [fD(r.d) + ' <span class="t-mute">' + fWd(r.d) + '</span>', esc(r.sh || '—'), hrs(r.tb), hrs(r.bk), pill('bad', '+' + hrs(r.bk - r.tb))]);
  const tot = sum(R.map((r) => r.bk - r.tb));
  return `<div class="grid g-tiles">${[kvTile('Extra break (month)', a.xbrk ? fDur(a.xbrk) : 'None', 'KPI sheet', a.xbrk ? 'bad' : 'good'), kvTile('Days with extra break', R.length, 'Dates listed below', R.length ? 'warn' : 'good'), kvTile('Extra break from daily rows', R.length ? hrs(tot) : 'None', 'Sum of the days below', R.length ? 'warn' : 'good')].join('')}</div><div class="card reveal"><h3>Dates with extra break</h3><div class="sub">Break taken above the target break for the shift</div>${dtable(['Date', 'Shift', 'Target break', 'Break taken', 'Extra'], rows, 'No extra break on any day. Well done.')}</div>`;
}

/* ---------- detail pages (CE, NCE, Empathy, RTC, Attendance, DKB, SD) ---------- */
const SUB_TITLE = { ce: 'Critical Error (CE) breakdown', nce: 'Non-Critical Error (NCE) breakdown', emp: 'Empathy breakdown', rtc: 'RTC accuracy breakdown', att: 'Attendance breakdown', dkb: 'DKB attendance', dkbabs: 'DKB absent details', sd: 'Service delivery complaints', comp: 'Login hour compliance breakdown', aht: 'AHT breakdown', csat: 'CFS (CSAT) breakdown', brk: 'Break time and extra break' };
function detailPage(a) {
  const k = S.sub;
  const back = `<div class="crumb reveal"><button class="btn" data-sub=""><svg><use href="#i-back"/></svg>My Performance</button>${k === 'dkbabs' ? '<button class="btn" data-sub="dkb"><svg><use href="#i-back"/></svg>DKB attendance</button>' : ''}<span class="who">${avatar(a, 34)}<b>${esc(a.name)}</b><span class="t-mute">ID ${esc(a.id)}</span></span></div>`;
  const body = k === 'att' ? attPage(a) : k === 'dkb' ? dkbPage(a) : k === 'dkbabs' ? dkbAbsPage(a) : k === 'sd' ? sdPage(a) : k === 'comp' ? compPage(a) : k === 'aht' ? ahtPage(a) : k === 'csat' ? csatPage(a) : k === 'brk' ? brkPage(a) : qBlock(k, a, true);
  return `${back}<div class="sec-h reveal"><div><h1>${SUB_TITLE[k]}</h1><p>${esc(a.name)}, ${esc(S.data.month || '')}. Only this agent's rows from the uploaded workbook are shown.</p></div></div>${body}`;
}
const monthSel = (months, m, id = 'monthSel') => (months.length > 1 ? `<div class="field"><label for="${id}">Month</label><select id="${id}">${months.map((x) => `<option value="${x}" ${x === m ? 'selected' : ''}>${esc(monName(x))}</option>`).join('')}</select></div>` : (months.length ? `<span class="chip">${esc(monName(months[0]))}</span>` : ''));
const kvTile = (l, v, sub, st = 'brand', extra = '') => `<div class="card tile lift reveal ${extra}"><span class="l">${esc(l)}</span><span class="v num">${v}</span><span class="s">${st ? pill(st, st === 'good' ? 'OK' : st === 'bad' ? 'Review' : st === 'warn' ? 'Watch' : 'Info') : ''}${esc(sub || '')}</span></div>`;

/* ----- quality (CE / NCE / Empathy / RTC) ----- */
const QK = {
  ce: { rows: (q) => q.filter((r) => r.ce === 'Fail'), status: () => pill('bad', 'CE'), reason: (r) => r.ceTxt || r.rem || '—', hdr: 'CE reason' },
  nce: { rows: (q) => q.filter((r) => r.nceTxt), status: () => pill('warn', 'NCE'), reason: (r) => r.nceTxt, hdr: 'NCE reason' },
  emp: { rows: (q) => q.filter((r) => r.ef > 0 || (r.emp || []).length), status: () => pill('warn', 'Empathy missing'), reason: (r) => (r.emp || []).map((p) => p.n + (p.c ? ': ' + p.c : '')).join(' | ') || '—', hdr: 'Empathy failure' },
  rtc: { rows: (q) => q.filter((r) => r.rtc === 'Fail'), status: () => pill('bad', 'RTC fail'), reason: (r) => (r.rt && r.rt.c ? r.rt.c : '—'), hdr: 'RTC failure' },
};
const paramTags = (r, kind) => { const list = kind === 'emp' ? r.emp : kind === 'rtc' ? (r.fp || []).filter((p) => /^7\./.test(p.n)) : (r.fp || []); return list.length ? list.map((p) => `<span class="ptag">${esc(p.n)}</span>`).join('') : '<span class="t-mute">—</span>'; };
function qFiltered(kind, a, m) {
  const st = S.dq[kind] || (S.dq[kind] = { q: '', from: '', to: '' });
  let rows = QK[kind].rows(qaIn(a, m));
  if (st.from) rows = rows.filter((r) => r.t != null && isoS(r.t) >= st.from);
  if (st.to) rows = rows.filter((r) => r.t != null && isoS(r.t) <= st.to);
  if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => [r.ani, r.cid, r.tl, r.auditor, r.topic, r.ceTxt, r.nceTxt, r.rem, r.cm, ...(r.fp || []).map((p) => p.n + ' ' + p.c)].join(' ').toLowerCase().includes(q)); }
  return rows;
}
function qTable(kind, a, m) {
  const rows = qFiltered(kind, a, m); const K = QK[kind];
  if (!rows.length) return `<div class="empty">No matching ${kind.toUpperCase()} records${m ? ' for ' + esc(monName(m)) : ''}.</div>`;
  const colsHead = ['Call number', 'Date', 'Time', 'Agent', 'EID', 'Status', ...(kind === 'ce' || kind === 'nce' ? ['Topic'] : []), K.hdr, 'Failed parameters', 'Team leader', 'Auditor'];
  return `<div class="tbl-wrap wrapcells"><table><thead><tr>${colsHead.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="ex" data-ex="${i}" title="Click for full audit details"><td class="num">${esc(r.ani || '—')}</td><td>${fD(r.t)}</td><td class="num">${fT(r.t)}</td><td style="white-space:nowrap">${nameHTML(a, 22)}</td><td class="num">${esc(a.id)}</td><td>${K.status(r)}</td>${kind === 'ce' || kind === 'nce' ? `<td>${esc(r.topic || '—')}</td>` : ''}<td style="min-width:380px">${esc(K.reason(r))}</td><td>${paramTags(r, kind)}</td><td>${esc(r.tl || a.tl || '—')}</td><td>${esc(r.auditor || '—')}</td></tr>
    <tr class="dt" hidden><td colspan="${colsHead.length}"><dl><dt>Call ID</dt><dd>${esc(r.cid || '—')}</dd><dt>Form · Score</dt><dd>${esc(r.form || '—')} · ${fNum(r.score, 0)} (${esc(r.pf || '—')})</dd><dt>Contact / Eval date</dt><dd>${esc(r.cd || '—')} / ${esc(r.ed || '—')}</dd><dt>QA · Audit party</dt><dd>${esc(r.qa || '—')} · ${esc(r.party || '—')}</dd><dt>Critical error</dt><dd>${esc(r.ce || '—')}${r.topic ? ' · ' + esc(r.topic) : ''}</dd><dt>CE reason</dt><dd>${esc(r.ceTxt || '—')}</dd><dt>NCE reason</dt><dd>${esc(r.nceTxt || '—')}</dd><dt>Failed parameters</dt><dd>${(r.fp || []).length ? (r.fp || []).map((p) => `<b>${esc(p.n)}</b>${p.c ? `<span class="pcm">${esc(p.c)}</span>` : ''}`).join('<br>') : '—'}</dd><dt>Empathy params</dt><dd>${esc(r.ep)} pass · ${esc(r.ef)} fail</dd><dt>RTC</dt><dd>${esc(r.rtc || '—')}${r.rt && r.rt.c ? ' · ' + esc(r.rt.c) : ''}</dd><dt>Audit comments</dt><dd>${esc(r.cm || '—')}</dd></dl></td></tr>`).join('')}</tbody></table></div>`;
}
function qBlock(kind, a, page) {
  const months = qaMonths(a); const m = pickMonth(months); S.qctx = { kind, id: a.id, m };
  const all = qaIn(a, m), n = all.length, K = QK[kind];
  const ce = all.filter((r) => r.ce === 'Fail').length, nce = all.filter((r) => r.nceTxt).length, rtcF = all.filter((r) => r.rtc === 'Fail').length;
  const empMiss = all.filter((r) => r.ef > 0 || (r.emp || []).length).length, ep = sum(all.map((r) => r.ep)), ef = sum(all.map((r) => r.ef));
  const kpiV = { ce: a.ce, nce: null, emp: a.emp, rtc: null }[kind];
  let tiles2;
  if (kind === 'ce') tiles2 = [kvTile('Audited calls', n, 'in ' + (m ? monName(m) : 'raw sheet')), kvTile('CE calls', ce, 'Critical errors', ce ? 'bad' : 'good'), kvTile('CE %', n ? fPct(ce / n) : '—', 'CE calls ÷ audited calls', ce ? 'bad' : 'good'), kvTile('CE % on KPI sheet', fPct(kpiV), 'Value used for KPI marks', 'brand')];
  else if (kind === 'nce') tiles2 = [kvTile('Audited calls', n, 'in ' + (m ? monName(m) : 'raw sheet')), kvTile('NCE calls', nce, 'Calls with a non-critical error', nce ? 'warn' : 'good'), kvTile('NCE %', n ? fPct(nce / n) : '—', 'NCE calls ÷ audited calls', nce ? 'warn' : 'good'), kvTile('CE calls', ce, 'Shown separately', 'brand')];
  else if (kind === 'emp') tiles2 = [kvTile('Audited calls', n, 'in ' + (m ? monName(m) : 'raw sheet')), kvTile('Calls with empathy missing', empMiss, 'At least one empathy parameter failed', empMiss ? 'warn' : 'good'), kvTile('Empathy compliance', ep + ef ? fPct(ep / (ep + ef)) : '—', ep + ' pass · ' + ef + ' fail parameters', 'brand'), kvTile('Empathy on KPI sheet', fPct(kpiV), 'Value used for KPI marks', 'brand')];
  else tiles2 = [kvTile('Audited calls', n, 'in ' + (m ? monName(m) : 'raw sheet')), kvTile('RTC failures', rtcF, 'Calls where RTC failed', rtcF ? 'bad' : 'good'), kvTile('RTC accuracy', n ? fPct(1 - rtcF / n) : '—', 'Passed ÷ audited calls', rtcF ? 'warn' : 'good')];
  /* breakdown chart: topics for CE, failed parameters for the rest */
  const rowsAll = K.rows(all); const cnt = {};
  rowsAll.forEach((r) => { if (kind === 'ce') { const t = r.topic || 'No topic recorded'; cnt[t] = (cnt[t] || 0) + 1; } else (kind === 'emp' ? r.emp : kind === 'rtc' ? (r.fp || []).filter((p) => /^7\./.test(p.n)) : (r.fp || [])).forEach((p) => { cnt[p.n] = (cnt[p.n] || 0) + 1; }); });
  const bd = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([l, v]) => ({ l, v, st: kind === 'ce' ? 'bad' : 'warn' }));
  const st = S.dq[kind] || (S.dq[kind] = { q: '', from: '', to: '' });
  const noAudit = !months.length;
  const banner = noAudit ? `<div class="banner warn reveal">No audited calls were found for this agent in the "CE & NCE & RTC Raw" sheet, so there are no ${kind.toUpperCase()} records to list. The KPI sheet value is shown above where available.</div>` : (m !== S.data.ym ? `<div class="banner warn reveal">The "CE & NCE & RTC Raw" sheet has no audits for ${esc(S.data.month || 'the KPI month')}. Showing ${esc(monName(m))}, the latest month in that sheet. Paste the latest audits into the raw sheet and upload again to update this.</div>` : '');
  return `${banner}<div class="grid g-tiles">${tiles2.join('')}</div>
  ${bd.length ? `<div class="card reveal"><h3>${kind === 'ce' ? 'CE by topic' : 'Failed parameters'}</h3><div class="sub">${kind === 'ce' ? 'Which topics the critical errors came from' : 'Which audit parameters failed most often'}</div>${barList(bd, { f: (v) => v + ' call' + (v === 1 ? '' : 's') })}</div>` : ''}
  <div class="card reveal"><h3>${kind.toUpperCase()} calls</h3><div class="sub">Click a row for the full audit record, including comments and every failed parameter.</div>
    <div class="dtools">${monthSel(months, m)}<div class="field"><label for="dq-q">Search</label><input id="dq-q" data-dq="q" type="search" placeholder="Number, topic, reason…" value="${esc(st.q)}"></div><div class="field"><label for="dq-f">From</label><input id="dq-f" data-dq="from" type="date" value="${esc(st.from)}"></div><div class="field"><label for="dq-t">To</label><input id="dq-t" data-dq="to" type="date" value="${esc(st.to)}"></div><button class="btn sm" data-dqreset>Clear</button></div>
    <div id="dqBody">${qTable(kind, a, m)}</div></div>`;
}

/* ----- attendance ----- */
const shiftMin = (sh) => { const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(String(sh || '')); return m ? { s: +m[1] * 60 + +m[2], e: +m[3] * 60 + +m[4] } : null; };
const fHHMM = (min) => pad(Math.floor(min / 60) % 24) + ':' + pad(min % 60);
function attInfo(r) {
  const t = shiftMin(r.sh); let late = null, early = null, reqIn = null, reqOut = null;
  if (t) { reqIn = r.d + t.s / 1440; reqOut = r.d + (t.e <= t.s ? t.e + 1440 : t.e) / 1440; if (r.li != null) late = (r.li - reqIn) * 1440; if (r.lo != null) early = (reqOut - r.lo) * 1440; }
  const why = [];
  if (r.st < 1) {
    if (r.li == null) why.push('No login punch'); if (r.lo == null) why.push('No logout punch');
    if (late != null && late > .5) why.push('Logged in ' + fMin(late) + ' after shift start');
    if (early != null && early > .5) why.push('Logged out ' + fMin(early) + ' before shift end');
    if (!why.length) why.push(r.st === 0 ? 'No attendance credit recorded' : 'Partial credit (0.5) recorded; punches look on time');
  }
  return { t, late, early, why };
}
function attPage(a) {
  const all = a.attRows || []; const months = [...new Set(all.map((r) => ymS(r.d)))].sort().reverse(); const m = pickMonth(months);
  const rows = all.filter((r) => ymS(r.d) === m); const info = rows.map(attInfo);
  const n = rows.length, full = rows.filter((r) => r.st >= 1).length, part = rows.filter((r) => r.st > 0 && r.st < 1).length, zero = rows.filter((r) => r.st === 0).length;
  const pct = n ? sum(rows.map((r) => r.st)) / n : null;
  const noIn = rows.filter((r) => r.li == null).length, noOut = rows.filter((r) => r.lo == null).length;
  const only = S.att.only && (part + zero) > 0;
  const shown = rows.map((r, i) => ({ r, i: info[i] })).filter((x) => !only || x.r.st < 1);
  return `<div class="grid g-tiles">${[kvTile('Monthly attendance', pct != null ? fPct(pct) : fPct(a.adh), 'Sum of Login Logout State ÷ roster days', pct >= .95 ? 'good' : 'warn'), kvTile('Attendance on KPI sheet', fPct(a.adh), 'Schedule adherence KPI', 'brand'), kvTile('Total records', n, 'Rostered days in ' + (m ? monName(m) : '—')), kvTile('Full attendance (1)', full, '', 'good'), kvTile('Partial (0.5)', part, 'Login or logout failure', part ? 'warn' : 'good'), kvTile('No credit (0)', zero, 'Missed login and logout', zero ? 'bad' : 'good'), kvTile('Missed login', noIn, 'No login punch'), kvTile('Missed logout', noOut, 'No logout punch')].join('')}</div>
  <div class="banner info reveal">Login Logout State is read straight from the sheet: 1 = attendance OK, 0.5 = partial credit because of a login or logout failure, 0 = no credit. The grace-period rule that decides 0.5 is not stored in the workbook, so the reasons below are measured from the actual punches against the scheduled shift.</div>
  <div class="card reveal"><h3>Attendance records</h3><div class="sub">${only ? 'Only the days that lost credit.' : 'Every rostered day.'} Highlighted rows reduced the percentage.</div>
    <div class="dtools">${monthSel(months, m)}<label class="field" style="cursor:pointer"><input type="checkbox" id="attOnly" ${S.att.only ? 'checked' : ''}><label for="attOnly" style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink)">Only affected days</label></label></div>
    ${shown.length ? `<div class="tbl-wrap wrapcells"><table><thead><tr><th>Date</th><th>Scheduled shift</th><th>Required login</th><th>Actual login</th><th>Required logout</th><th>Actual logout</th><th>State</th><th>Status</th><th>Reason</th></tr></thead><tbody>${shown.map(({ r, i }) => `<tr class="${r.st < 1 ? 'rowAff' : ''}"><td class="num">${fD(r.d)} <span class="t-mute">${fWd(r.d)}</span></td><td class="num">${esc(r.sh || '—')}</td><td class="num">${i.t ? fHHMM(i.t.s) : '—'}</td><td class="num">${r.li != null ? fHM(r.li) : '—'}${i.late != null && i.late > .5 ? ` <span class="t-bad">(+${fMin(i.late)})</span>` : ''}</td><td class="num">${i.t ? fHHMM(i.t.e) : '—'}</td><td class="num">${r.lo != null ? fHM(r.lo) : '—'}${i.early != null && i.early > .5 ? ` <span class="t-bad">(−${fMin(i.early)})</span>` : ''}</td><td class="num"><b>${r.st}</b></td><td>${r.st >= 1 ? pill('good', 'Full') : r.st > 0 ? pill('warn', 'Partial') : pill('bad', 'No credit')}</td><td style="min-width:240px">${r.st < 1 ? esc(i.why.join(' · ')) : '<span class="t-mute">—</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No affected days. Full attendance this month.</div>'}</div>`;
}

/* ----- DKB attendance ----- */
const dkbRowsM = (a, m) => (a.dkbRows || []).filter((r) => ymS(r.d) === m);
const dkbMonths = (a) => [...new Set((a.dkbRows || []).map((r) => ymS(r.d)))].sort().reverse();
function dkbPage(a) {
  const months = dkbMonths(a), m = pickMonth(months); const rows = dkbRowsM(a, m);
  const P = rows.filter((r) => r.s === 'P').length, Ab = rows.filter((r) => r.s === 'A').length, oth = rows.length - P - Ab; const pct = P + Ab ? P / (P + Ab) : null;
  const map = new Map(rows.map((r) => [r.d, r])); const [y, mo] = (m || S.data.ym).split('-').map(Number); const first = new Date(Date.UTC(y, mo - 1, 1)), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const base = Math.floor((first.getTime() - EPOCH) / 864e5);
  const cells = []; for (let i = 0; i < first.getUTCDay(); i++) cells.push('<div class="c e"></div>');
  for (let d = 1; d <= dim; d++) { const r = map.get(base + d - 1); const cl = !r ? '' : r.s === 'P' ? 'P' : r.s === 'A' ? 'A' : 'X'; cells.push(`<div class="c ${cl}"><b>${d}</b>${!r ? '·' : r.s === 'P' ? 'Present' : r.s === 'A' ? 'Absent' : esc(r.s)}</div>`); }
  const diff = isN(a.dkb) && pct != null && Math.abs(a.dkb - pct) > .005;
  return `<div class="grid g-tiles">${[kvTile('DKB attendance', pct != null ? fPct(pct) : '—', 'Present ÷ (Present + Absent)', pct == null ? 'mute' : dkbStat(pct)[0]), kvTile('Scheduled days', P + Ab, monName(m)), kvTile('Present days', P, '', 'good')].join('')}
    <div class="card tile lift reveal click" data-sub="dkbabs" role="button" tabindex="0"><span class="l">Absent days</span><span class="v num t-bad">${Ab}</span><span class="s">${pill(Ab ? 'bad' : 'good', Ab ? 'Click for dates' : 'None')}View absent details ›</span></div>${oth ? kvTile('Other status', oth, '') : ''}</div>
  ${diff ? `<div class="banner warn reveal">The KPI sheet shows DKB ${fPct(a.dkb)} for this agent, but the daily "dkb attedance raw" sheet gives ${fPct(pct)}. This page uses the raw daily data. The KPI figure comes from the report labelled "${esc((S.data.notes && S.data.notes.dkb) || 'DKB report')}".</div>` : ''}
  <div class="grid g-2"><div class="card reveal"><h3>Calendar view</h3><div class="sub">Green present, red absent, neutral no record</div><div class="dtools">${monthSel(months, m)}</div><div class="dkcal">${WD.map((w) => `<div class="h">${w}</div>`).join('')}${cells.join('')}</div><div class="legend2"><span><i style="background:var(--good-soft)"></i>Present</span><span><i style="background:var(--bad-soft)"></i>Absent</span><span><i style="background:var(--warn-soft)"></i>Other</span></div></div>
  <div class="card reveal"><h3>Daily record</h3><div class="sub">Every day in the DKB attendance raw sheet</div>${dkbTable(a, rows)}</div></div>`;
}
function dkbTable(a, rows) {
  if (!rows.length) return '<div class="empty">No DKB rows for this month.</div>';
  return `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Agent</th><th>EID</th><th>Status</th><th>LOB</th><th>Role</th><th>Category</th><th>Team leader</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.s === 'A' ? 'rowAbs' : ''}"><td class="num">${fD(r.d)} <span class="t-mute">${fWd(r.d)}</span></td><td>${nameHTML(a, 22)}</td><td class="num">${esc(a.id)}</td><td>${r.s === 'P' ? pill('good', 'Present') : r.s === 'A' ? pill('bad', 'Absent') : pill('mute', r.s || '—')}</td><td>${esc(r.lob || '—')}</td><td>${esc(r.role || '—')}</td><td>${esc(r.cat || '—')}</td><td>${esc(r.tl || '—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function dkbAbsPage(a) {
  const months = dkbMonths(a), m = pickMonth(months); const rows = dkbRowsM(a, m).filter((r) => r.s === 'A');
  return `<div class="grid g-tiles">${kvTile('Absent days', rows.length, monName(m), rows.length ? 'bad' : 'good')}</div>
  <div class="card reveal"><h3>Absent dates</h3><div class="sub">Exact days marked Absent in the DKB attendance raw sheet</div><div class="dtools">${monthSel(months, m)}</div>${rows.length ? dkbTable(a, rows) : '<div class="empty">No absent days this month.</div>'}</div>`;
}

/* ----- service delivery ----- */
const sdVal = (v) => (/^valid$/i.test(v) ? pill('bad', 'Valid') : /^invalid$/i.test(v) ? pill('good', 'Invalid') : pill('mute', v || '—'));
function sdPage(a) {
  const all = a.sdRows || []; const ym = (r) => (/^\d{4}-\d{2}/.test(r.rcv) ? r.rcv.slice(0, 7) : '');
  const months = [...new Set(all.map(ym).filter(Boolean))].sort().reverse(); const m = pickMonth(months);
  const rows0 = all.filter((r) => !m || ym(r) === m); const st = S.dq.sd || (S.dq.sd = { q: '', val: '' });
  let rows = rows0.filter((r) => !st.val || (st.val === 'other' ? !/^(valid|invalid)$/i.test(r.val) : r.val.toLowerCase() === st.val));
  if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => [r.cust, r.topic, r.fl, r.cm, r.find, r.sts].join(' ').toLowerCase().includes(q)); }
  S.qctx = { kind: 'sd', id: a.id, m };
  const v = rows0.filter((r) => /^valid$/i.test(r.val)).length, iv = rows0.filter((r) => /^invalid$/i.test(r.val)).length;
  const cnt = {}; rows0.forEach((r) => { const t = r.topic || 'No topic'; cnt[t] = (cnt[t] || 0) + 1; });
  const bd = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([l, n]) => ({ l, v: n, st: 'warn' }));
  const banner = !all.length ? `<div class="banner warn reveal">No complaint rows for this agent were found in the "Service Delivery Raw" sheet (matched by EID, then by VDI ID). The KPI sheet shows SD = ${fNum(a.sd, 2)}.</div>` : '';
  return `${banner}<div class="grid g-tiles">${[kvTile('SD on KPI sheet', fNum(a.sd, 2), 'Marks ' + fNum(a.sdK, 3), 'brand'), kvTile('Complaints in raw sheet', rows0.length, m ? monName(m) : '', rows0.length ? 'warn' : 'good'), kvTile('Valid', v, 'Confirmed complaints', v ? 'bad' : 'good'), kvTile('Invalid', iv, '', 'good')].join('')}</div>
  ${bd.length ? `<div class="card reveal"><h3>Complaints by topic</h3><div class="sub">Which topics the service delivery complaints were about</div>${barList(bd, { f: (x) => x + ' complaint' + (x === 1 ? '' : 's') })}</div>` : ''}
  <div class="card reveal"><h3>Service delivery complaints</h3><div class="sub">Click a row for the full complaint text, findings, root cause and action taken.</div>
    <div class="dtools">${monthSel(months, m)}<div class="field"><label for="sd-v">Validation</label><select id="sd-v" data-dq="val"><option value="">All</option><option value="valid" ${st.val === 'valid' ? 'selected' : ''}>Valid</option><option value="invalid" ${st.val === 'invalid' ? 'selected' : ''}>Invalid</option><option value="other" ${st.val === 'other' ? 'selected' : ''}>Other (withdrawn…)</option></select></div><div class="field"><label for="dq-q">Search</label><input id="dq-q" data-dq="q" type="search" placeholder="Number, topic, comment…" value="${esc(st.q)}"></div></div>
    <div id="dqBody">${sdTable(a, rows)}</div></div>`;
}
function sdTable(a, rows) {
  if (!rows.length) return '<div class="empty">No matching complaints.</div>';
  const cut = (s, n = 140) => (s.length > n ? s.slice(0, n) + '…' : s);
  return `<div class="tbl-wrap wrapcells"><table><thead><tr><th>Customer number</th><th>Complaint received</th><th>Topic</th><th>Validation</th><th>Agent</th><th>EID</th><th>Team leader</th><th>Tenure (days)</th><th>Frontliner's comment</th><th>Complaint mgt. agent's comment</th><th>Incident findings</th></tr></thead><tbody>${rows.map((r) => `<tr class="ex" data-ex="1" title="Click for full text"><td class="num">${esc(r.cust || '—')}</td><td class="num">${esc(r.rcv || '—')}</td><td>${esc(r.topic || '—')}</td><td>${sdVal(r.val)}</td><td>${nameHTML(a, 22)}</td><td class="num">${esc(a.id)}</td><td>${esc(r.tl || '—')}</td><td class="num">${esc(r.ten || '—')}</td><td>${esc(cut(r.fl))}</td><td>${esc(cut(r.cm))}</td><td>${esc(cut(r.find))}</td></tr>
  <tr class="dt" hidden><td colspan="11"><dl><dt>STS ticket</dt><dd>${esc(r.sts || '—')}</dd><dt>Incident date</dt><dd>${r.inc != null ? fD(r.inc) : '—'}</dd><dt>Complaint against</dt><dd>${esc(r.against || '—')}</dd><dt>Error by</dt><dd>${esc(r.by || '—')}</dd><dt>Gap category</dt><dd>${esc([r.cat, r.sub].filter(Boolean).join(' › ') || '—')}</dd><dt>Root cause</dt><dd>${esc(r.root || '—')}</dd><dt>Action taken</dt><dd>${esc(r.act || '—')}</dd><dt>Skill · Site</dt><dd>${esc(r.skill || '—')} · ${esc(r.site || '—')}</dd><dt>Frontliner's comment</dt><dd style="white-space:pre-wrap">${esc(r.fl || '—')}</dd><dt>Complaint mgt. agent's comment</dt><dd style="white-space:pre-wrap">${esc(r.cm || '—')}</dd><dt>Incident findings</dt><dd style="white-space:pre-wrap">${esc(r.find || '—')}</dd></dl></td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- Audit Details (CE / NCE per agent, with full breakdown for a selected agent) ---------- */
function secAudit() {
  const L = scope(), c = cur(); const G = L;
  const row = (a) => { const m = pickMonth(qaMonths(a)), q = qaIn(a, m), n = q.length; const ce = q.filter((r) => r.ce === 'Fail').length, nce = q.filter((r) => r.nceTxt).length; return { n, ce, nce, ep: sum(q.map((r) => r.ep)), ef: sum(q.map((r) => r.ef)), m }; };
  const R = G.map((a) => Object.assign({ a }, row(a)));
  const tot = sum(R.map((x) => x.n)), ceT = sum(R.map((x) => x.ce)), nceT = sum(R.map((x) => x.nce));
  const months = [...new Set(R.map((x) => x.m).filter(Boolean))];
  const tabs = c ? ['ce', 'nce', 'emp', 'rtc'] : [];
  const tab = tabs.includes(S.atab) ? S.atab : 'ce';
  const banner = months.length && !months.includes(S.data.ym) ? `<div class="banner warn reveal">The "CE & NCE & RTC Raw" sheet only holds audits for ${esc(months.map(monName).join(', '))}. The KPI sheet month is ${esc(S.data.month)}. Add the newest audits to the raw sheet and upload again.</div>` : '';
  return head('Audit Details', 'CE % and NCE % per agent from the raw audit sheet. Click a percentage to see the exact calls, topics and reasons.') + noteStamp('audit') + banner +
    `<div class="grid g-tiles">${[kvTile('Audited calls', tot, months.map(monName).join(', ')), kvTile('CE calls', ceT, tot ? fPct(ceT / tot) + ' of audits' : '', ceT ? 'bad' : 'good'), kvTile('NCE calls', nceT, tot ? fPct(nceT / tot) + ' of audits' : '', nceT ? 'warn' : 'good'), kvTile('Agents audited', R.filter((x) => x.n).length, 'of ' + R.length)].join('')}</div>
    <div class="card reveal" style="--i:4"><h3>CE % and NCE % by agent</h3><div class="sub">CE % = CE calls ÷ audited calls. NCE % = calls with a non-critical error ÷ audited calls. Click a percentage to open the breakdown.</div>${table('audit', [
      nameCol(), col('Audits', (x) => x.n, { r: 1, s: (x) => x.n, x: (x) => x.n }),
      col('CE calls', (x) => (x.ce ? `<span class="t-bad">${x.ce}</span>` : 0), { r: 1, s: (x) => x.ce, x: (x) => x.ce }),
      col('CE %', (x) => (x.n ? openBtn('ce', x.a, pill(x.ce ? 'bad' : 'good', fPct(x.ce / x.n))) : '—'), { r: 1, s: (x) => (x.n ? x.ce / x.n : null), x: (x) => (x.n ? x.ce / x.n : '') }),
      col('NCE calls', (x) => x.nce, { r: 1, s: (x) => x.nce, x: (x) => x.nce }),
      col('NCE %', (x) => (x.n ? openBtn('nce', x.a, pill(x.nce / x.n > .3 ? 'bad' : x.nce ? 'warn' : 'good', fPct(x.nce / x.n))) : '—'), { r: 1, s: (x) => (x.n ? x.nce / x.n : null), x: (x) => (x.n ? x.nce / x.n : '') }),
      col('Empathy', (x) => (x.ep + x.ef ? openBtn('emp', x.a, pill(x.ep / (x.ep + x.ef) >= .9 ? 'good' : x.ep / (x.ep + x.ef) >= .85 ? 'warn' : 'bad', fPct(x.ep / (x.ep + x.ef)))) : '—'), { r: 1, s: (x) => (x.ep + x.ef ? x.ep / (x.ep + x.ef) : null), x: (x) => (x.ep + x.ef ? x.ep / (x.ep + x.ef) : '') }),
      col('CE % on KPI sheet', (x) => fPct(x.a.ce), { r: 1, s: (x) => x.a.ce, x: (x) => x.a.ce }),
    ], R.map((x) => Object.assign(x, { id: x.a.id, name: x.a.name })), { sort: 0, dir: 'asc' })}</div>` +
    (c ? `<div class="card reveal" style="--i:5"><h3>${nameHTML(c, 34)}: full CE / NCE breakdown</h3><div class="sub">Every call with its topic and reason. Pick a tab.</div><div class="tabs">${tabs.map((t) => `<button class="tab ${t === tab ? 'on' : ''}" data-atab="${t}">${{ ce: 'CE', nce: 'NCE', emp: 'Empathy', rtc: 'RTC' }[t]}</button>`).join('')}</div>${qBlock(tab, c, false)}</div>` : `<div class="banner info reveal">Choose an agent from the Agent menu at the top to see that agent's full CE / NCE breakdown with reasons below this table.</div>`);
}
function secEmp() {
  const L = scope(), R = L.filter((a) => isN(a.emp)).sort((a, b) => b.emp - a.emp);
  const meet = R.filter((a) => a.emp >= (a.empT || .9)).length;
  return head('Parameter Empathy', 'Empathy score of each agent against the 90% target.') + noteStamp('audit') +
    `<div class="grid g-2"><div class="card reveal" style="--i:1"><h3>Empathy by agent</h3><div class="sub">Marker shows the target. ${meet} of ${R.length} agents meet it.</div>${barList(R.map((a) => ({ av: avatar(a, 22), l: a.name, v: a.emp * 100, st: a.emp >= .9 ? 'good' : a.emp >= .85 ? 'warn' : 'bad' })), { max: 100, target: 90, f: (v) => v.toFixed(1) + '%' })}</div>
    <div class="card reveal" style="--i:2"><h3>Empathy details</h3><div class="sub">Marks earned and audit volume</div>${table('emp', [nameCol(), valCol('Empathy', 'emp', 'p1'), valCol('Target', 'empT', 'p1'), kCol('Marks', 'empK', .6), col('Audits', (a) => (a.audit ? a.audit.total : '—'), { r: 1, s: (a) => (a.audit ? a.audit.total : null) })], L, { sort: 1 })}</div></div>`;
}
function secFcr() {
  const L = scope();
  return head('FCR, Quiz & Service Delivery', 'First call resolution, quiz phases and service delivery.') + noteStamp('quiz') +
    `<div class="grid g-2"><div class="card reveal" style="--i:1"><h3>FCR by agent</h3><div class="sub">Target 93%</div>${barList(L.filter((a) => isN(a.fcr)).sort((a, b) => b.fcr - a.fcr).map((a) => ({ av: avatar(a, 22), l: a.name, v: a.fcr * 100, st: a.fcr >= .93 ? 'good' : a.fcr >= .9 ? 'warn' : 'bad' })), { max: 100, target: 93, f: (v) => v.toFixed(1) + '%' })}</div>
    <div class="card reveal" style="--i:2"><h3>Quiz scores</h3><div class="sub">Score out of 10 for each phase</div>${table('quiz', [nameCol(), ...[0, 1, 2, 3].map((i) => col('Phase ' + (i + 1), (a) => (a.quizPh && isN(a.quizPh.ph[i]) ? a.quizPh.ph[i] : '—'), { r: 1, s: (a) => (a.quizPh ? a.quizPh.ph[i] : null) })), valCol('Quiz', 'quiz', 'p1')], L, { sort: 0, dir: 'asc' })}</div></div>
    <div class="card reveal" style="--i:3"><h3>FCR and service delivery data</h3><div class="sub">Click a column to sort</div>${table('fcr', [nameCol(), col('ID', (a) => esc(a.id), { s: (a) => a.id }), valCol('FCR %', 'fcr', 'p1'), col('Calls', (a) => (a.fcrCalls ?? '—'), { r: 1, s: (a) => a.fcrCalls }), col('FCR count', (a) => (a.fcrCount ?? '—'), { r: 1, s: (a) => a.fcrCount }), kCol('FCR marks', 'fcrK', .2), valCol('SD', 'sd', 'n'), col('SD complaints (raw)', (a) => ((a.sdRows || []).length ? openBtn('sd', a, (a.sdRows || []).length + ' complaint' + ((a.sdRows || []).length === 1 ? '' : 's')) : openBtn('sd', a, '0')), { r: 1, s: (a) => (a.sdRows || []).length, x: (a) => (a.sdRows || []).length }), kCol('SD marks', 'sdK', .2)], L, { sort: 2 })}</div>`;
}
function secDkb() {
  const L = scope();
  return head('Complaint & DKB', 'Complaint escalation accuracy and DKB attendance.') + noteStamp('dkb') +
    `<div class="card reveal" style="--i:1"><h3>Complaint escalation</h3><div class="sub">The workbook holds accuracy and marks only. Valid and invalid counts are not in the file.</div>${table('esc', [nameCol(), valCol('Accuracy', 'esc', 'p1'), valCol('Target', 'escT', 'p1'), kCol('Marks', 'escK', .1), col('Result', (a) => (isN(a.esc) ? pill(a.esc >= (a.escT || .95) ? 'good' : 'bad', a.esc >= (a.escT || .95) ? 'On target' : 'Below target') : pill('mute', 'No data')), { s: (a) => (isN(a.esc) ? a.esc : null), x: (a) => (isN(a.esc) ? a.esc : 'No data') })], L, { sort: 0, dir: 'asc' })}</div>
    <div class="card reveal" style="--i:2"><h3>DKB attendance</h3><div class="sub">Healthy 95%+, Fair 90 to 94.99%, Low below 90%</div>${table('dkb', [nameCol(), col('Present', (a) => (a.dkbPA ? a.dkbPA.present : '—'), { r: 1, s: (a) => (a.dkbPA ? a.dkbPA.present : null) }), col('Absent', (a) => (a.dkbPA ? a.dkbPA.absent : '—'), { r: 1, s: (a) => (a.dkbPA ? a.dkbPA.absent : null) }), col('DKB %', (a) => fPct(a.dkbPA && isN(a.dkbPA.pct) ? a.dkbPA.pct : a.dkb), { r: 1, s: (a) => (a.dkbPA && isN(a.dkbPA.pct) ? a.dkbPA.pct : a.dkb) }), col('Health status', (a) => { const s = dkbStat(a.dkbPA && isN(a.dkbPA.pct) ? a.dkbPA.pct : a.dkb); return pill(s[0], s[1]); }, { s: (a) => (a.dkbPA ? a.dkbPA.pct : null) }), col('Absent dates', (a) => { const r = dkbOf(a).rows.filter((x) => x.s === 'A'); return r.length ? openBtn('dkbabs', a, r.map((x) => fD(x.d).slice(0, 6)).join(', ')) : '—'; }, { x: (a) => dkbOf(a).rows.filter((x) => x.s === 'A').map((x) => fD(x.d)).join('; ') }), kCol('Marks', 'dkbK', .05)], L, { sort: 3, dir: 'asc' })}</div>`;
}
function secLag() {
  const L = scope();
  return head('Lag & Adherence', 'Schedule adherence, login hour compliance, lag time and breaks.') +
    `<div class="grid g-2"><div class="card reveal" style="--i:1"><h3>Schedule adherence</h3><div class="sub">Target 100%</div>${barList(L.filter((a) => isN(a.adh)).sort((a, b) => b.adh - a.adh).map((a) => ({ av: avatar(a, 22), l: a.name, v: a.adh * 100, st: a.adh >= .95 ? 'good' : a.adh >= .85 ? 'warn' : 'bad' })), { max: 100, target: 100, f: (v) => v.toFixed(1) + '%' })}</div>
    <div class="card reveal" style="--i:2"><h3>Login hour compliance</h3><div class="sub">Ready hours against target hours</div>${barList(L.filter((a) => isN(a.comp)).sort((a, b) => b.comp - a.comp).map((a) => ({ av: avatar(a, 22), l: a.name, v: Math.min(a.comp, 1.1) * 100, st: a.comp >= .95 ? 'good' : a.comp >= .85 ? 'warn' : 'bad' })), { max: 110, target: 100, f: (v) => v.toFixed(1) + '%' })}</div></div>
    <div class="card reveal" style="--i:3"><h3>Lag, adherence and break data</h3><div class="sub">Click a column to sort</div>${table('lag', [nameCol(), col('Roster', (a) => a.roster ?? '—', { r: 1, s: (a) => a.roster }), col('Present', (a) => a.present ?? '—', { r: 1, s: (a) => a.present }), col('Absent', (a) => (a.absent ? `<span class="t-bad">${a.absent}</span>` : (a.absent ?? '—')), { r: 1, s: (a) => a.absent }), valCol('Adherence', 'adh', 'p1'), valCol('Compliance', 'comp', 'p1'), col('Target hours', (a) => fDur(a.tgtHr), { r: 1, s: (a) => a.tgtHr }), col('Ready hours', (a) => fDur(a.rdyHr), { r: 1, s: (a) => a.rdyHr }), col('Lag time', (a) => (a.lag === 0 ? pill('good', 'No lag') : isN(a.lag) ? pill(a.lag < 3600 ? 'warn' : 'bad', fDur(a.lag)) : '—'), { r: 1, s: (a) => a.lag }), col('Extra break', (a) => (a.xbrk === 0 ? pill('good', 'None') : isN(a.xbrk) ? pill('bad', fDur(a.xbrk)) : '—'), { r: 1, s: (a) => a.xbrk }), kCol('Adh. marks', 'adhK', .2)], L, { sort: 4, dir: 'asc' })}</div>`;
}
function heatTable(L, days, get, cls) {
  return `<div class="tbl-wrap"><table class="heat"><thead><tr><th style="text-align:left">Agent</th>${days.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${L.map((a) => `<tr class="${a.id === S.agent ? 'me' : ''}"><td class="nm">${nameHTML(a, 22)}</td>${days.map((d, i) => { const [txt, c] = get(a, i); return `<td class="${c}">${txt}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function secAht() {
  const L = scope(), days = S.data.days;
  const ahtH = heatTable(L, days, (a, i) => { const v = (a.ahtDay || [])[i]; return isN(v) ? [Math.round(v), 'hc-' + ({ good: 'good', warn: 'warn', bad: 'bad' }[ahtStat(v, TARGET_AHT)])] : ['·', 'hc-none']; });
  const cfsH = heatTable(L, days, (a, i) => { const c = (a.csatDay || [])[i] || 0, d = (a.dsatDay || [])[i] || 0; if (c + d === 0) return ['·', 'hc-none']; const s = c / (c + d); return [(s * 100).toFixed(0), 'hc-' + csatStat(s, TARGET_CSAT)]; });
  return head('AHT & CFS', 'Average handling time and customer feedback score, monthly and day by day.') +
    `<div class="card reveal" style="--i:1"><h3>Agent AHT and CFS</h3><div class="sub">AHT target 180 s, CSAT target 93%</div>${table('ahtcfs', [nameCol(), valCol('AHT (s)', 'aht', 'n', { c: (a) => (isN(a.aht) ? Math.round(a.aht) : '—') }), col('AHT status', (a) => { const s = ahtStat(a.aht, a.ahtT || TARGET_AHT); return pill(s, { good: 'On target', warn: 'Near target', bad: 'Above target', mute: 'No data' }[s]); }, { s: (a) => a.aht }), col('CSAT', (a) => a.csatCnt ?? '—', { r: 1, s: (a) => a.csatCnt }), col('DSAT', (a) => a.dsatCnt ?? '—', { r: 1, s: (a) => a.dsatCnt }), valCol('CFS %', 'csat', 'p1'), col('CFS status', (a) => { const s = csatStat(a.csat, a.csatT || TARGET_CSAT); return pill(s, { good: 'On target', warn: 'Near target', bad: 'Below target', mute: 'No data' }[s]); }, { s: (a) => a.csat }), kCol('AHT marks', 'ahtK', .8), kCol('CSAT marks', 'csatK', .8)], L, { sort: 0, dir: 'asc' })}</div>
    <div class="card reveal" style="--i:2"><h3>Day-wise AHT</h3><div class="sub">Seconds per call. Green at or under 180, amber within 15%, red above. A dot means no data.</div>${ahtH}</div>
    <div class="card reveal" style="--i:3"><h3>Day-wise CFS score</h3><div class="sub">Percent satisfied. Green at 93% or more, amber within 2 points, red below.</div>${cfsH}</div>`;
}

/* ---------- Shift & Punch ---------- */
const dayKey = (n) => (isN(n) ? Math.floor(n) : null);
function punchRows(a, only) {
  const att = new Map((a.attRows || []).map((r) => [dayKey(r.d), r])), pu = new Map((a.punch || []).map((r) => [dayKey(r.d), r]));
  const days = only != null ? [only] : [...new Set([...att.keys(), ...pu.keys()])].filter((x) => x != null).sort((x, y) => y - x);
  return days.map((d) => ({ id: a.id, name: a.name, a, d, at: att.get(d) || null, pu: pu.get(d) || null })).filter((r) => r.at || r.pu);
}
const tCell = (v) => (isN(v) ? fT(v).slice(0, 5) : '<span class="t-mute">—</span>');
function gapPill(r) {
  const sh = shiftMin((r.at && r.at.sh) || (r.pu && r.pu.sh)); const li = r.pu && r.pu.fi != null ? r.pu.fi : (r.at ? r.at.li : null);
  if (!sh || li == null) return '<span class="t-mute">—</span>';
  const m = (li - (r.d + sh.s / 1440)) * 1440;
  return m > 1 ? pill('bad', 'Late ' + fMin(m)) : m < -1 ? pill('good', 'Early ' + fMin(-m)) : pill('good', 'On time');
}
function secPunch() {
  const L = scope(), single = !!cur();
  const allDays = [...new Set(L.flatMap((a) => punchRows(a).map((r) => r.d)))].sort((x, y) => y - x);
  const info = S.data.punchInfo;
  let day = S.punchDay != null && allDays.includes(S.punchDay) ? S.punchDay : (allDays.find((d) => L.some((x) => punchRows(x, d).some((r) => (r.pu && r.pu.fi != null) || (r.at && r.at.li != null)))) ?? allDays[0] ?? null);
  const base = single ? L.flatMap((a) => punchRows(a)) : (day == null ? [] : L.flatMap((a) => punchRows(a, day)));
  const rows = base.map((r) => Object.assign(r, { sh: (r.at && r.at.sh) || (r.pu && r.pu.sh) || '' }));
  const cols = [nameCol()];
  if (single) cols.push(col('Date', (r) => fD(r.d) + ' <span class="t-mute">' + fWd(r.d) + '</span>', { s: (r) => r.d, x: (r) => isoS(r.d) }));
  cols.push(col('Shift', (r) => esc(r.sh) || '—', { s: (r) => r.sh, x: (r) => r.sh }),
    col('System login', (r) => tCell(r.at && r.at.li), { r: 1, s: (r) => (r.at ? r.at.li : null), x: (r) => (r.at && isN(r.at.li) ? fT(r.at.li) : '') }),
    col('System logout', (r) => tCell(r.at && r.at.lo), { r: 1, s: (r) => (r.at ? r.at.lo : null), x: (r) => (r.at && isN(r.at.lo) ? fT(r.at.lo) : '') }),
    col('Punch in', (r) => tCell(r.pu && r.pu.fi), { r: 1, s: (r) => (r.pu ? r.pu.fi : null), x: (r) => (r.pu && isN(r.pu.fi) ? fT(r.pu.fi) : '') }),
    col('Punch out', (r) => tCell(r.pu && r.pu.la), { r: 1, s: (r) => (r.pu ? r.pu.la : null), x: (r) => (r.pu && isN(r.pu.la) ? fT(r.pu.la) : '') }),
    col('Punch vs shift', gapPill, { s: (r) => { const t = shiftMin(r.sh), li = r.pu && r.pu.fi != null ? r.pu.fi : null; return t && li != null ? (li - (r.d + t.s / 1440)) * 1440 : null; } }),
    col('Status', (r) => (r.at ? (r.at.st >= 1 ? pill('good', 'Present') : r.at.st > 0 ? pill('warn', 'Half') : pill('bad', 'Absent')) : (r.pu && r.pu.st ? esc(r.pu.st) : '—')), { s: (r) => (r.at ? r.at.st : null) }));
  const pick = single ? '' : `<div class="field" style="max-width:220px"><label for="punchDay">Date</label><select id="punchDay">${allDays.map((d) => `<option value="${d}" ${d === day ? 'selected' : ''}>${fD(d)} · ${fWd(d)}</option>`).join('')}</select></div>`;
  const attMax = Math.max(0, ...L.flatMap((x) => (x.attRows || []).filter((r) => r.li != null).map((r) => r.d)));
  const attNote = attMax ? ` · System login/logout available up to ${fD(attMax)}` : '';
  const miss = !info ? `<div class="msg warn">No punch file has been uploaded yet. System login and logout come from the attendance sheet; punch in and out appear once the admin uploads the Punch file in Update Data.</div>` : '';
  return head('Shift & Punch', 'Shift time, system login and logout (attendance sheet) against punch in and punch out (punch file).') + miss +
    `<div class="card reveal" style="--i:1"><h3>${single ? esc(L[0].name) + ' · day by day' : 'Team on ' + (day != null ? fD(day) : '—')}</h3><div class="sub">${info ? `Punch data: ${fD(info.from)} to ${fD(info.to)} · ${info.agents} agents` : 'Punch data not loaded'}${attNote}</div>${pick}${table('punch' + (single ? '1' : ''), cols, rows, { sort: single ? 1 : 0, dir: single ? 'desc' : 'asc' })}</div>`;
}

/* ---------- My all Colleague Details ---------- */
function secTeam() {
  const rows = A().slice().sort((a, b) => a.name.localeCompare(b.name)); S.mobEdit = S.mobEdit || {};
  const mob = (a) => { const v = S.mobEdit[a.id] != null ? S.mobEdit[a.id] : (a.mobile || '');
    if (S.isAdmin) return `<input class="mob" data-mob="${esc(a.id)}" type="tel" inputmode="tel" placeholder="01XXXXXXXXX" value="${esc(v)}" aria-label="Mobile of ${esc(a.name)}">`;
    return v ? `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : '<span class="t-mute">Not added</span>'; };
  const otpC = (a) => { const v = S.otpEdit && S.otpEdit[a.id] != null ? S.otpEdit[a.id] : (a.otp || '');
    if (S.isAdmin) return `<input class="mob" data-otp="${esc(a.id)}" type="tel" inputmode="tel" placeholder="CIM OTP no." value="${esc(v)}" aria-label="CIM OTP of ${esc(a.name)}">`;
    if (S.me && S.me.id === a.id && v) return `<a href="tel:${esc(v)}">${esc(v)}</a>`;
    return '<span class="t-mute">Private</span>'; };
  const have = rows.filter((a) => a.mobile).length;
  const cols = [nameCol('Name'), col('Genex ID', (a) => esc(a.vdi || '—'), { s: (a) => a.vdi || '', x: (a) => a.vdi || '' }),
    col('EID', (a) => esc(a.id), { s: (a) => a.id, x: (a) => a.id }),
    col('Contact number', mob, { s: (a) => a.mobile || '', x: (a) => a.mobile || '' }),
    col('CIM OTP number', otpC, { s: (a) => a.otp || '', x: (a) => (S.isAdmin ? a.otp || '' : '') }),
    col('Team leader', (a) => esc(a.tl || '—'), { s: (a) => a.tl || '', x: (a) => a.tl || '' }),
    col('Site / LOB', (a) => esc([a.site, a.lob].filter(Boolean).join(' · ') || '—'), { s: (a) => a.site || '', x: (a) => [a.site, a.lob].filter(Boolean).join(' · ') })];
  const adm = S.isAdmin ? `<div class="msg" style="margin:0 0 10px">Admin: type the mobile numbers below, then press <b>Save and publish numbers</b>. Numbers are kept when you upload new Excel files. <button class="btn primary sm" id="mobSave">Save and publish numbers</button></div>` : '';
  return head('My all Colleague Details', 'Every agent in the KPI sheet with Genex ID, contact number and CIM OTP number (OTP numbers are visible to the admin, and to each agent for their own).') +
    `<div class="card reveal" style="--i:1"><h3>${rows.length} colleagues</h3><div class="sub">${have} with a mobile number</div>${adm}${table('team', cols, rows, { sort: 0, dir: 'asc' })}</div>`;
}

/* ---------- render + router ---------- */
const VIEWS = { dash: secDash, agent: secAgent, audit: secAudit, emp: secEmp, fcr: secFcr, dkb: secDkb, lag: secLag, aht: secAht, punch: secPunch, team: secTeam };
function render(keepScroll) {
  const root = $('#content'), sc = window.scrollY;
  const sn = (SECTIONS.find((s) => s.id === S.sec) || {}).name || '';
  $('#pageTitle').textContent = S.sec === 'agent' && S.sub ? SUB_TITLE[S.sub] : sn;
  $$('#nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.sec === S.sec ? 'page' : 'false'));
  if (!S.data) {
    root.innerHTML = `<div class="state"><img alt="" src="logo.png"><h1>No data published yet</h1><p>Use <b>Update Data</b> to upload the KPI Excel file and publish it for the whole team.</p><button class="btn primary" data-open-up><svg><use href="#i-up"/></svg>Update Data</button></div>`;
    return;
  }
  root.innerHTML = `<div class="section">${VIEWS[S.sec]()}</div>`;
  afterRender();
  if (keepScroll) window.scrollTo(0, sc); else window.scrollTo(0, 0);
}
function afterRender() {
  $$('.count').forEach((el) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = parseFloat(el.dataset.to), dec = +el.dataset.dec, suf = el.dataset.suf || ''; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(step); else el.textContent = to.toFixed(dec) + suf; };
    requestAnimationFrame(step);
  });
}
const routeHash = (r) => '#' + [r.sec, r.agent && r.agent !== 'all' ? r.agent : '', r.sub || ''].join('/').replace(/\/+$/, '');
function applyHash() {
  const [sec, agent, sub] = decodeURIComponent(location.hash.slice(1)).split('/');
  const nsec = SECTIONS.some((s) => s.id === sec) ? sec : 'dash';
  const nag = agent && A().some((a) => a.id === agent) ? agent : 'all';
  const nsub = nsec === 'agent' && nag !== 'all' && SUBS.includes(sub) ? sub : null;
  return { sec: nsec, agent: nag, sub: nsub };
}
let routed = false;
function go(patch) {            /* change page (no transition animation any more; the eagle and snake live on the login page only) */
  const r = Object.assign({ sec: S.sec, agent: S.agent, sub: S.sub }, patch);
  if (r.sec !== 'agent' && !('sub' in patch)) r.sub = null;
  if (r.agent === 'all') r.sub = null;
  const h = routeHash(r);
  if (location.hash === h) return;
  location.hash = h;            /* hashchange handler does the transition (also makes the browser back button work) */
}
function onRoute() {
  if (!S.data && S.status !== 'ready') return;
  const r = applyHash();
  const changed = r.sec !== S.sec || r.agent !== S.agent || r.sub !== S.sub;
  if (!changed && routed) return;
  const apply = () => { S.sec = r.sec; S.agent = r.agent; S.sub = r.sub; S.month = null; S.dq = {}; $('#agentSel').value = S.agent; render(); };
  routed = true; apply();
}
function buildChrome() {
  $('#nav').innerHTML = SECTIONS.map((s) => `<button data-sec="${s.id}"><svg><use href="#${s.ic}"/></svg>${s.name}</button>`).join('');
  fillAgents();
}
function fillAgents() {
  const sel = $('#agentSel'); const v = S.agent;
  sel.innerHTML = `<option value="all">All Agents (Team)</option>` + A().slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  sel.value = A().some((a) => a.id === v) ? v : 'all'; S.agent = sel.value;
}
function toast(msg, bad) { const t = document.createElement('div'); t.className = 'msg ' + (bad ? 'bad' : 'good'); t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;box-shadow:var(--shadow);max-width:90vw'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 4200); }

/* ---------- login + data loading ---------- */
const normId = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
async function fetchVault() {
  const r = await fetch(CONFIG.dataUrl + '?t=' + Date.now(), { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Could not load the data file (HTTP ' + r.status + ').');
  const txt = await r.text(); S.sig = hashStr(txt); return JSON.parse(txt);
}
async function loadPhotos() { try { const r = await fetch(CONFIG.photoMap + '?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) S.photos = await r.json(); } catch (e) { S.photos = {}; } }
const te8 = new TextEncoder();
const d64 = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
const ovKey = (id) => 'te-pw:' + normId(id);
async function pwHash(pw, saltB64) { const base = await crypto.subtle.importKey('raw', te8.encode(pw), 'PBKDF2', false, ['deriveBits']); return u8b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: d64(saltB64), iterations: 100000, hash: 'SHA-256' }, base, 256))); }
const isAdminId = (id) => normId(id) === normId(CONFIG.defaultId);
const defaultPassFor = (id) => (isAdminId(id) ? CONFIG.defaultPass : CONFIG.agentPass);
async function signIn(id, pw) {
  const vault = await fetchVault();
  await loadPhotos();
  let unwrapPw = pw;
  const ov = safe(() => JSON.parse(localStorage.getItem(ovKey(id)) || 'null'));   /* password the person set on this device */
  if (ov && ov.salt) { if (await pwHash(pw, ov.salt) !== ov.hash) throw new Error('BAD'); unwrapPw = defaultPassFor(id); }
  if (!vault) {                                            /* first run: nothing published yet */
    if (!isAdminId(id) || unwrapPw !== CONFIG.defaultPass) throw new Error('BAD');
    S.data = null;
  } else {
    try { S.data = await Core.vaultOpen(vault, id, unwrapPw); } catch (e) { throw new Error('BAD'); }
  }
  S.unwrapPw = unwrapPw; S.cred = { id, pw }; S.isAdmin = isAdminId(id); S.status = 'ready';
  S.me = S.data ? (S.data.agents.find((a) => a.vdi && normId(a.vdi) === normId(id)) || null) : null;
}
function showApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  buildChrome(); routed = false;
  $('#upBtn').hidden = !S.isAdmin;
  if (S.me && !location.hash) history.replaceState(null, '', routeHash({ sec: 'agent', agent: S.me.id }));
  const h = applyHash(); S.sec = h.sec; S.agent = h.agent; S.sub = h.sub; $('#agentSel').value = S.agent;
  routed = true; render();
}

/* ---------- birds, soldier and the welcome screen ---------- */
const BIRD = (c) => `<svg viewBox="0 0 60 30"><g fill="${c}"><ellipse cx="30" cy="16" rx="10" ry="4.5"/><circle cx="41" cy="14" r="3.2"/><path d="M44 13.5l6 1.6-6 1.4z" fill="#f2c26b"/><path d="M20 16l-11 3 12-1z"/><g class="wl"><path d="M30 15C24 8 14 4 5 6c9 1 15 5 20 11z"/></g><g class="wr"><path d="M32 15C38 6 46 2 55 3c-9 2-14 7-18 13z"/></g></g></svg>`;
function BIRDS(n = 18) {
  const cols = ['#ffffff', '#cfe6ff', '#f6d9a0', '#9fd3ff', '#ffe9c2', '#dbe9ff'];
  let h = ''; for (let i = 0; i < n; i++) {
    const r = (k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    h += `<span class="bird" style="--y:${(4 + r(1) * 84).toFixed(1)}%;--s:${(20 + r(2) * 26).toFixed(0)}px;--t:${(16 + r(3) * 18).toFixed(1)}s;--dl:-${(r(4) * 30).toFixed(1)}s;--b:${(2 + r(5) * 3).toFixed(1)}s;--f:${(.28 + r(6) * .3).toFixed(2)}s">${BIRD(cols[i % cols.length])}</span>`;
  } return h;
}
const SOLDIER = () => `<svg viewBox="0 0 100 190"><g><ellipse cx="50" cy="184" rx="30" ry="5" fill="rgba(0,0,0,.3)"/>
<rect x="33" y="118" width="14" height="60" rx="4" fill="#3d4a2c"/><rect x="53" y="118" width="14" height="60" rx="4" fill="#3d4a2c"/><rect x="30" y="172" width="19" height="11" rx="4" fill="#15171a"/><rect x="51" y="172" width="19" height="11" rx="4" fill="#15171a"/>
<path d="M28 66c0-8 10-12 22-12s22 4 22 12v56H28z" fill="#55663a"/><path d="M36 74l8 10M52 70l9 12M40 98l7 9M58 94l8 9" stroke="#3b4a27" stroke-width="5" stroke-linecap="round"/><rect x="28" y="108" width="44" height="7" fill="#2b2f24"/><rect x="46" y="107" width="8" height="9" rx="1" fill="#d9ac69"/>
<path d="M28 68c-8 4-10 22-9 42l10 1c0-14 2-24 6-28z" fill="#55663a"/><rect x="19" y="108" width="11" height="9" rx="4" fill="#e0b48c"/>
<g class="arm"><path d="M72 68c8 3 16 8 16 18l-9 3c-1-6-5-8-10-10z" fill="#55663a"/><path d="M62 62c10-2 18 2 22 12l-7 3c-3-6-8-8-14-8z" fill="#55663a"/><rect x="80" y="64" width="11" height="9" rx="4" fill="#e0b48c"/></g>
<rect x="44" y="48" width="12" height="9" fill="#e0b48c"/><circle cx="50" cy="40" r="15" fill="#e0b48c"/><circle cx="45" cy="40" r="1.8" fill="#222"/><circle cx="55" cy="40" r="1.8" fill="#222"/><path d="M45 48c3 2 7 2 10 0" stroke="#8a4b34" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M33 36c0-14 7-22 17-22s17 8 17 22z" fill="#55663a"/><rect x="31" y="34" width="38" height="5" rx="2.5" fill="#3b4a27"/><path d="M50 18l2 4 4 .6-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3 4-.6z" fill="#d9ac69" transform="translate(0 -2) scale(.8) translate(12 6)"/></g></svg>`;
let orbitRaf = 0;
function startOrbit() {
  const stage = $('#stage'), orbit = $('#orbit'); if (!stage || !orbit) return;
  const ags = A().slice(); const n = ags.length || 0;
  orbit.innerHTML = ags.map((a) => `<div class="orb">${avatar(a, 80)}</div>`).join('');
  const els = $$('.orb', orbit); const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const t0 = performance.now();
  cancelAnimationFrame(orbitRaf);
  const tick = (now) => {
    if ($('#welcome').hidden) return;
    const W = stage.clientWidth, H = stage.clientHeight; const tl = Math.min(W * .5, H * .5, 320); stage.style.setProperty('--tl', tl + 'px');
    const av = Math.round(tl * .4);                       /* agent photo = 40% of the Team Leader photo */
    const rx = W / 2 - av / 2 - 6, ry = Math.max(H / 2 - av / 2 - 8, tl / 2 + av * .45); const ang = reduce ? 0 : (now - t0) / 1000 * (Math.PI * 2 / 46);
    els.forEach((el, i) => {
      const th = ang + i * Math.PI * 2 / Math.max(1, n), dp = (Math.cos(th) + 1) / 2, sc = .55 + .45 * dp;
      el.firstElementChild.style.setProperty('--s', av + 'px');
      el.style.transform = `translate(${(W / 2 + rx * Math.sin(th) - av / 2).toFixed(1)}px,${(H / 2 + ry * Math.cos(th) - av / 2).toFixed(1)}px) scale(${sc.toFixed(3)})`;
      el.style.zIndex = Math.round(dp * 100); el.style.opacity = (.6 + .4 * dp).toFixed(2);
    });
    orbitRaf = requestAnimationFrame(tick);
  };
  orbitRaf = requestAnimationFrame(tick);
}
function showWelcome() {
  $('#login').hidden = true; $('#welcome').hidden = false; $('#soldier').innerHTML = SOLDIER();
  $('#tlImg').addEventListener('error', (e) => { e.target.style.visibility = 'hidden'; }, { once: true });
  startOrbit();
}
function openDashboard() { cancelAnimationFrame(orbitRaf); $('#welcome').hidden = true; safe(() => sessionStorage.setItem('te-welcomed', '1')); showApp(); }
async function doLogin(id, pw, silent) {
  const btn = $('#lbtn'), err = $('#lerr'); err.hidden = true; btn.disabled = true; btn.firstElementChild.textContent = 'Signing in…';
  try {
    await signIn(id, pw);
    safe(() => sessionStorage.setItem('te-cred', JSON.stringify({ id, pw })));
    if (silent || safe(() => sessionStorage.getItem('te-welcomed'))) showApp(); else showWelcome();
  } catch (e) {
    if (!silent) { err.textContent = e.message === 'BAD' ? 'Incorrect ID or password.' : (e.message || 'Could not sign in.'); err.hidden = false; }
    safe(() => sessionStorage.removeItem('te-cred'));
  } finally { btn.disabled = false; btn.firstElementChild.textContent = 'Sign in'; }
}
function signOut() { safe(() => { sessionStorage.removeItem('te-cred'); sessionStorage.removeItem('te-welcomed'); }); S.data = null; S.cred = null; location.hash = ''; location.reload(); }

/* ---------- Update Data (Excel upload) ---------- */
const GH = { owner: '', repo: '', branch: 'main' };
function guessRepo() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (m) { GH.owner = m[1]; GH.repo = location.pathname.split('/').filter(Boolean)[0] || (m[1] + '.github.io'); }
  safe(() => { const s = JSON.parse(localStorage.getItem('te-gh') || '{}'); if (s.owner) Object.assign(GH, s); });
}
function openUpload() {
  if (!S.isAdmin) return;
  S.pending = null; S.upKpi = null; S.upPunch = null; guessRepo();
  $('#modalRoot').innerHTML = `<div class="modal" id="modal"><div class="sheet wide" role="dialog" aria-modal="true" aria-labelledby="upT"><h3 id="upT">Update team data</h3>
  <p class="t-mute" style="margin:0">Admin only. Choose the two files, press <b>Read files</b>, then <b>Publish</b>. Everyone who has the site open sees the update within about a minute. You can upload just one of the two; the other stays as it is.</p>
  <div class="grid g-2" style="margin-top:8px">
  <div><label class="drop" id="drop" for="file"><b>1. KPI Updated Team Empire</b><br><span id="fname">Excel (.xlsx) · drop here</span></label><input type="file" id="file" accept=".xlsx,.xlsm" hidden>
  <div class="field"><label for="pw">Excel password</label><input id="pw" type="password" autocomplete="off" placeholder="If the file is protected"></div></div>
  <div><label class="drop" id="drop2" for="file2"><b>2. Punch Data</b><br><span id="fname2">CSV or Excel · drop here</span></label><input type="file" id="file2" accept=".csv,.xlsx,.xlsm" hidden>
  <div class="field"><label for="pw2">Punch file password</label><input id="pw2" type="password" autocomplete="off" placeholder="Only if protected"></div></div></div>
  <div id="upState"></div><div class="actions"><button class="btn" data-close>Cancel</button><button class="btn primary" id="readBtn" disabled>Read files</button></div></div></div>`;
}
const closeModal = () => { $('#modalRoot').innerHTML = ''; };
const setUpState = (html) => { const el = $('#upState'); if (el) el.innerHTML = html; };
const publishFields = () => `<div class="field" style="margin-top:8px"><label for="ghT">GitHub token</label><input id="ghT" type="password" autocomplete="off" placeholder="Personal access token (contents: write)"></div>
    <div class="pw"><div class="field"><label for="ghO">Owner</label><input id="ghO" type="text" value="${esc(GH.owner)}"></div><div class="field"><label for="ghR">Repo</label><input id="ghR" type="text" value="${esc(GH.repo)}"></div></div>
    <ol class="steps"><li><b>Publish to GitHub</b> saves the data file straight into your repository. The site updates itself in about a minute.</li><li>No token? Use <b>Download data file</b>, then upload it to the repo's <code>data</code> folder on github.com (replace <code>data.enc.json</code>).</li></ol>`;
const publishButtons = () => { $('.actions').innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn" id="dlBtn"><svg><use href="#i-dl"/></svg>Download data file</button><button class="btn primary" id="pubBtn">Publish to GitHub</button>`; };
function openMobPublish(n) {
  guessRepo(); S.pending = S.data;
  $('#modalRoot').innerHTML = `<div class="modal" id="modal"><div class="sheet wide" role="dialog" aria-modal="true"><h3>Save mobile numbers</h3><p class="t-mute" style="margin:0">${n} number(s) will be saved into the shared data file.</p><div id="upState">${publishFields()}</div><div class="actions"></div></div></div>`;
  publishButtons();
}
async function readSelected() {
  const f = $('#file').files[0], f2 = $('#file2').files[0]; if (!f && !f2) return;
  const btn = $('#readBtn'); btn.disabled = true;
  setUpState(`<div class="prog"><i id="pbar"></i></div><div class="t-mute" id="plab">Reading…</div>`);
  const prog = (p) => { const b = $('#pbar'); if (b) b.style.width = Math.round(p * 100) + '%'; const l = $('#plab'); if (l) l.textContent = p < .5 ? 'Unlocking the workbook…' : 'Decrypting…'; };
  try {
    if (!window.JSZip) throw new Error('The Excel reader did not load. Reload the page and try again.');
    const old = S.data; let data, sumKpi = '', sumPunch = '';
    if (f) {
      data = await Core.processFile(new Uint8Array(await f.arrayBuffer()), $('#pw').value, window.JSZip, prog, f.name);
      const at = new Date().toISOString(); data.at = at;
      const prev = (old && old.hist) || [];
      data.hist = prev.concat([{ t: at, month: data.month, n: data.agents.length, avg: avg(data.agents.map((a) => a.final)) }]).slice(-30);
      const oldBy = new Map(((old && old.agents) || []).map((a) => [a.id, a]));
      data.agents.forEach((a) => { const o = oldBy.get(a.id); if (!o) return; if (!a.mobile && o.mobile) a.mobile = o.mobile; if (!a.otp && o.otp) a.otp = o.otp; a.punch = o.punch || []; });
      if (old && old.punchInfo) data.punchInfo = old.punchInfo;
      const qa = sum(data.agents.map((a) => a.qa.length)), sdn = sum(data.agents.map((a) => a.sdRows.length));
      sumKpi = `<h4 style="margin:10px 0 4px">KPI file</h4><dl class="kv"><dt>Team</dt><dd>${esc(CONFIG.team)} · TL ${esc(data.tl)}</dd><dt>Month</dt><dd>${esc(data.month)} (${data.days.length} days)</dd><dt>Agents (KPI sheet)</dt><dd>${data.agents.length}</dd><dt>Average final score</dt><dd>${fNum(avg(data.agents.map((a) => a.final)), 2)}</dd><dt>Audited calls</dt><dd>${qa}</dd><dt>SD complaints</dt><dd>${sdn}</dd></dl>${(data.warnings || []).length ? `<div class="msg warn">${data.warnings.map(esc).join('<br>')}</div>` : ''}`;
    } else {
      if (!old) throw new Error('Upload the KPI Excel file first. The punch file is matched to the agents in the KPI sheet.');
      data = JSON.parse(JSON.stringify(old)); data.at = new Date().toISOString();
    }
    if (f2) {
      const pr = await Core.readPunchFile(new Uint8Array(await f2.arrayBuffer()), f2.name, $('#pw2').value, window.JSZip);
      const pi = Core.applyPunch(data, pr);
      sumPunch = `<h4 style="margin:10px 0 4px">Punch file</h4><dl class="kv"><dt>Rows read</dt><dd>${pr.rows.length}</dd><dt>Rows for KPI agents</dt><dd>${pi.rows}</dd><dt>Agents with punches</dt><dd>${pi.agents} of ${data.agents.length}</dd><dt>Dates</dt><dd>${fD(pi.from)} to ${fD(pi.to)}</dd></dl>`;
    }
    S.pending = data;
    setUpState(`<div class="msg good">${f && f2 ? 'Both files read successfully.' : 'File read successfully.'}</div>${sumKpi}${sumPunch}${publishFields()}`);
    publishButtons();
  } catch (e) {
    const m = String(e && e.message || e);
    setUpState(`<div class="msg bad">${m === 'WRONG_PASSWORD' ? 'That password is not correct. Check it and try again.' : m === 'NEED_PASSWORD' ? 'A file is password protected. Enter its password and read again.' : esc(m)}</div>`);
    btn.disabled = false;
  }
}
async function buildVaultFile() {
  const d = S.pending; if (!d) throw new Error('Read a file first.');
  /* one login for the admin plus one per KPI-sheet agent (ID = Genex ID, default password 1234) */
  const users = [{ id: CONFIG.defaultId, pass: CONFIG.defaultPass }].concat(d.agents.filter((a) => a.vdi).map((a) => ({ id: a.vdi, pass: CONFIG.agentPass })));
  return Core.vaultSeal(d, users);
}
async function ghApi(path, opt, token) {
  const r = await fetch('https://api.github.com' + path, Object.assign({ headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' } }, opt));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'GitHub rejected the token.' : r.status === 404 ? 'Repository or file not found. Check owner, repo name and token access.' : (j.message || 'GitHub error ' + r.status));
  return j;
}
const u8b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
async function ghPut(path, b64content, msg, token) {
  const base = `/repos/${encodeURIComponent(GH.owner)}/${encodeURIComponent(GH.repo)}/contents/${path}`;
  let sha; try { sha = (await ghApi(base + '?ref=' + encodeURIComponent(GH.branch), {}, token)).sha; } catch (e) { if (!/not found/i.test(e.message)) throw e; }
  return ghApi(base, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64content, branch: GH.branch, sha }) }, token);
}
async function publish() {
  const token = ($('#ghT') || {}).value; GH.owner = ($('#ghO') || {}).value.trim(); GH.repo = ($('#ghR') || {}).value.trim();
  if (!token) { toast('Paste a GitHub token first, or use Download data file.', true); return; }
  const btn = $('#pubBtn'); btn.disabled = true; btn.firstElementChild ? 0 : 0;
  try {
    setUpState($('#upState').innerHTML + '<div class="t-mute" id="pubMsg">Encrypting and publishing…</div>');
    const vault = await buildVaultFile();
    const bytes = new TextEncoder().encode(JSON.stringify(vault));
    await ghPut('data/data.enc.json', u8b64(bytes), 'Update team data (' + (S.pending.month || '') + ')', token);
    safe(() => localStorage.setItem('te-gh', JSON.stringify({ owner: GH.owner, repo: GH.repo, branch: GH.branch })));
    S.data = S.pending; fillAgents(); closeModal(); render(true);
    toast('Published. Open dashboards refresh by themselves within about two minutes.');
  } catch (e) { const m = $('#pubMsg'); if (m) m.outerHTML = `<div class="msg bad">${esc(e.message)}</div>`; btn.disabled = false; }
}
async function downloadVault() {
  try { const v = await buildVaultFile(); download('data.enc.json', JSON.stringify(v), 'application/json'); S.data = S.pending; fillAgents(); render(true); toast('Downloaded. Upload it to the repo\'s data folder to publish.'); }
  catch (e) { toast(e.message, true); }
}

/* ---------- change password (saved on this device) ---------- */
function openPw() {
  $('#modalRoot').innerHTML = `<div class="modal" id="modal"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pwT"><h3 id="pwT">Change password</h3>
  <p class="t-mute" style="margin:0">Signed in as <b>${esc(S.cred.id)}</b>. The new password is saved in this browser, so use the same browser next time.</p>
  <div class="field"><label for="pw0">Current password</label><input id="pw0" type="password" autocomplete="current-password"></div>
  <div class="field"><label for="pw1">New password (4+ characters)</label><input id="pw1" type="password" autocomplete="new-password"></div>
  <div class="field"><label for="pw2">Repeat new password</label><input id="pw2" type="password" autocomplete="new-password"></div>
  <div id="pwMsg"></div><div class="actions"><button class="btn" data-close>Cancel</button><button class="btn primary" id="pwSave">Save password</button></div></div></div>`;
}
async function savePw() {
  const c = $('#pw0').value, n = $('#pw1').value, r = $('#pw2').value, m = $('#pwMsg');
  const bad = (t) => { m.innerHTML = `<div class="msg bad">${esc(t)}</div>`; };
  if (c !== S.cred.pw) return bad('Current password is not correct.');
  if (n.length < 4) return bad('New password must be at least 4 characters.');
  if (n !== r) return bad('The two new passwords do not match.');
  if (n === c) return bad('Choose a password different from the current one.');
  try {
    const salt = Core.newSalt();
    localStorage.setItem(ovKey(S.cred.id), JSON.stringify({ salt, hash: await pwHash(n, salt) }));
  } catch (e) { return bad('This browser blocked saving the password (private window?).'); }
  S.cred.pw = n; safe(() => sessionStorage.setItem('te-cred', JSON.stringify({ id: S.cred.id, pw: n })));
  closeModal(); toast('Password changed on this device.');
}

/* ---------- events ---------- */
const exportCSV = async (id) => { const T = S.tables[id]; if (!T) return; const q = (v) => { v = v == null ? '' : String(v).replace(/<[^>]+>/g, ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; const lines = [T.cols.map((c) => q(c.h)).join(',')]; T.rows.forEach((r) => lines.push(T.cols.map((c) => q(c.x ? c.x(r) : c.c(r))).join(','))); download(`team-empire-${id}-${(S.data.month || 'data').replace(/\s+/g, '-')}.csv`, '﻿' + lines.join('\n')); };
function refreshDq() {
  const c = S.qctx, a = c && A().find((x) => x.id === c.id), body = $('#dqBody'); if (!a || !body) return;
  if (c.kind === 'sd') { const st = S.dq.sd; const ym = (r) => (/^\d{4}-\d{2}/.test(r.rcv) ? r.rcv.slice(0, 7) : ''); let rows = (a.sdRows || []).filter((r) => !c.m || ym(r) === c.m).filter((r) => !st.val || (st.val === 'other' ? !/^(valid|invalid)$/i.test(r.val) : r.val.toLowerCase() === st.val)); if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => [r.cust, r.topic, r.fl, r.cm, r.find, r.sts].join(' ').toLowerCase().includes(q)); } body.innerHTML = sdTable(a, rows); }
  else body.innerHTML = qTable(c.kind, a, c.m);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.btn'); if (b) { const r = document.createElement('span'); const bb = b.getBoundingClientRect(), s = Math.max(bb.width, bb.height); r.className = 'ripple'; r.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - bb.left - s / 2}px;top:${e.clientY - bb.top - s / 2}px`; b.appendChild(r); setTimeout(() => r.remove(), 650); }
  const nav = e.target.closest('[data-sec]'); if (nav) { $('#side').classList.remove('open'); go({ sec: nav.dataset.sec, sub: null }); return; }
  const pk = e.target.closest('[data-pick]'); if (pk) { go({ sec: 'agent', agent: pk.dataset.pick, sub: null }); return; }
  const op = e.target.closest('[data-open]'); if (op) { const [k, id] = op.dataset.open.split(':'); go({ sec: 'agent', agent: id, sub: k }); return; }
  const sb = e.target.closest('[data-sub]'); if (sb) { go({ sec: 'agent', sub: sb.dataset.sub || null }); return; }
  const at = e.target.closest('[data-atab]'); if (at) { S.atab = at.dataset.atab; render(true); return; }
  if (e.target.closest('[data-lbmore]')) { S.lbAll = true; render(true); return; }
  const ex = e.target.closest('tr.ex'); if (ex) { const n = ex.nextElementSibling; if (n && n.classList.contains('dt')) n.hidden = !n.hidden; return; }
  const so = e.target.closest('[data-sort]'); if (so) { const [id, i] = so.dataset.sort.split(':'); const st = S.tstate[id]; if (st.k === +i) st.d = st.d === 'asc' ? 'desc' : 'asc'; else { st.k = +i; st.d = 'desc'; } $('#tw-' + id).innerHTML = tableBody(id); return; }
  const cv = e.target.closest('[data-csv]'); if (cv) { exportCSV(cv.dataset.csv); return; }
  if (e.target.closest('[data-dqreset]')) { const k = (S.qctx || {}).kind; if (k) { S.dq[k] = { q: '', from: '', to: '', val: '' }; render(true); } return; }
  if (e.target.closest('[data-open-up]') || e.target.closest('#upBtn')) { openUpload(); return; }
  if (e.target.closest('[data-close]') || e.target.id === 'modal') { closeModal(); return; }
  if (e.target.closest('#openDash')) { openDashboard(); return; }
  if (e.target.closest('#mobSave')) { const ed = S.mobEdit || {}, eo = S.otpEdit || {}; let n = 0; A().forEach((a) => { if (ed[a.id] != null) a.mobile = ed[a.id].trim(); if (eo[a.id] != null) a.otp = eo[a.id].trim(); if (a.mobile) n++; }); openMobPublish(n); return; }
  if (e.target.closest('#readBtn')) { readSelected(); return; }
  if (e.target.closest('#pubBtn')) { publish(); return; }
  if (e.target.closest('#dlBtn')) { downloadVault(); return; }
  if (e.target.closest('#outBtn')) { signOut(); return; }
  if (e.target.closest('#pwBtn')) { openPw(); return; }
  if (e.target.closest('#pwSave')) { savePw(); return; }
  if (e.target.closest('#menuBtn')) { $('#side').classList.toggle('open'); return; }
  if (e.target.closest('#themeBtn')) { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; safe(() => localStorage.setItem('te-theme', r.dataset.theme)); return; }
  if (!e.target.closest('#side') && !e.target.closest('#menuBtn')) $('#side').classList.remove('open');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal')) closeModal(); if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('click') && e.target.dataset.sub) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', (e) => {
  const q = e.target.dataset && e.target.dataset.q; if (q) { S.tstate[q].q = e.target.value; $('#tw-' + q).innerHTML = tableBody(q); return; }
  if (e.target.dataset && e.target.dataset.otp) { (S.otpEdit = S.otpEdit || {})[e.target.dataset.otp] = e.target.value; return; }
  if (e.target.dataset && e.target.dataset.mob) { (S.mobEdit = S.mobEdit || {})[e.target.dataset.mob] = e.target.value; return; }
  const dq = e.target.dataset && e.target.dataset.dq; if (dq && S.qctx) { const k = S.qctx.kind; (S.dq[k] = S.dq[k] || {})[dq] = e.target.value; refreshDq(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'agentSel') { go({ agent: t.value, sub: null }); return; }
  if (t.id === 'monthSel') { S.month = t.value; render(true); return; }
  if (t.id === 'attOnly') { S.att.only = t.checked; render(true); return; }
  if (t.dataset && t.dataset.dq === 'val') { (S.dq.sd = S.dq.sd || {}).val = t.value; refreshDq(); return; }
  if (t.id === 'punchDay') { S.punchDay = +t.value; render(true); return; }
  if (t.id === 'file' || t.id === 'file2') { const f = t.files[0]; if (f) { $(t.id === 'file' ? '#fname' : '#fname2').textContent = f.name; $('#readBtn').disabled = false; setUpState(''); } }
});
const dz = (e) => (e.target.closest ? e.target.closest('#drop,#drop2') : null);
document.addEventListener('dragover', (e) => { const z = dz(e); if (z) { e.preventDefault(); z.classList.add('on'); } });
document.addEventListener('dragleave', () => { $$('#drop,#drop2').forEach((d) => d.classList.remove('on')); });
document.addEventListener('drop', (e) => { const z = dz(e); if (!z) return; e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const inp = $(z.id === 'drop' ? '#file' : '#file2'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); } z.classList.remove('on'); });
const tip = $('#tip');
document.addEventListener('mousemove', (e) => { const h = e.target.closest && e.target.closest('[data-tip]'); if (h) { tip.innerHTML = h.dataset.tip; tip.style.opacity = 1; const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + 'px'; tip.style.top = e.clientY + 14 + 'px'; } else tip.style.opacity = 0; });
window.addEventListener('hashchange', onRoute);

/* ---------- live refresh: re-check the published data file about once a minute ---------- */
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return s.length + ':' + (h >>> 0); };
async function liveCheck() {
  if (!S.cred || S.status !== 'ready' || $('#modal') || document.hidden) return;
  try {
    const r = await fetch(CONFIG.dataUrl + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const txt = await r.text(); const sig = hashStr(txt);
    if (S.sig && sig === S.sig) return;
    const first = !S.sig; S.sig = sig; if (first) return;
    const d = await Core.vaultOpen(JSON.parse(txt), S.cred.id, S.unwrapPw);
    S.data = d; S.me = d.agents.find((a) => a.vdi && normId(a.vdi) === normId(S.cred.id)) || null;
    fillAgents(); render(true); toast('Data updated. You are seeing the latest numbers.');
  } catch (e) { /* keep showing what we have */ }
}
setInterval(liveCheck, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) liveCheck(); });


/* ---------- boot ---------- */
safe(() => { const t = localStorage.getItem('te-theme'); if (t) document.documentElement.dataset.theme = t; });
$$('[data-birds]').forEach((el) => { el.innerHTML = BIRDS(el.closest('#welcome') ? 16 : 18); });
$$('[data-chase]').forEach((el) => { el.innerHTML = CHASE(); });
setTimeout(() => { const f = $('#loginForm'); if (f) f.classList.remove('intro'); }, 2300);
$('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); doLogin($('#lid').value, $('#lpw').value); });
const saved = safe(() => JSON.parse(sessionStorage.getItem('te-cred') || 'null'));
if (saved && saved.id) { $('#lid').value = saved.id; doLogin(saved.id, saved.pw, true); }
window.TeamEmpire = { state: S, Core };
})();
