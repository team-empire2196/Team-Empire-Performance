/* ===== Core: decrypt + minimal xlsx reader + team parser (no external deps except JSZip) ===== */
const Core = (() => {
  const te = new TextEncoder();
  const concat = (parts) => {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  const u32le = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const b64 = (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const attrs = (tag) => { const o = {}; tag.replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; return ''; }); return o; };
  const isOle = (u8) => u8.length > 8 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;

  /* ---------- CFB (OLE) reader ---------- */
  function cfbRead(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true);
    const dirStart = dv.getUint32(48, true), cutoff = dv.getUint32(56, true);
    const mfStart = dv.getUint32(60, true), difStart = dv.getUint32(68, true), nDif = dv.getUint32(72, true);
    const END = 0xfffffffa;
    const sec = (i) => u8.subarray((i + 1) * ss, (i + 2) * ss);
    const difat = [];
    for (let i = 0; i < 109; i++) { const v = dv.getUint32(76 + 4 * i, true); if (v < END) difat.push(v); }
    let d = difStart;
    for (let k = 0; k < nDif && d < END; k++) {
      const s = sec(d); const sdv = new DataView(s.buffer, s.byteOffset, s.byteLength);
      for (let j = 0; j < ss / 4 - 1; j++) { const v = sdv.getUint32(4 * j, true); if (v < END) difat.push(v); }
      d = sdv.getUint32(ss - 4, true);
    }
    const per = ss / 4;
    const fat = new Uint32Array(difat.length * per);
    difat.forEach((s, i) => { const q = sec(s); const qdv = new DataView(q.buffer, q.byteOffset, q.byteLength); for (let j = 0; j < per; j++) fat[i * per + j] = qdv.getUint32(4 * j, true); });
    const chain = (start) => { const out = []; let s = start; while (s < END && out.length < 5e6) { out.push(s); s = fat[s]; } return out; };
    const readChain = (start, size) => {
      const ch = chain(start); const buf = new Uint8Array(ch.length * ss);
      ch.forEach((s, i) => buf.set(sec(s), i * ss));
      return size == null ? buf : buf.subarray(0, size);
    };
    const dir = readChain(dirStart); const ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    const entries = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = ddv.getUint16(o + 64, true); if (!nl) continue;
      let name = ''; for (let k = 0; k < nl / 2 - 1; k++) name += String.fromCharCode(ddv.getUint16(o + 2 * k, true));
      entries.push({ name, type: dir[o + 66], start: ddv.getUint32(o + 116, true), size: ddv.getUint32(o + 120, true) });
    }
    const root = entries.find((e) => e.type === 5);
    let miniStream = null, miniFat = null;
    const ensureMini = () => {
      if (miniStream) return;
      miniStream = readChain(root.start, root.size);
      const mf = readChain(mfStart); miniFat = new Uint32Array(mf.buffer, mf.byteOffset, Math.floor(mf.length / 4));
      if (mf.byteOffset % 4) miniFat = new Uint32Array(mf.slice().buffer);
    };
    return {
      get(name) {
        const e = entries.find((x) => x.name === name); if (!e) return null;
        if (e.size >= cutoff) return readChain(e.start, e.size);
        ensureMini();
        const out = new Uint8Array(Math.ceil(e.size / mss) * mss); let s = e.start, i = 0;
        while (s < END && i * mss < out.length) { out.set(miniStream.subarray(s * mss, (s + 1) * mss), i * mss); s = miniFat[s]; i++; }
        return out.subarray(0, e.size);
      },
    };
  }

  /* ---------- Agile encryption (Excel 2010+) ---------- */
  const HASH = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' };
  async function aesCbcNoPad(key, iv, data) {
    const last = data.subarray(data.length - 16);
    const padEnc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: last }, key, new Uint8Array(16).fill(16)));
    const full = concat([data, padEnc.subarray(0, 16)]);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, full));
  }
  async function decryptFile(u8, password, onProgress) {
    const cfb = cfbRead(u8);
    const info = cfb.get('EncryptionInfo'), pkg = cfb.get('EncryptedPackage');
    if (!info || !pkg) throw new Error('This file is not a password-protected Excel workbook.');
    const xml = new TextDecoder().decode(info.subarray(info.indexOf(0x3c)));
    const kdTag = xml.match(/<keyData\b[^>]*>/), ekTag = xml.match(/<(?:\w+:)?encryptedKey\b[^>]*>/);
    if (!kdTag || !ekTag) throw new Error('Unsupported encryption type. Save the workbook with a standard Excel password (Excel 2013 or later).');
    const kd = attrs(kdTag[0]), ek = attrs(ekTag[0]);
    const kdAlg = HASH[kd.hashAlgorithm], ekAlg = HASH[ek.hashAlgorithm];
    if (!kdAlg || !ekAlg) throw new Error('Unsupported hash algorithm.');
    const H = async (alg, ...parts) => new Uint8Array(await crypto.subtle.digest(alg, concat(parts)));
    const pw = new Uint8Array(password.length * 2); for (let i = 0; i < password.length; i++) { pw[2 * i] = password.charCodeAt(i) & 255; pw[2 * i + 1] = password.charCodeAt(i) >> 8; }
    const salt = b64(ek.saltValue);
    let h = await H(ekAlg, salt, pw);
    const spin = parseInt(ek.spinCount, 10) || 100000;
    for (let i = 0; i < spin; i++) { h = await H(ekAlg, u32le(i), h); if (onProgress && i % 10000 === 0) onProgress(i / spin * 0.5); }
    const keyLen = parseInt(ek.keyBits, 10) / 8;
    const derive = async (blk) => { let x = await H(ekAlg, h, new Uint8Array(blk)); if (x.length < keyLen) { const y = new Uint8Array(keyLen).fill(0x36); y.set(x); x = y; } return x.subarray(0, keyLen); };
    const ik = async (raw) => crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['encrypt', 'decrypt']);
    const kVerIn = await ik(await derive([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]));
    const kVerVal = await ik(await derive([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]));
    const kKey = await ik(await derive([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]));
    const ivk = salt.subarray(0, 16);
    const verIn = await aesCbcNoPad(kVerIn, ivk, b64(ek.encryptedVerifierHashInput));
    const verVal = await aesCbcNoPad(kVerVal, ivk, b64(ek.encryptedVerifierHashValue));
    const chk = await H(ekAlg, verIn.subarray(0, parseInt(ek.saltSize, 10)));
    for (let i = 0; i < chk.length; i++) if (chk[i] !== verVal[i]) throw new Error('WRONG_PASSWORD');
    const secret = (await aesCbcNoPad(kKey, ivk, b64(ek.encryptedKeyValue))).subarray(0, keyLen);
    const dataKey = await ik(secret);
    const dv = new DataView(pkg.buffer, pkg.byteOffset, pkg.byteLength);
    const total = dv.getUint32(0, true) + dv.getUint32(4, true) * 4294967296;
    const body = pkg.subarray(8), kdSalt = b64(kd.saltValue), SEG = 4096;
    const nSeg = Math.ceil(body.length / SEG), out = new Uint8Array(nSeg * SEG);
    const BATCH = 96;
    for (let s0 = 0; s0 < nSeg; s0 += BATCH) {
      const jobs = [];
      for (let s = s0; s < Math.min(nSeg, s0 + BATCH); s++) {
        jobs.push((async () => {
          const chunk = body.subarray(s * SEG, (s + 1) * SEG);
          const len = chunk.length - (chunk.length % 16);
          const iv = (await H(kdAlg, kdSalt, u32le(s))).subarray(0, 16);
          const dec = await aesCbcNoPad(dataKey, iv, chunk.subarray(0, len));
          out.set(dec, s * SEG);
        })());
      }
      await Promise.all(jobs);
      if (onProgress) onProgress(0.5 + 0.5 * Math.min(1, (s0 + BATCH) / nSeg));
    }
    return out.subarray(0, total);
  }

  /* ---------- Minimal XLSX reader (only requested sheets) ---------- */
  const unesc = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, g) => {
    if (g[0] === '#') return String.fromCodePoint(g[1] === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[g];
  });
  const colIdx = (ref) => { let n = 0; for (let i = 0; i < ref.length; i++) { const c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); } return n - 1; };

  async function readSheets(u8, wanted, JSZip) {
    const zip = await JSZip.loadAsync(u8);
    const wbXml = await zip.file('xl/workbook.xml').async('string');
    const relXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    const rels = {}; (relXml.match(/<Relationship\b[^>]*>/g) || []).forEach((t) => { const a = attrs(t); rels[a.Id] = a.Target; });
    const all = []; (wbXml.match(/<sheet\b[^>]*>/g) || []).forEach((t) => { const a = attrs(t); all.push({ name: unesc(a.name), rid: a['r:id'] }); });
    const sheetNames = all.map((s) => s.name);
    const out = {}, pending = {}, needed = new Set();
    for (const sh of all) {
      if (!wanted.includes(sh.name)) continue;
      let tgt = rels[sh.rid]; tgt = tgt.startsWith('/') ? tgt.slice(1) : 'xl/' + tgt;
      const xml = await zip.file(tgt).async('string');
      const rows = []; const refs = [];
      const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g; let rm;
      while ((rm = rowRe.exec(xml))) {
        if (!rm[2]) continue;
        const ra = attrs(rm[1]); const r = parseInt(ra.r, 10) - 1;
        const arr = rows[r] = rows[r] || [];
        const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm;
        while ((cm = cRe.exec(rm[2]))) {
          if (!cm[2]) continue;
          const ca = attrs(cm[1]); const c = colIdx(ca.r); const t = ca.t;
          if (t === 'inlineStr') { const mt = cm[2].match(/<t\b[^>]*>([\s\S]*?)<\/t>/); arr[c] = mt ? unesc(mt[1]) : ''; continue; }
          const mv = cm[2].match(/<v>([\s\S]*?)<\/v>/); if (!mv) continue;
          if (t === 's') { const idx = parseInt(mv[1], 10); needed.add(idx); refs.push([r, c, idx]); }
          else if (t === 'str') arr[c] = unesc(mv[1]);
          else if (t === 'b') arr[c] = mv[1] === '1';
          else if (t === 'e') arr[c] = { err: mv[1] };
          else arr[c] = parseFloat(mv[1]);
        }
      }
      out[sh.name] = rows; pending[sh.name] = refs;
    }
    if (needed.size) {
      const f = zip.file('xl/sharedStrings.xml');
      const txt = f ? await f.async('string') : '';
      const map = new Map(); let i = 0;
      const siRe = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g; let m;
      while ((m = siRe.exec(txt))) {
        if (needed.has(i)) {
          let s = (m[1] || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
          let v = ''; s.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (_, g) => { v += g; return ''; });
          map.set(i, unesc(v));
        }
        i++;
      }
      for (const n of Object.keys(pending)) for (const [r, c, idx] of pending[n]) out[n][r][c] = map.get(idx) ?? '';
    }
    return { sheets: out, sheetNames };
  }

  /* ---------- helpers for parsing ---------- */
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const val = (v) => { if (v == null || v === '' || typeof v === 'object') return null; if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return parseFloat(v); return v; };
  const dur = (v) => (isNum(v) ? Math.round(v * 86400) : null);
  const serialDate = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
  const cell = (rows, r, c) => (rows[r] ? rows[r][c] : undefined);
  const findRow = (rows, test, max = 40) => { for (let r = 0; r < Math.min(rows.length, max); r++) if (rows[r] && test(rows[r])) return r; return -1; };

  const ALIAS = {
    att: ['Schedule Attendance Raw', 'Attendance'],
    dkb: ['dkb attedance raw', 'DKB Attendance Raw', 'DKB Attendance'],
  };
  const QNAMES = ['CE & NCE & RTC Raw', 'Quality Raw', 'CE & NCE Raw'];
  const SDNAMES = ['Service Delivery Raw', 'Service Delivery'];
  const CNAMES = ['Colleague Details', 'Colleague Contacts', 'My All Colleague Details', 'Contacts', 'Contact List', 'Mobile Numbers', 'Phone List'];
  const SHEETS = ['KPI', 'Day Wise AHT Tracker', 'Day Wise CFS Tracker', 'Quality & DKB & Quiz Report', ...QNAMES, ...SDNAMES, ...CNAMES, 'Escalation Accuracy & FCR', 'Escalation Accuracy Raw', 'Punch Data', 'Salary Data', 'ORT', ...ALIAS.att, ...ALIAS.dkb];
  const pick = (S, names) => { for (const n of names) if (S[n]) return S[n]; return null; };
  const ymOf = (n) => { const d = serialDate(n); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };

  const fmtMobile = (v) => { let t = String(isNum(v) ? Math.round(v) : v).replace(/[^\d+]/g, ''); if (/^1[3-9]\d{8}$/.test(t)) t = '0' + t; return t; };
  function parseTeam(S, fileName) {
    const kpi = S['KPI'];
    if (!kpi) throw new Error('Sheet "KPI" was not found in this workbook.');
    const h = findRow(kpi, (r) => norm(r[0]) === 'id' && norm(r[1]) === 'name' && norm(r[2]) === 'tl');
    if (h < 0) throw new Error('Could not find the KPI header row (ID, Name, TL).');
    const agents = [];
    for (let r = h + 1; r < kpi.length; r++) {
      const row = kpi[r]; if (!row) continue;
      const id = row[0]; if (!(isNum(id) || /^\d+$/.test(String(id || '')))) { if (agents.length) break; else continue; }
      if (!row[1]) continue;
      const g = (i) => val(row[i]);
      agents.push({
        id: String(id), name: String(row[1]).trim(), tl: String(row[2] || '').trim(),
        roster: g(3), present: g(4), absent: g(5), elig: g(6), score: g(7), bucket: g(8),
        ceT: g(9), ce: g(10), ceK: g(11),
        empT: g(12), emp: g(13), empK: g(14),
        fcrT: g(15), fcr: g(16), fcrK: g(17),
        escT: g(18), esc: g(19), escK: g(20),
        sdT: g(21), sd: g(22), sdK: g(23),
        adhT: g(24), adh: g(25), adhK: g(26),
        tgtHr: dur(row[27]), rdyHr: dur(row[28]), lag: isNum(row[29]) ? dur(row[29]) : (g(29) === 'No Lag' ? 0 : null), comp: g(30), compK: g(31),
        ahtT: g(32), aht: g(33), ahtK: g(34),
        csatT: g(35), csat: g(36), csatK: g(37),
        brk: g(38), xbrk: isNum(row[39]) ? dur(row[39]) : (g(39) === 'No Extra Break' ? 0 : null), brkK: g(40),
        dkb: g(41), dkbK: g(42), quiz: g(43), quizK: g(44),
        scorable: g(45), total: g(46), final: g(47), cat: g(48),
        days: [],
      });
    }
    if (!agents.length) throw new Error('No agents were found under the KPI header.');
    const byId = new Map(agents.map((a) => [a.id, a]));
    const byName = new Map(agents.map((a) => [norm(a.name), a]));
    const tlCount = {}; agents.forEach((a) => { tlCount[a.tl] = (tlCount[a.tl] || 0) + 1; });
    const tl = Object.keys(tlCount).sort((a, b) => tlCount[b] - tlCount[a])[0] || '';
    const warnings = [];
    const idKey = (v) => (isNum(v) ? String(Math.round(v)) : String(v || '').trim());

    /* Day-wise AHT */
    let dayDates = [];
    const at = S['Day Wise AHT Tracker'];
    if (at) {
      const hr = findRow(at, (r) => norm(r[0]) === 'id');
      if (hr > 0) {
        for (let c = 6; ; c += 3) { const d = cell(at, hr - 1, c); if (!isNum(d)) break; dayDates.push(serialDate(d)); }
        for (let r = hr + 1; r < at.length; r++) {
          const a = byId.get(idKey(cell(at, r, 0))); if (!a) continue;
          a.ahtDay = dayDates.map((_, k) => { const v = cell(at, r, 8 + 3 * k); return isNum(v) ? Math.round(v * 10) / 10 : null; });
          a.ahtStaff = dur(cell(at, r, 3)); a.ahtAux = dur(cell(at, r, 4));
        }
      } else warnings.push('AHT tracker layout not recognised.');
    } else warnings.push('Sheet "Day Wise AHT Tracker" not found.');

    /* Day-wise CSAT / CFS */
    const ct = S['Day Wise CFS Tracker'];
    if (ct) {
      const hr = findRow(ct, (r) => norm(r[0]) === 'id');
      if (hr > 0) {
        if (!dayDates.length) for (let c = 7; ; c += 3) { const d = cell(ct, hr - 1, c); if (!isNum(d)) break; dayDates.push(serialDate(d)); }
        for (let r = hr + 1; r < ct.length; r++) {
          const a = byId.get(idKey(cell(ct, r, 0))); if (!a) continue;
          a.vdi = String(cell(ct, r, 1) || '');
          a.csatCnt = cell(ct, r, 4); a.dsatCnt = cell(ct, r, 5);
          a.csatDay = dayDates.map((_, k) => { const v = cell(ct, r, 7 + 3 * k); return isNum(v) ? v : 0; });
          a.dsatDay = dayDates.map((_, k) => { const v = cell(ct, r, 8 + 3 * k); return isNum(v) ? v : 0; });
        }
      }
    } else warnings.push('Sheet "Day Wise CFS Tracker" not found.');

    /* Quality / DKB / Quiz */
    const q = S['Quality & DKB & Quiz Report'];
    const notes = {};
    if (q) {
      const hr = findRow(q, (r) => r.some((x) => norm(x) === 'agentname'));
      if (hr >= 0) {
        const starts = []; q[hr].forEach((x, i) => { if (norm(x) === 'agentname') starts.push(i); });
        const labelRow = q[hr - 1] || [];
        const [sA, sD, sQ] = starts;
        if (sA != null) notes.audit = String(labelRow[sA] || '');
        if (sD != null) notes.dkb = String(labelRow[sD] || '');
        if (sQ != null) notes.quiz = String(labelRow[sQ] || '');
        for (let r = hr + 1; r < q.length; r++) {
          const row = q[r] || [];
          if (sA != null) { const a = byName.get(norm(row[sA])); if (a && isNum(row[sA + 1])) a.audit = { total: row[sA + 1], pass: row[sA + 2], fail: row[sA + 3], ce: val(row[sA + 4]), emp: val(row[sA + 5]) }; }
          if (sD != null) { const a = byName.get(norm(row[sD])); if (a) a.dkbPA = { absent: row[sD + 1] || 0, present: row[sD + 2] || 0, total: val(row[sD + 3]), pct: val(row[sD + 4]) }; }
          if (sQ != null) { const a = byName.get(norm(row[sQ])); if (a) a.quizPh = { avg: val(row[sQ + 1]), mean: val(row[sQ + 2]), ph: [row[sQ + 3], row[sQ + 4], row[sQ + 5], row[sQ + 6]].map(val) }; }
        }
      }
    } else warnings.push('Sheet "Quality & DKB & Quiz Report" not found.');

    /* Escalation & FCR */
    const ef = S['Escalation Accuracy & FCR'];
    if (ef) {
      for (let r = 0; r < Math.min(ef.length, 3); r++) { const t = ef[r] && ef[r][0]; if (t && /escalation/i.test(String(t)) && /till|upto|up to/i.test(String(t))) { notes.esc = String(t).trim(); break; } }
      const hr = findRow(ef, (r) => r.some((x) => norm(x) === 'fcrcount'));
      if (hr >= 0) {
        const ci = {}; ef[hr].forEach((x, i) => { ci[norm(x)] = i; });
        for (let r = hr + 1; r < ef.length; r++) {
          const row = ef[r] || []; const a = byId.get(idKey(row[ci.id]));
          if (!a || (tl && norm(row[ci.tl]) !== norm(tl))) continue;
          a.fcrCalls = val(row[ci.callscount]); a.fcrCount = val(row[ci.fcrcount]);
        }
      }
    }

    /* ORT extras */
    const ort = S['ORT'];
    if (ort) {
      const hr = findRow(ort, (r) => norm(r[0]) === 'id' && norm(r[1]) === 'name', 5);
      if (hr >= 0) {
        const ci = {}; ort[hr].forEach((x, i) => { ci[norm(x)] = i; });
        for (let r = hr + 1; r < ort.length; r++) {
          const row = ort[r] || []; const a = byId.get(idKey(row[ci.id])); if (!a) continue;
          a.ort = { brkAch: val(row[ci.breakachievement]), plan: val(row[ci.plannedshrinkage]), unplan: val(row[ci.unplannedshrinkage]), cfs: val(row[ci.cfs]) };
        }
      }
    }

    /* Attendance by day (Schedule Attendance Raw) */
    const att = pick(S, ALIAS.att);
    agents.forEach((a) => { a.attRows = []; a.dkbRows = []; a.qa = []; a.sdRows = []; });
    if (att) {
      const hr = findRow(att, (r) => norm(r[0]) === 'rostercon', 5);
      if (hr >= 0) {
        const ci = {}; att[hr].forEach((x, i) => { if (!(norm(x) in ci)) ci[norm(x)] = i; });
        const dayIdx = new Map(dayDates.map((d, k) => [d.getTime(), k]));
        agents.forEach((a) => { a.cal = dayDates.map(() => null); a.calls = dayDates.map(() => 0); });
        for (let r = hr + 1; r < att.length; r++) {
          const row = att[r]; if (!row) continue;
          const a = byId.get(idKey(row[ci.id])); if (!a) continue;
          const d = row[ci.date]; if (!isNum(d)) continue;
          const rc = row[ci.rostercount] || 0, pc = row[ci.presentcount] || 0;
          const k = dayIdx.get(serialDate(d).getTime());
          if (k != null) { a.cal[k] = pc > 0 ? 'p' : (rc > 0 ? 'a' : 'o'); a.calls[k] = row[ci.acdcalls] || 0; }
          if (rc > 0) a.attRows.push({ d: Math.floor(d), sh: String(row[ci.roster] || ''), li: isNum(row[ci.logintime]) ? row[ci.logintime] : null, lo: isNum(row[ci.logouttime]) ? row[ci.logouttime] : null, st: isNum(row[ci.loginlogoutstatus]) ? row[ci.loginlogoutstatus] : 0, tr: isNum(row[ci.targetready]) ? row[ci.targetready] : null, rd: isNum(row[ci.readytime]) ? row[ci.readytime] : null, tb: isNum(row[ci.targetbreak]) ? row[ci.targetbreak] : null, bk: isNum(row[ci.breaktime]) ? row[ci.breaktime] : null, pc, calls: row[ci.acdcalls] || 0 });
        }
        agents.forEach((a) => a.attRows.sort((x, y) => x.d - y.d));
      }
    } else warnings.push('Attendance sheet (Schedule Attendance Raw) not found.');

    /* DKB attendance raw */
    const dk = pick(S, ALIAS.dkb);
    if (dk) {
      const hr = findRow(dk, (r) => norm(r[0]) === 'date' && norm(r[1]) === 'id', 5);
      if (hr >= 0) {
        const ci = {}; dk[hr].forEach((x, i) => { if (!(norm(x) in ci)) ci[norm(x)] = i; });
        for (let r = hr + 1; r < dk.length; r++) {
          const row = dk[r]; if (!row) continue;
          const a = byId.get(idKey(row[ci.id])); if (!a || !isNum(row[ci.date])) continue;
          const stt = String(row[ci.status] || '').trim();
          a.dkbRows.push({ d: Math.floor(row[ci.date]), s: /^present$/i.test(stt) ? 'P' : /^absent$/i.test(stt) ? 'A' : stt, lob: String(row[ci.lob] || ''), tl: String(row[ci.tl] || ''), role: String(row[ci.role] || ''), cat: String(row[ci.category] || '') });
        }
        agents.forEach((a) => a.dkbRows.sort((x, y) => x.d - y.d));
      }
    } else warnings.push('DKB attendance raw sheet not found.');

    /* Quality Raw (audit calls) */
    const qr = pick(S, QNAMES);
    if (qr && qr[0]) {
      const H = qr[0]; const first = {}; H.forEach((x, i) => { const k = norm(x); if (k && !(k in first)) first[k] = i; });
      const g = (k) => first[norm(k)];
      const params = []; H.forEach((x, i) => { if (typeof x === 'string' && /^\d+\.\d+\s/.test(x)) params.push({ i, n: x.trim() }); });
      const byVdi = new Map(agents.filter((a) => a.vdi).map((a) => [norm(a.vdi), a]));
      const T = (row, k) => { const i = g(k); const v = i == null ? null : row[i]; return v == null ? '' : String(v).trim(); };
      const N = (row, k) => { const i = g(k); const v = i == null ? null : row[i]; return isNum(v) ? v : (v != null && /^-?\d+(\.\d+)?$/.test(String(v).trim()) ? parseFloat(v) : 0); };
      const cmt = (row, i, v) => { for (const j of [i + 2, i + 1]) { const t = row[j]; if (t != null && String(t).trim() !== '' && String(t).trim() !== String(v).trim()) return String(t).trim(); } return ''; };
      const pv = (row, rx) => { const p = params.find((q) => rx.test(q.n)); return p ? { v: row[p.i], c: cmt(row, p.i, row[p.i]), n: p.n } : null; };
      const splitRem = (t) => { let ce = [], nce = []; String(t || '').split(/\r?\n+/).forEach((ln) => { const x = ln.trim(); if (!x) return; if (/^non[\s-]*ce\s*:/i.test(x)) nce.push(x.replace(/^non[\s-]*ce\s*:\s*/i, '')); else if (/^ce\s*:/i.test(x)) ce.push(x.replace(/^ce\s*:\s*/i, '')); else if (ce.length && !nce.length) ce.push(x); else if (nce.length) nce.push(x); else nce.push(x); }); return { ceTxt: ce.join(' | '), nceTxt: nce.join(' | ') }; };
      let unmatched = 0;
      for (let r = 1; r < qr.length; r++) {
        const row = qr[r]; if (!row) continue;
        const a = byVdi.get(norm(T(row, 'VDI ID'))) || byName.get(norm(T(row, 'Agent Name')));
        if (!a) { unmatched++; continue; }
        const t = row[g('Local End Time')];
        const fp = [], emp = [];
        params.forEach((p) => { const v = row[p.i]; if (v === 'Fail' && /^[1-7]\./.test(p.n)) { const o = { n: p.n, c: cmt(row, p.i, v) }; fp.push(o); if (/^1\.[1-8]\s/.test(p.n)) emp.push(o); } });
        const r71 = pv(row, /^7\.1\s/), r72 = pv(row, /^7\.2\s/), r73 = pv(row, /^7\.3\s/);
        a.qa.push({
          t: isNum(t) ? t : null, ym: isNum(t) ? ymOf(t) : '', ani: T(row, 'ANI'), cid: T(row, 'Call ID String'), form: T(row, 'Form'),
          score: N(row, 'Evaluation Score'), pf: T(row, 'Pass or Fail'), ce: T(row, 'Critical Error'), topic: T(row, 'Topic'), rem: T(row, 'Error Remarks'),
          cd: T(row, 'Contact Date'), ed: T(row, 'Eval Date'), tl: T(row, 'Team Leader'), qa: T(row, 'QA'), auditor: T(row, 'Auditor'), party: T(row, 'Audit Party'),
          ep: N(row, 'Total Emp Parameter Pass Count'), ef: N(row, 'Total Emp Parameter Fail Count'), rtc: T(row, 'RTC'),
          cm: T(row, 'Audit Comments'), fp, emp, ...splitRem(T(row, 'Error Remarks')),
          rt: { c: r71 ? r71.c : '', kept: r72 ? r72.v : null, ok: r73 ? r73.v : null },
        });
      }
      agents.forEach((a) => a.qa.sort((x, y) => (y.t || 0) - (x.t || 0)));
    } else warnings.push('Sheet "CE & NCE & RTC Raw" not found: CE / NCE / empathy / RTC call details will be empty.');

    /* Service Delivery Raw (complaints) */
    const sdS = pick(S, SDNAMES);
    if (sdS && sdS[0]) {
      const H = sdS[0]; const ix = {}; H.forEach((x, i) => { const k = norm(x); if (k && !(k in ix)) ix[k] = i; });
      const gi = (k) => ix[norm(k)];
      const byVdiSd = new Map(agents.filter((a) => a.vdi).map((a) => [norm(a.vdi), a]));
      const T = (row, k) => { const i = gi(k); const v = i == null ? null : row[i]; return v == null ? '' : String(v).trim(); };
      for (let r = 1; r < sdS.length; r++) {
        const row = sdS[r]; if (!row) continue;
        const a = byId.get(idKey(row[gi('ID')])) || byVdiSd.get(norm(T(row, 'Complaint against (Agent ID/Name)'))); if (!a) continue;
        const inc = row[gi('Incident date')];
        a.sdRows.push({
          mo: T(row, 'Month'), sts: T(row, 'STS ticket'), cust: T(row, 'Customer Number'), rcv: T(row, 'Complaint received date'),
          fl: T(row, "Frontliner's Comment"), cm: T(row, "Complaint mgt. agent's comment"), inc: isNum(inc) ? inc : null,
          against: T(row, 'Complaint against (Agent ID/Name)'), id: T(row, 'ID'), tl: T(row, 'TL name'), qa: T(row, 'QA Name'), ten: T(row, 'Tenure'), aon: T(row, 'AON'), site: T(row, 'Site'), skill: T(row, 'Hotline Agents Skill'),
          find: T(row, 'Incident Findings from line function'), val: T(row, 'Complaint Validation (Valid/Invalid)'), by: T(row, 'Service delivery Error By (Agent/Non Agent)'),
          cat: T(row, 'Service Gap Category'), sub: T(row, 'Service Gap Sub Category'), root: T(row, 'Root Cause Detail (Line function)'), act: T(row, 'Action Taken'), fin: T(row, 'Financial Impact'), topic: T(row, 'Topic'),
        });
      }
    } else warnings.push('Sheet "Service Delivery Raw" not found: service delivery complaint details will be empty.');

    const byVdiAll = new Map(agents.filter((a) => a.vdi).map((a) => [norm(a.vdi), a]));
    /* optional contact sheet: Genex ID / EID + mobile number */
    agents.forEach((a) => { a.mobile = ''; });
    const cs = pick(S, CNAMES);
    if (cs && cs.length) {
      let hr = 0; for (let r = 0; r < Math.min(6, cs.length); r++) if ((cs[r] || []).some((x) => /mobile|phone|mbl|contact/i.test(String(x || '')))) { hr = r; break; }
      const H = (cs[hr] || []).map((x) => String(x || ''));
      const mi = H.findIndex((x) => /mobile|phone|mbl|contact/i.test(x));
      const ids = H.map((x, i) => (/gnx|genex|eid|employee|^id$/i.test(x) ? i : -1)).filter((i) => i >= 0);
      if (mi >= 0 && ids.length) for (let r = hr + 1; r < cs.length; r++) {
        const row = cs[r]; if (!row) continue;
        const a = ids.map((i) => byId.get(idKey(row[i])) || byVdiAll.get(norm(row[i]))).find(Boolean); if (!a) continue;
        const m = row[mi]; if (m != null && String(m).trim()) a.mobile = fmtMobile(m);
      }
    }


    /* Escalation Accuracy Raw (valid / invalid tickets per agent, matched on TicketCreatedBy = Genex ID) */
    agents.forEach((a) => { a.escRows = []; });
    const eS = S['Escalation Accuracy Raw'];
    if (eS && eS[0]) {
      const H = eS[0]; const ix = {}; H.forEach((x, i) => { const k = norm(x); if (k && !(k in ix)) ix[k] = i; });
      const T = (row, k) => { const i = ix[norm(k)]; const v = i == null ? null : row[i]; return v == null || (typeof v === 'object') ? '' : String(v).trim(); };
      for (let r = 1; r < eS.length; r++) {
        const row = eS[r]; if (!row) continue;
        const a = byVdiAll.get(norm(T(row, 'TicketCreatedBy'))); if (!a) continue;
        const d = row[ix[norm('TicketCreatedDate')]];
        a.escRows.push({ tid: T(row, 'TicketId'), ms: T(row, 'MSISDN'), cat: T(row, 'Category'), sub: T(row, 'SubCategory'), st: T(row, 'TicketStatus'), t: isNum(d) ? d : null, by: T(row, 'TicketCreatedBy'), ch: T(row, 'ChannelName'), sc: T(row, 'SubChannelName'), acc: T(row, 'EscalationAccuracy'), fl: T(row, 'FrontLineComments').replace(/\r/g, '').slice(0, 900) });
      }
      agents.forEach((a) => a.escRows.sort((x, y) => (y.t || 0) - (x.t || 0)));
    } else warnings.push('Sheet "Escalation Accuracy Raw" not found: escalation invalid-ticket details will be empty.');

    /* Salary Data: two blocks side by side. "Previous Cycle" = Date, ID, Skill, Name, Roster, Payroll Updated, Break, Total (+ a KPI-bucket table of the month before),
       "Current Running Cycle" = the same columns for the cycle that is still running. Everything is found by its header text, so a moved column does not break the reader. */
    let salary = null;
    const sS = S['Salary Data'];
    if (sS && sS.length) {
      const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const hr = findRow(sS, (r) => r.some((v, c) => norm(v) === 'date' && norm(r[c + 1]) === 'id'), 10);
      const hdr = hr >= 0 ? sS[hr] : [];
      const blocks = []; hdr.forEach((v, c) => { if (norm(v) === 'date' && norm(hdr[c + 1]) === 'id') blocks.push(c); });
      const colOf = (c0, key, dflt) => { for (let c = c0; c < c0 + 10; c++) if (norm(hdr[c]) === key) return c; return c0 + dflt; };
      /* KPI bucket of the previous month (small table: ID, Name, TL, Agent-Skill, Category) */
      let kr = -1, kc = -1, kTitle = '';
      for (let r = 0; r < Math.min(sS.length, 12) && kr < 0; r++) { const x = sS[r] || []; for (let c = 0; c < x.length; c++) if (norm(x[c]) === 'id' && norm(x[c + 1]) === 'name' && norm(x[c + 2]) === 'tl') { kr = r; kc = c; break; } }
      const cat = new Map();
      if (kr >= 0) {
        const hx = sS[kr]; let sk = kc + 3, bk = kc + 4;
        for (let c = kc; c < kc + 8; c++) { const n = norm(hx[c]); if (n === 'agentskill' || n === 'skill') sk = c; if (n === 'category' || n === 'bucket' || n === 'grade') bk = c; }
        for (let r = 0; r < kr; r++) { const t = sS[r] && sS[r][kc]; if (t && /kpi/i.test(String(t))) kTitle = String(t); }
        for (let r = kr + 1; r < sS.length; r++) { const x = sS[r]; if (!x || x[kc] == null || x[kc] === '') break; cat.set(idKey(x[kc]), { skill: String(x[sk] || '').trim(), bucket: String(x[bk] || '').trim().toUpperCase() }); }
      }
      const hrs = (v) => (isNum(v) ? Math.round(v * 24 * 10000) / 10000 : 0);
      const toSer = (t) => Math.round((t - Date.UTC(1899, 11, 30)) / 864e5);
      /* a salary cycle runs from the 16th of one month to the 15th of the next */
      const cycleOf = (d0) => { const dt = serialDate(d0); const y = dt.getUTCFullYear(); let m = dt.getUTCMonth(); if (dt.getUTCDate() < 16) m -= 1; return { from: toSer(Date.UTC(y, m, 16)), to: toSer(Date.UTC(y, m + 1, 15)), m: new Date(Date.UTC(y, m, 16)).getUTCMonth() }; };
      const readBlock = (c0) => {
        const ci = { d: c0, id: colOf(c0, 'id', 1), sk: colOf(c0, 'skill', 2), ro: colOf(c0, 'roster', 4), pu: colOf(c0, 'payrollupdated', 5), br: colOf(c0, 'break', 6), tt: colOf(c0, 'total', 7) };
        const out = {}; let dmin = null, dmax = null, asOf = null;
        for (let r = hr + 1; r < sS.length; r++) {
          const x = sS[r]; if (!x || !isNum(x[ci.d])) continue;
          const a = byId.get(idKey(x[ci.id])); if (!a) continue;
          const d = Math.floor(x[ci.d]), tot = hrs(x[ci.tt]);
          const e = out[a.id] || (out[a.id] = { sheetSkill: '', rows: [] });
          if (!e.sheetSkill && x[ci.sk]) e.sheetSkill = String(x[ci.sk]).trim();
          e.rows.push([d, String(x[ci.ro] == null ? '' : x[ci.ro]).trim(), hrs(x[ci.pu]), hrs(x[ci.br]), tot]);
          dmin = dmin == null ? d : Math.min(dmin, d); dmax = dmax == null ? d : Math.max(dmax, d);
          if (tot > 0) asOf = asOf == null ? d : Math.max(asOf, d);
        }
        Object.values(out).forEach((e) => e.rows.sort((p, q) => p[0] - q[0]));
        return { out, dmin, dmax, asOf };
      };
      const mm = /kpi\s+of\s+([a-z]+)\s+for\s+([a-z]+)/i.exec(kTitle);
      const prevB = blocks.length ? readBlock(blocks[0]) : null, curB = blocks.length > 1 ? readBlock(blocks[1]) : null;
      let prev = null, cur = null;
      if (prevB && prevB.dmin != null) {
        const cy = cycleOf(prevB.dmin), ag = {};
        agents.forEach((a) => { const b = prevB.out[a.id], c = cat.get(a.id); if (!b && !c) return; ag[a.id] = { id: a.id, name: a.name, skill: (c && c.skill) || (b && b.sheetSkill) || '', bucket: (c && c.bucket) || '', rows: b ? b.rows : [] }; });
        prev = { from: prevB.dmin, to: prevB.dmax, asOf: prevB.asOf, cycleFrom: cy.from, cycleTo: cy.to, kpiMonth: mm ? mm[1] : MN[cy.m], salaryMonth: mm ? mm[2] : MN[(cy.m + 1) % 12], agents: ag };
      }
      if (curB && curB.dmin != null) {
        const cy = cycleOf(curB.dmin), ag = {};
        /* draft rule: everyone is paid at the Premium rate, and the KPI part uses the CURRENT month's KPI grade of the KPI sheet */
        agents.forEach((a) => { const b = curB.out[a.id]; ag[a.id] = { id: a.id, name: a.name, skill: 'Premium', sheetSkill: (b && b.sheetSkill) || '', bucket: String(a.cat || a.bucket || '').trim().toUpperCase(), kpi: isNum(a.final) ? a.final : null, rows: b ? b.rows : [] }; });
        cur = { from: curB.dmin, to: curB.dmax, asOf: curB.asOf, cycleFrom: cy.from, cycleTo: cy.to, kpiMonth: MN[cy.m], salaryMonth: MN[(cy.m + 1) % 12], draft: true, agents: ag };
      }
      if (prev || cur) salary = { v: 2, base: { Premium: 57, Mass: 50 }, bonus: { 'A+': 10, A: 10, B: 8, C: 5, D: 0 }, prev, cur };
      else warnings.push('Sheet "Salary Data" was found but no KPI agents matched.');
    }
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d0 = dayDates[0];
    return {
      v: 2, fileName: fileName || '', tl, notes, warnings, ym: d0 ? ymOf(Math.round((d0.getTime() - Date.UTC(1899, 11, 30)) / 864e5)) : '',
      month: d0 ? months[d0.getUTCMonth()] + ' ' + d0.getUTCFullYear() : '',
      days: dayDates.map((d) => d.getUTCDate()),
      agents, salary,
    };
  }

  async function processFile(u8, password, JSZip, onProgress, fileName) {
    let data = u8;
    if (isOle(u8)) {
      if (!password) throw new Error('NEED_PASSWORD');
      data = await decryptFile(u8, password, onProgress);
    }
    if (!(data[0] === 0x50 && data[1] === 0x4b)) throw new Error('This does not look like an .xlsx workbook.');
    const { sheets } = await readSheets(data, SHEETS, JSZip);
    if (onProgress) onProgress(1);
    const team = parseTeam(sheets, fileName);
    const ps = sheets['Punch Data'];
    if (ps && ps.length > 1) { try { const pr = { rows: punchRowsFromTable(ps), file: 'Punch Data sheet' }; applyPunch(team, pr); } catch (e) { team.warnings.push('Punch Data sheet could not be read: ' + e.message); } }
    return team;
  }
  /* the salary data is sealed in its own file that only the admin login can open */
  function splitSalary(data) { const salary = data.salary || null; const main = Object.assign({}, data); delete main.salary; return { main, salary }; }


  /* ---------- punch data (separate CSV / Excel file) ---------- */
  function csvParse(text) {
    const rows = []; let row = [], cur = '', q = false;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  const toSerial = (v) => {
    if (isNum(v)) return v;
    const t = String(v == null ? '' : v).trim(); if (!t || t === '-') return null;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t) || null;
    if (m) return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 864e5 + ((+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) / 86400;
    const n = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
    if (n) return (Date.UTC(+n[3], +n[2] - 1, +n[1]) - Date.UTC(1899, 11, 30)) / 864e5 + ((+n[4] || 0) * 3600 + (+n[5] || 0) * 60 + (+n[6] || 0)) / 86400;
    return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
  };
  async function firstSheetRows(u8, password, JSZip) {
    let data = u8;
    if (isOle(u8)) { if (!password) throw new Error('NEED_PASSWORD'); data = await decryptFile(u8, password); }
    const zip = await JSZip.loadAsync(data); const wb = await zip.file('xl/workbook.xml').async('string');
    const m = /<sheet [^>]*name="([^"]*)"/.exec(wb); if (!m) throw new Error('No sheet found in the punch workbook.');
    const name = m[1].replace(/&amp;/g, '&');
    const { sheets } = await readSheets(data, [name], JSZip);
    return sheets[name] || [];
  }
  function punchRowsFromTable(table) {
    let hr = table.findIndex((r) => r && r.some((x) => norm(x) === 'gnxid' || norm(x) === 'genexid' || norm(x) === 'eid'));
    if (hr < 0) throw new Error('This does not look like the punch file (no "Gnx ID" column found).');
    const H = table[hr].map((x) => norm(x)); const ix = (...ns) => { for (const n of ns) { const i = H.indexOf(norm(n)); if (i >= 0) return i; } return -1; };
    const c = { id: ix('Gnx ID', 'Genex ID', 'EID'), name: ix('Name'), date: ix('Date'), roster: ix('Final Roster', 'Roster'), fp: ix('First Punch Date & Time', 'First Punch'), lp: ix('Last Punch Date & Time', 'Last Punch'), dur: ix('Login Duration'), pc: ix('Punch Count'), st: ix('Status'), ot: ix('Ontime Arrival'), site: ix('Site'), lob: ix('LOB'), role: ix('Role'), proc: ix('Process') };
    if (c.date < 0) throw new Error('The punch file has no Date column.');
    const g = (r, k) => (c[k] >= 0 && r[c[k]] != null ? String(r[c[k]]).trim() : '');
    const rows = [];
    for (let r = hr + 1; r < table.length; r++) {
      const row = table[r]; if (!row || !row.length) continue;
      const d = toSerial(row[c.date]); if (d == null) continue;
      rows.push({ id: idNorm(row[c.id]), d: Math.floor(d), sh: g(row, 'roster'), fi: toSerial(row[c.fp]), la: toSerial(row[c.lp]), dur: g(row, 'dur'), pc: +g(row, 'pc') || 0, st: g(row, 'st'), ot: g(row, 'ot'), site: g(row, 'site'), lob: g(row, 'lob'), role: g(row, 'role'), nm: g(row, 'name') });
    }
    return rows;
  }
  /* returns { rows: [{...}], file } with raw header-keyed objects */
  async function readPunchFile(u8, fileName, password, JSZip) {
    let table;
    if (u8[0] === 0x50 && u8[1] === 0x4b || isOle(u8)) table = await firstSheetRows(u8, password, JSZip);
    else table = csvParse(new TextDecoder('utf-8').decode(u8));
    return { rows: punchRowsFromTable(table), file: fileName || '' };
  }
  const idNorm = (v) => (isNum(v) ? String(Math.round(v)) : String(v == null ? '' : v).trim());
  /* attach punch rows to KPI agents only (KPI sheet is the eligibility filter) */
  function applyPunch(data, pr) {
    const byId = new Map(data.agents.map((a) => [a.id, a])); let matched = 0, rows = 0, dmin = null, dmax = null;
    data.agents.forEach((a) => { a.punch = []; });
    pr.rows.forEach((r) => {
      const a = byId.get(r.id); if (!a) return; rows++;
      a.punch.push({ d: r.d, sh: r.sh, fi: r.fi, la: r.la, dur: r.dur, pc: r.pc, st: r.st, ot: r.ot });
      if (r.site) a.site = r.site; if (r.lob) a.lob = r.lob; if (r.role) a.role = r.role;
      dmin = dmin == null ? r.d : Math.min(dmin, r.d); dmax = dmax == null ? r.d : Math.max(dmax, r.d);
    });
    data.agents.forEach((a) => { a.punch.sort((x, y) => x.d - y.d); if (a.punch.length) matched++; });
    data.punchInfo = { file: pr.file, at: new Date().toISOString(), rows, agents: matched, from: dmin, to: dmax };
    return data.punchInfo;
  }

  /* ---------- Vault (login-protected data file) ---------- */
  const VAULT_ITER = 100000;
  const normId = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  async function deriveKey(id, pass, saltB64) {
    const base = await crypto.subtle.importKey('raw', te.encode(normId(id) + '\u0000' + pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(saltB64), iterations: VAULT_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  const pipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
  async function vaultEncrypt(obj, key, saltB64) {
    const raw = await pipe(te.encode(JSON.stringify(obj)), new CompressionStream('gzip'));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw));
    return { v: 1, kdf: 'PBKDF2-SHA256', iter: VAULT_ITER, salt: saltB64, iv: toB64(iv), ct: toB64(ct) };
  }
  async function vaultDecrypt(file, key) {
    let pt;
    try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(file.iv) }, key, b64(file.ct))); } catch (e) { throw new Error('WRONG_CREDENTIALS'); }
    return JSON.parse(new TextDecoder().decode(await pipe(pt, new DecompressionStream('gzip'))));
  }
  const newSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)));

  /* v2 vault: one random data key encrypts the data; every login gets its own wrapped copy of that key. */
  const sha256hex = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(t)))).map((x) => x.toString(16).padStart(2, '0')).join('');
  const slotName = (id) => sha256hex('te-user:' + normId(id));
  async function vaultSeal(obj, users) {
    const dk = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const raw = await pipe(te.encode(JSON.stringify(obj)), new CompressionStream('gzip'));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dk, raw));
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', dk));
    const slots = {};
    for (const u of users) {
      const salt = newSalt(); const k = await deriveKey(u.id, u.pass, salt); const siv = crypto.getRandomValues(new Uint8Array(12));
      slots[await slotName(u.id)] = { salt, iv: toB64(siv), ct: toB64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: siv }, k, rawKey))) };
    }
    return { v: 2, iv: toB64(iv), ct: toB64(ct), slots };
  }
  async function vaultOpen(file, id, pass) {
    const sl = file.slots && file.slots[await slotName(id)];
    if (!sl) throw new Error('WRONG_CREDENTIALS');
    let rawKey;
    try { rawKey = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(sl.iv) }, await deriveKey(id, pass, sl.salt), b64(sl.ct)); } catch (e) { throw new Error('WRONG_CREDENTIALS'); }
    const dk = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    return vaultDecrypt(file, dk);
  }
  const exportKey = async (key) => toB64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
  const importKey = (b) => crypto.subtle.importKey('raw', b64(b), 'AES-GCM', true, ['encrypt', 'decrypt']);
  return { splitSalary, readPunchFile, applyPunch, csvParse, processFile, parseTeam, readSheets, decryptFile, isOle, SHEETS, deriveKey, vaultEncrypt, vaultDecrypt, vaultSeal, vaultOpen, normId, newSalt, exportKey, importKey };
})();
if (typeof module !== 'undefined') module.exports = Core;
