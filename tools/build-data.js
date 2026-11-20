#!/usr/bin/env node
/* Build data/data.enc.json from the KPI workbook without a browser.
   Usage: node tools/build-data.js <workbook.xlsx> <excel-password> [login-id] [login-password]
   Needs Node 18+ (no npm install required: JSZip is bundled in js/jszip.min.js). */
const fs = require('fs'), path = require('path');
const JSZip = require(path.join(__dirname, '..', 'js', 'jszip.min.js'));
const Core = require(path.join(__dirname, '..', 'js', 'core.js'));
(async () => {
  const [file, pw, id = 'Team Empire', pass = '0000'] = process.argv.slice(2);
  if (!file) { console.log('Usage: node tools/build-data.js <workbook.xlsx> <excel-password> [login-id] [login-password]'); process.exit(1); }
  const out = path.join(__dirname, '..', 'data', 'data.enc.json');
  let prev = null;
  try { const v = JSON.parse(fs.readFileSync(out, 'utf8')); prev = await Core.vaultDecrypt(v, await Core.deriveKey(id, pass, v.salt)); } catch (e) { /* first run */ }
  const data = await Core.processFile(new Uint8Array(fs.readFileSync(file)), pw || '', JSZip, () => {}, path.basename(file));
  data.at = new Date().toISOString();
  data.hist = ((prev && prev.hist) || []).concat([{ t: data.at, month: data.month, n: data.agents.length, avg: data.agents.reduce((s, a) => s + (a.final || 0), 0) / data.agents.length }]).slice(-30);
  const salt = Core.newSalt();
  const vault = await Core.vaultEncrypt(data, await Core.deriveKey(id, pass, salt), salt);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(vault));
  console.log('Wrote', out, '·', data.agents.length, 'agents ·', data.month, '·', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  if (data.warnings.length) console.log('Warnings:', data.warnings.join(' | '));
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
