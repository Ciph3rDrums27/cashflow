# AGENTS.md

Rules for any AI agent (or person) changing this repository. They exist so that a change
never weakens the app's security or leaks the owner's financial data.

The security rules follow the OWASP Secure Coding Practices checklist, narrowed to what
applies to this app. Each section names the OWASP area it comes from.

## What this app is

- One file, `index.html`: HTML, CSS and plain JavaScript. No build step, no framework, no
  server, no third-party code.
- All data stays in the browser (`localStorage`, key `cashflow:v3`). Nothing is sent anywhere.
- The repository is **public**. The site is deployed to S3/CloudFront by
  `.github/workflows/deploy.yml` on every push to `main`.

## How changes are made

1. **Nothing is committed without the owner's approval.** Make changes in the working tree on
   a new branch, show the owner the findings, the diff summary and the test results, and wait.
2. Never push to `main`, merge a pull request, or change branch protection. The owner merges.
3. Before showing a change, run both checks and report the real results:
   - `node --test tests/*.test.mjs` (money maths, demo mode, security guardrails).
   - Open the app in a real browser and load every tab (Home, Calendar, Bills, Cards,
     Settings) in normal mode and with `?demo=1`, with no console errors.
4. Keep it simple. Prefer the smallest change that solves the problem; do not add layers,
   options or dependencies "for later".
5. Do not state anything about the owner's real data. Use made-up numbers in tests,
   examples, screenshots and commit messages, and say when a figure is made up.

## Security rules

### 1. Output encoding (OWASP: Output Encoding)

Saved data, imported backups, imported bank statements and anything typed are **untrusted**.
A backup file can contain any text in any field, including fields that are normally numbers
or dates.

- Every value from those sources that goes into `innerHTML`, a template string that becomes
  HTML, or an HTML attribute **must** pass through `esc()`. This includes values written into
  `value="..."`, `title="..."`, `placeholder="..."` and `data-...="..."`.
- Money goes through `fmt()` / `fmt0()`, which only ever produce digits and punctuation.
- Prefer `textContent` when no markup is needed.
- Only ids that passed `safeId` in `normalize()` (letters, digits, `_`, `-`) and names taken
  from the fixed lists in the code (`SECTKEYS`, `VIEWS`) may be placed inside an inline
  handler such as `onclick="del('recurring','x1a2b3c')"`. Never put a name, amount, date or
  any other free text inside an inline handler.
- Never use `eval`, `new Function`, `document.write`, `setTimeout` with a string, or
  `insertAdjacentHTML` with unescaped data.

### 2. Input validation (OWASP: Input Validation)

- All data entering the app (first load, backup import, undo import) goes through
  `normalize()`. New fields get their type checked or coerced there: numbers with `Number()`,
  dates against `YYYY-MM-DD`, months against `YYYY-MM`, ids with `safeId`.
- Validate by allow-list (what is permitted), not by trying to strip bad characters.
- Treat a file the user picks as hostile: check it has the expected shape before using it,
  show a preview before replacing data, and keep the size cap (`MAX_IMPORT_BYTES`).
- Look values up in maps that come from data (`merchantMap`, `imported`) with
  `Object.prototype.hasOwnProperty.call`, never with a bare `map[key]`, so names like
  `constructor` or `__proto__` cannot match built-in properties.
- Never copy untrusted objects with a deep merge or `Object.assign` onto app state.

### 3. Data protection and privacy (OWASP: Data Protection)

- No network calls. Do not add `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`,
  analytics, fonts, images or scripts from another website. The app must keep working with
  `connect-src 'none'`.
- Never commit real financial data, exports (`cashflow*.json`), bank statements (`*.csv`),
  Terraform state or variables. `.gitignore` covers these; do not weaken it.
- Never log financial data to the console.
- Demo mode (`?demo=1`) must never read or write saved data. Keep `tests/demo.test.mjs`
  passing.
- Photos added to the repo must have location (GPS) and camera metadata removed first.

### 4. Secrets and access (OWASP: Authentication and Password Management, Access Control)

- No secrets in the repository, in `index.html`, in tests, in workflow files, or in chat:
  no API keys, tokens, passwords, AWS keys or account numbers.
- Deploys use GitHub's short-lived OIDC role. Do not add long-lived AWS keys as secrets.
- If a bank connection is ever added, its token lives in the macOS Keychain on the owner's
  machine, never in this repo and never in the site.

### 5. Security policy and headers (OWASP: System Configuration)

- The live site sends a Content-Security-Policy and other security headers from CloudFront
  (configured outside this repository). `index.html` also carries a `<meta>` policy as a
  fallback for local or other hosting. Do not loosen either.
- Do not add inline `<script src>` from another origin, `<iframe>`, `<object>`, `<embed>`,
  `<base>` or a `<form>` that posts anywhere.
- Moving the script out of `index.html` so `'unsafe-inline'` can be dropped is welcome, but
  it changes the deploy and the tests: propose it to the owner first.

### 6. Dependencies and supply chain (OWASP: General Coding Practices)

- The shipped app has **zero** third-party code. Do not add a library, CDN link, package
  manager or build step without the owner's explicit approval.
- GitHub Actions must be pinned to a full commit SHA with the version in a comment, as the
  existing workflows do. Never use a tag such as `@v4` or `@main`.

### 7. CI/CD (OWASP: System Configuration, Access Control)

- Workflows declare the minimum `permissions`. Only the deploy job has `id-token: write`.
- The test workflow must never receive AWS access or secrets.
- Do not interpolate untrusted values (pull request titles, branch names, issue text) into a
  `run:` script. Pass them through `env:` if they are ever needed.
- Do not add `pull_request_target` or self-hosted runners.

### 8. Error handling (OWASP: Error Handling and Logging)

- A failure to read or save data must never destroy data: keep the untouched copy, tell the
  user in plain words, and let them export a backup.
- Error messages shown on the page go through `esc()` like any other text.

### 9. Storage (OWASP: Data Protection, Session Management)

- Data in `localStorage` is not encrypted and is readable by anything running on the page.
  That is why rules 1 and 3 matter: one injected script could read everything.
- Do not store anything more sensitive than the app already holds (no credentials, account
  numbers or bank tokens).

## Guardrail tests

`tests/security.test.mjs` fails if:

- `esc()` stops escaping `& < > " '`;
- a hostile backup can inject a tag or break out of an attribute in any list, row or edit form;
- an id from a backup is not replaced when it contains anything but letters, digits, `_`, `-`;
- `index.html` references another website, loads an external script, drops the fallback
  security policy, or uses `eval` / `new Function` / `document.write`.

When you add a new place where data reaches the page, add its field to the hostile backup in
that test. If a guardrail test fails, fix the code; do not weaken the test.
