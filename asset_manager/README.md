# Asset Manager · የንብረት መዝገብ

Simple mobile-first app to manage livestock (cattle, sheep, goats, other animals) and property.
Amharic (default) + English. Installable on the phone home screen (PWA).

## Features
- **Dashboard**: KPIs for cattle / sheep / goats (head count), total initial cost, forecast value + expected gain
- **Livestock records** (CRUD): date, receiver (who keeps the animals), phone, specific location,
  animal + type (calf, weaner, yearling, heifer, cow, bull, steer, bullock/ox; lamb, ewe, ram…; kid, doe, buck…),
  quantity, buy price, forecast value, status (with receiver / back home / sold / died), photo (camera or gallery), notes
- **Property** (CRUD): land, house, vehicle, equipment, crop, other — name, location, value, photo
- Search + filter, export to Excel (CSV), Ethiopian calendar dates in Amharic mode
- PIN login, photos auto-compressed on the phone, last data still visible without internet
- Only KPIs for animals that are still owned (with receiver / back home); sold and dead are excluded

## Stack
React 18 + Vite (frontend) · Express + built-in Node SQLite (backend, no native modules) · Node **22.13+**

```
server/index.js        API + serves built app
src/                   React app (App.jsx, components/, i18n.js = all EN/AM texts)
public/                manifest, service worker, icons
deploy/                Caddyfile, systemd service, backup script
data/                  (created at runtime) asset_manager.db + uploads/  ← back this up
```

## Run locally
```bash
npm install
npm run dev          # web http://localhost:5173 (+ API on 3001), PIN 1234
```
Production mode locally:
```bash
npm run build
APP_PIN=2580 npm start   # http://localhost:3001
```

## Deploy (Ubuntu 24.04 VPS)
1. Point a domain (or free DuckDNS subdomain) A-record to the server IP.
2. On the server:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs sqlite3 caddy git
   sudo useradd -r -m -d /opt/asset_manager assetapp
   sudo git clone <repo-url> /tmp/repo && sudo cp -r /tmp/repo/asset_manager/. /opt/asset_manager/
   cd /opt/asset_manager && sudo npm ci && sudo npm run build && sudo chown -R assetapp: /opt/asset_manager
   ```
3. Service: edit `APP_PIN` in `deploy/asset-manager.service`, then
   ```bash
   sudo cp deploy/asset-manager.service /etc/systemd/system/
   sudo systemctl enable --now asset-manager
   ```
4. HTTPS: put your domain in `deploy/Caddyfile`, then
   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
   ```
5. Firewall: `sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable`
6. Backups: `sudo crontab -e` → `0 2 * * * /opt/asset_manager/deploy/backup.sh`

On the phone: open `https://your-domain` in Chrome → menu ⋮ → **Install app / Add to Home screen**
(or the “⬇ መተግበሪያ ጫን” button in the app).

Update later: `git pull`, copy files, `npm ci && npm run build`, `sudo systemctl restart asset-manager`.
