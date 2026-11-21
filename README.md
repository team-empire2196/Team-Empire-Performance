# Team Empire Performance Hub

A static dashboard (no server, no build step) for GitHub Pages.

## Logins
- **Team lead (admin):** ID `Team Empire`, password `0000`. Only the admin sees **Update Data**.
- **Each agent:** ID = their **Genex ID** (from the Day Wise CFS Tracker sheet, e.g. `genex.surma`), password `1234`. They land on their own My Performance page and can still browse the team pages. The full list is in `login-list.csv` (share it privately; do not upload it to the repo).
- Agents can change their password with the key button at the top. **It is saved in that browser only**, so on another phone or computer `1234` still applies. A password that works everywhere needs a small login server (e.g. Firebase), which GitHub Pages does not have.
- New agent on the KPI sheet with a Genex ID gets a login automatically at the next publish.

## Step-by-step guide (from zero)

### Part A. Put the dashboard online (one time, about 10 minutes)
1. Go to github.com and sign in (or create a free account).
2. Click **+ → New repository**. Name it `team-empire`, choose **Public**, press **Create repository**.
3. Unzip `team-empire-dashboard.zip` on your computer. Open the unzipped folder.
4. In the new repository click **Add file → Upload files**. Drag **everything inside the folder** (index.html, README.md, logo.png, css, js, data, photos, tools, and the hidden `.nojekyll` file) into the page. If your computer hides `.nojekyll`, it is fine to skip it, the site still works. Press **Commit changes**.
5. Open **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, press **Save**.
6. Wait one minute. Your site is at `https://YOUR-USERNAME.github.io/team-empire/`. Share this link with the team.

### Part B. Create the GitHub token (one time)
1. GitHub → your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `team-empire`. Expiration: 1 year. **Only select repositories** → `team-empire`.
3. Under *Permissions → Repository permissions* set **Contents: Read and write**. Press **Generate token** and copy it (you see it only once). Keep it somewhere safe, it is like a password.

### Part C. Every time you have new data (admin only)
1. Open the site and sign in with **Team Empire / 0000**. Only this login shows the **Update Data** button.
2. Press **Update Data**. Choose file 1 = **KPI Updated Team Empire** (.xlsx) and type the Excel password `2196`. Choose file 2 = **Punch Data** (.csv or .xlsx). You can upload just one of them; the other stays as it was.
3. Press **Read files**. Check the summary (agents, month, punch dates).
4. Paste the token, check Owner and Repo, press **Publish to GitHub**.
5. Done. Every agent who has the site open sees a "Data updated" message within about two minutes. Others see the new data when they next open the site.
   - No token? Press **Download data file** and upload that `data.enc.json` into the repo's `data` folder (replace the old one).

### Part D. The login list
- Every agent logs in with their **Genex ID** (e.g. `genex.surma`) and password **1234**. The list is made automatically from your KPI sheet and the "Day Wise CFS Tracker" sheet, and written to `login-list.csv` (it is NOT in the repo; keep it private and send each person their own line).
- A new agent added to the KPI sheet gets a login at the next publish. An agent without a Genex ID in the tracker sheet gets no login.
- Agents can change their password with the key button (saved in that browser only).

### Part E. Mobile numbers (My all Colleague Details)
Sign in as admin, open **My all Colleague Details** (last menu), type each number, press **Save and publish numbers**. Numbers are kept when you upload new Excel files. Alternative: add a sheet named `Colleague Details` to the KPI workbook with columns `EID` and `Mobile`.

### Part F. Punch file format
CSV or Excel with columns `Gnx ID, Name, Date, Final Roster, First Punch Date & Time, Last Punch Date & Time` (the standard export). Agents not on the KPI sheet are ignored.

Without a browser: `node tools/build-data.js KPI.xlsx 2196 "Team Empire" 0000 1234 Punch.csv`.

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
- The login is client-side. The data file is encrypted and each login holds its own key, which keeps the data out of casual view. But Genex IDs are easy to guess and `1234` is a short shared password, so treat this as a convenience gate, not strong security. Photos in `photos/` are public to anyone who knows the URL.
- Audit rows only appear for months present in the raw sheets; the site says so when the raw sheet is older than the KPI month.

## Welcome screen, TL photo and contacts
- After sign-in a welcome screen shows the Team Leader photo (`photos/tl.jpg`) with the 25 agents orbiting; press **Open Dashboard**. To change the TL photo, replace `photos/tl.jpg`; the name is `tlName` at the top of `js/app.js`.
- Contact numbers and CIM OTP numbers live only inside the encrypted data file (never as plain files in the repo). Admin edits them on **My all Colleague Details** and presses **Save and publish numbers**. OTP numbers are shown to the admin, and to each agent for their own row. Keep in mind the data is decrypted in every agent's browser, so a technical person could still read it; do not treat it as strong secrecy.

## Escalation, Punch Data and Salary Data (new)
- The workbook sheets **Escalation Accuracy Raw**, **Punch Data** and **Salary Data** are read automatically when you upload the KPI workbook. A separate Punch file is now optional (it overrides the Punch Data sheet).
- **Salary Data** is sealed in its own file `data/salary.enc.json` that only the admin login (Team Empire / 0000) can open. Agent logins cannot decrypt it. Publish uploads both files.
- Salary = payable hours (Total column = payroll + break) x (basic + KPI rate per hour). Premium basic 57, Mass basic 50. KPI per hour: A and A+ 10, B 8, C 5, D 0. The bucket comes from the "KPI Of October For November Salary Cycle" table in the Salary Data sheet. Rates are in `js/core.js` (`base`, `bonus`).
