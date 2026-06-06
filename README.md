# Cashflow Forecast

A privacy-first personal cashflow forecaster. Single HTML file, no backend, no dependencies, no tracking. Your financial data never leaves your device.

![status](https://img.shields.io/badge/data-stays%20local-success) ![deps](https://img.shields.io/badge/dependencies-none-blue) ![offline](https://img.shields.io/badge/offline-yes-brightgreen)

---

## What it is

A self-contained web app for forecasting month-to-month cashflow when your obligations are fragmented across loans, leases, installment plans, credit-card balances, and variable bills. It answers two questions most budgeting apps don't:

- **"What will actually be left after everything clears my account this month?"**
- **"When does my monthly load drop, and which debt should I attack first?"**

It runs as a single `index.html` you can open locally, host on GitHub Pages, or serve to your phone over a private network. There is no server, no account, and no database. All state lives in your browser.

## Why it exists

Fragmented autopay dates across many creditors make the cumulative monthly outflow hard to track, which is how "I make plenty" still ends a month near zero. This tool makes the full picture visible: every recurring bill, every installment plan with its real payoff date, credit-card balances with APR, and the gap between what *feels* available and what's actually uncommitted.

## Features

- **Four expense ledgers** — recurring bills, fixed installments, credit-card installment plans, and recurring card charges. Installments decrement automatically and drop off the month after their final payment.
- **Cash vs. credit separation** — money that leaves your checking (bills + ACH installments + your card payment) is tracked separately from spend that accrues to a card balance, so "remaining cash" reflects reality.
- **12-month projection** — a stacked forecast with your take-home as a reference line and the remaining-cash gap shown per month. Click any month to inspect it.
- **Variable bills** — categories like groceries, gas, and utilities carry an estimate for forecasting plus a per-month actual you log as bills land.
- **Post-dated bills** — schedule a future obligation (e.g. a loan resuming in the fall) so it appears only from its start month.
- **Payment calendar** — a day-by-day view of which bills hit on which dates, split into first-half / second-half of the month, with payday markers.
- **Credit-card payoff** — enter each card's balance, APR, and payment; the app ranks them by APR (avalanche order), shows monthly interest cost, and projects payoff time and total interest per card.
- **Toggle any item on/off** — model "what if I pause this" without deleting data.
- **Export / Import JSON** — portable backup and the mechanism for moving data between devices.

## Privacy & security model

This is the point of the project, not an afterthought:

- **No backend.** Nothing is transmitted anywhere. There is no server to breach.
- **No third-party code.** No CDNs, no web fonts, no analytics, no trackers. The app makes zero outbound network requests and runs fully offline using your device's native fonts.
- **Data is local-only.** All state is stored in the browser's `localStorage`, scoped to the origin serving the app. The published code contains only sample data. It does not contain anyone's finances.
- **No secrets.** The source holds no keys or credentials, so hosting it publicly leaks nothing.
- **You own the data lifecycle.** Export to a JSON file you control; import to restore. Backups are yours to encrypt and store as you see fit.

### Threat model & caveats (read before deploying publicly)

- **Same-origin storage on shared hosts.** `localStorage` is scoped by origin, not path. On GitHub Pages, every project under `username.github.io` shares one origin, so other pages you host there could read this app's storage. Host on a **dedicated custom domain** (or a separate account) to isolate it.
- **Device security is the boundary.** The app has no passcode; anyone with your unlocked device can open it. Rely on full-disk encryption (FileVault) and device lock.
- **Never commit real data.** Keep exported JSON out of the repository, see `.gitignore`. Committed data would be public and preserved in git history.
- **Storage can be evicted.** Browsers may purge `localStorage` for idle sites. Keep periodic JSON exports as your authoritative backup.

## Getting started

1. Open the app: visit your deployed URL, or open `index.html` directly in any modern browser.
2. Enter your monthly take-home at the top.
3. Fill in your bills, installment plans, and credit-card balances in each section.
4. For variable bills, set an estimate; log the real amount each month as it arrives.
5. Use **Export JSON** to back up, and **Import JSON** to restore or move to another device.

## Data, backup & multi-device

Data is stored per-browser and per-origin, it does **not** sync automatically between devices (by design, since nothing passes through a server). To move data between, say, a laptop and a phone:

1. **Export JSON** on the device with current data.
2. Move the file (AirDrop, cloud drive, etc.).
3. **Import JSON** on the other device.

Treat the exported JSON as both your backup and your sync mechanism.

## Deploy your own (GitHub Pages)

1. Create a repository and add `index.html` (and this `README.md`).
2. **Settings → Pages → Source: Deploy from a branch → `main` / root.**
3. Confirm **Enforce HTTPS** is enabled.
4. Your app is live at `https://<username>.github.io/<repo>/`.
5. *(Recommended)* Add a custom domain so the app gets its own origin and isolated storage.

## Optional: private access from your phone

To use it on a phone while keeping everything local (no public hosting), serve `index.html` from your computer and reach it over a private mesh VPN (e.g. Tailscale), then **Add to Home Screen** in mobile Safari for an app-like icon. The app is never exposed to the public internet in this mode.

## Tech

- Single `index.html` — HTML, CSS, and vanilla JavaScript in one file
- Hand-rolled SVG charts (no charting library)
- `localStorage` persistence with JSON export/import
- Native system fonts; no external resources

## License

MIT. Use it, fork it, adapt it.
