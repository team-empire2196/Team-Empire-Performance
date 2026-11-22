#!/usr/bin/env node
/* Build data/data.enc.json from the KPI workbook without a browser.
   Usage: node tools/build-data.js <workbook.xlsx> <excel-password> [admin-id] [admin-password] [agent-password] [punch-file]
   Logins created: the admin (default "Team Empire" / "0000") and every agent on the KPI sheet
   (ID = Genex ID from the "Day Wise CFS Tracker" sheet, password = agent-password, default "1234").
   Needs Node 18+ (JSZip is bundled in js/jszip.min.js). Also writes login-list.csv (keep it private). */
const fs = require('fs'), path = require('path');
const JSZip = require(path.join(__dirname, '..', 'js', 'jszip.min.js'));
const Core = require(path.join(__dirname, '..', 'js', 'core.js'));
(async () => {
  const [file, pw, adminId = 'Team Empire', adminPass = '0000', agentPass = '1234', punchFile] = process.argv.slice(2);
  if (!file) { console.log('Usage: node tools/build-data.js <workbook.xlsx> <excel-password> [admin-id] [admin-password] [agent-password]'); process.exit(1); }
  const out = path.join(__dirname, '..', 'data', 'data.enc.json');
  let prev = null;
  try { prev = await Core.vaultOpen(JSON.parse(fs.readFileSync(out, 'utf8')), adminId, adminPass); } catch (e) { /* first run */ }
  const data = await Core.processFile(new Uint8Array(fs.readFileSync(file)), pw || '', JSZip, () => {}, path.basename(file));
  data.at = new Date().toISOString();
  const oldBy = new Map(((prev && prev.agents) || []).map((a) => [a.id, a]));
  data.agents.forEach((a) => { const o = oldBy.get(a.id); if (o) { if (!a.mobile && o.mobile) a.mobile = o.mobile; if (!a.otp && o.otp) a.otp = o.otp; if (!data.punchInfo) a.punch = o.punch || []; } });
  if (prev && prev.punchInfo && !data.punchInfo) data.punchInfo = prev.punchInfo;
  if (process.env.CONTACTS) { const C = JSON.parse(fs.readFileSync(process.env.CONTACTS, 'utf8')); data.agents.forEach((a) => { const c = C[a.id]; if (c) { if (c.mobile) a.mobile = c.mobile; if (c.otp) a.otp = c.otp; } }); console.log('Contacts applied'); }
  if (punchFile) { const pr = await Core.readPunchFile(new Uint8Array(fs.readFileSync(punchFile)), path.basename(punchFile), '', JSZip); console.log('Punch:', JSON.stringify(Core.applyPunch(data, pr))); }
  data.hist = ((prev && prev.hist) || []).concat([{ t: data.at, month: data.month, n: data.agents.length, avg: data.agents.reduce((s, a) => s + (a.final || 0), 0) / data.agents.length }]).slice(-30);
  const users = [{ id: adminId, pass: adminPass }].concat(data.agents.filter((a) => a.vdi).map((a) => ({ id: a.vdi, pass: agentPass })));
  const sp = Core.splitSalary(data); const salary = sp.salary || (prev && prev.salaryData) || null;
  const vault = await Core.vaultSeal(sp.main, users);
  if (salary) { fs.writeFileSync(path.join(path.dirname(out), 'salary.enc.json'), JSON.stringify(await Core.vaultSeal(salary, [{ id: adminId, pass: adminPass }]))); console.log('Salary data sealed for the admin only: previous cycle', salary.prev ? Object.keys(salary.prev.agents).length : 0, 'agents · current draft', salary.cur ? Object.keys(salary.cur.agents).length : 0, 'agents'); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(vault));
  const rows = [['Agent', 'EID', 'Login ID (Genex ID)', 'Password']].concat(data.agents.map((a) => [a.name, a.id, a.vdi || '(no Genex ID found)', a.vdi ? agentPass : '']));
  fs.writeFileSync(path.join(__dirname, '..', '..', 'login-list.csv'), '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'));
  console.log('Wrote', out, '·', data.agents.length, 'agents,', users.length, 'logins ·', data.month, '·', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  if (data.warnings.length) console.log('Warnings:', data.warnings.join(' | '));
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
