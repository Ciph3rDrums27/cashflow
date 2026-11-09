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

- **Home: safe to spend now.** Enter your checking balance and the app walks it forward day by day (paychecks in, bills out, everyday spending spread across the month) to show your lowest point ahead and what's safe to spend, plus everything due in the next 14 days.
- **Five tabs:** Home, Calendar, Bills, Cards, Settings.
- **Expense ledgers:** recurring bills, installment loans, Pay in 4, credit-card plans, one-time payments, and card charges. Installments end on their own after the last payment.
- **Cash vs. credit separation:** what leaves checking (bills, installments, card payments) is tracked separately from spending that lands on a card balance.
- **Paycheck coverage:** each paycheck covers the bills due until the next one, with checking carried over from earlier checks. Bills like rent can be marked as paid from the previous month's last paycheck.
- **Paid checkmarks and quick logging:** tick bills as paid, and use **+ Log** for groceries, gas, a bill amount, or a one-off purchase.
- **History-safe edits:** change a bill's amount from a given month on, set a last month, or skip or move one month's payment, without rewriting the past.
- **Credit cards:** per-month balances and payments, due days on the calendar, payoff dates that follow your planned payments, payments that stop once a card is paid off, and a debt-free plan with a goal month and a card-spending limit.
- **What-if payoff:** avalanche vs. snowball with paid-off payments rolled onto the next card, plus extra monthly payments.
- **Bank statement import (Chase CSV):** send purchases to Groceries, Gas, etc. so they count toward that month instead of on top of the estimate. The app remembers each merchant and skips rows it has already imported.
- **Backups:** dated exports, a reminder when it's been a while, a preview before an import replaces anything, and one-click undo of the last import.
- **Works offline** once installed from the hosted site (Add to Home Screen on iPhone).

## Privacy & security model

This is the point of the project, not an afterthought:

- **No backend.** Nothing is transmitted anywhere. There is no server to breach.
- **No third-party code.** No CDNs, no web fonts, no analytics, no trackers. The app makes zero outbound network requests. When hosted, a small service worker (`sw.js`) caches the app so it opens offline.
- **Data is local-only.** All state is stored in the browser's `localStorage`, scoped to the origin serving the app. The published code contains only sample data. It does not contain anyone's finances.
- **No secrets.** The source holds no keys or credentials, so hosting it publicly leaks nothing.
- **You own the data lifecycle.** Export to a JSON file you control; import to restore. Backups are yours to encrypt and store as you see fit.

### Threat model & caveats (read before deploying publicly)

- **Same-origin storage on shared hosts.** `localStorage` is scoped by origin, not path. On GitHub Pages, every project under `username.github.io` shares one origin, so other pages you host there could read this app's storage. Host on a **dedicated custom domain** (or a separate account) to isolate it.
- **Device security is the boundary.** The app has no passcode; anyone with your unlocked device can open it. Rely on full-disk encryption (FileVault) and device lock.
- **Never commit real data.** Exported backups (`cashflow*.json`) and bank CSVs are listed in `.gitignore`. Committed data would be public and preserved in git history.
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

## Tests

The money math (payments, payoff, paycheck coverage, running balance, carry-forward income) has tests that run against the real code in `index.html`:

```bash
node --test tests/*.test.mjs
```

## Tech

- Single `index.html` — HTML, CSS, and vanilla JavaScript in one file, plus `sw.js`, `manifest.webmanifest`, and `icon.svg` for offline use
- Hand-rolled SVG charts (no charting library)
- `localStorage` persistence with JSON export/import
- Native system fonts; no external resources

## License

MIT. Use it, fork it, adapt it.
