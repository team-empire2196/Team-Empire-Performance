# Team Empire Performance Hub

A static dashboard (no server, no build step) for GitHub Pages. Sign in with **ID `Team Empire` / Password `0000`**.

## 1. Put it online (one time)
1. On github.com create a new **public** repository (e.g. `team-empire`).
2. Upload **everything in this folder** (drag and drop into the repo; keep the folder structure, including the hidden `.nojekyll` file).
3. Repo **Settings → Pages → Build from branch → `main` / root → Save**.
4. After a minute the site is live at `https://<your-username>.github.io/team-empire/`.

## 2. Update every time (your Excel)
1. Open the site, sign in, press **Update Data**.
2. Choose the new Excel, password `2196`, press **Read file**.
3. Press **Publish to GitHub** (needs a one-time token, below). Everyone sees the new numbers about a minute later.
   - No token? Press **Download data file**, then upload that `data.enc.json` into the repo's `data` folder (replace the old one).

**Create the token once:** GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained* → only this repository → Permissions: **Contents: Read and write**. Paste it in the Update window each time (it is never stored).

Without a browser: `node tools/build-data.js KPI.xlsx 2196` rewrites `data/data.enc.json`.

## 3. Photos
Photos are matched by **EID** and only shown for agents on the KPI sheet. To add or replace a photo: put `<EID>.jpg` in `photos/` and add one line to `photos/map.json`, e.g. `"20309403": "20309403.jpg"`. Agents without a photo get a default avatar.

## 4. Which Excel sheets feed what
| Sheet | Used for |
|---|---|
| KPI | Agent list (the only eligibility filter), scores, grades |
| CE & NCE & RTC Raw | CE %, NCE %, Empathy, RTC call lists with reasons |
| Service Delivery Raw | Service delivery complaints per agent |
| Schedule Attendance Raw | Attendance breakdown |
| dkb attedance raw | DKB present/absent, calendar |
| Day Wise AHT / CFS Tracker, Escalation & FCR, ORT, Quality & DKB & Quiz Report | Daily AHT/CFS, FCR, break, quiz |

## Honest notes
- The login is client-side. The data file is encrypted with a key derived from the ID and password, which keeps it out of casual view, but a 4-digit password can be guessed offline. Use a longer password if the data is sensitive (change it in `js/app.js` `CONFIG`, and the same value when publishing). Photos in `photos/` are public to anyone who knows the URL.
- Audit rows only appear for months present in the raw sheets; the site says so when the raw sheet is older than the KPI month.
