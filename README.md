# Codeforces Repractice

Find the Codeforces problems that beat you, judge them inside a time window you choose, and turn them into a timed mashup.

Enter a public Codeforces handle — no login, no backend, no API key.

![Angular](https://img.shields.io/badge/Angular-22-dd0031)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Workers-f38020)

## What it does

- **Time window** — pick an inclusive month range. Only submissions inside it are counted. The default is six months back to two months back, with quick presets for the last 3 months, 6 months, year, 2 years, and all time.
- **Struggle radar** — groups submissions by problem and counts failed tries in the window. `10+` must redo, `5–9` should redo, `2–4` maybe redo. Problems with no accepted solution by the end of the window get their own **Never solved** bucket.
- **Solved status as of the window end** — an accepted submission before the window still counts as solved. A solve after the window does not; the row is labelled “solved later” so the history stays honest.
- **Attempt timeline** — expand a problem to see every submission in the window, verdict, date, language, runtime and memory.
- **Weak topics** — the three tags where failed tries cluster most in the selected window.
- **Timed mashup** — choose 30 minutes to 3 hours, get 2–7 problems from your struggles, and copy lines in Codeforces format:
  ```
  A - 2237/B
  B - 2314/C
  ```
- **Progress** — contests, rating at the end of the window, best rating in range, and monthly submissions. Rating and activity charts use the same window.

## Attempt counting

For each problem with at least one submission inside the selected window:

- `failures` = every non-`OK` submission inside the window, including submissions after an accepted one
- `submissions` = attempts inside the window
- `solvedByEnd` = an `OK` exists on or before the end of the window
- `everSolved` = an `OK` exists anywhere in the downloaded history
- `solvedLater` = `everSolved` but not `solvedByEnd`
- `tier` = based on `failures` and `solvedByEnd`

If the default window contains no submissions (for example, an inactive account), the app opens **all time** and shows a short note instead of an empty report.

## Data and rate limits

- Data comes from the public [Codeforces API](https://codeforces.com/apiHelp).
- The API allows **1 request per 2 seconds**. Every call goes through a shared queue with a 2.1 second gap.
- `user.status` is paginated in 10,000-submission pages, so histories of any size are supported.
- Responses are cached in **IndexedDB for one hour** per handle.
- No data leaves your browser aside from requests to Codeforces. There is no server, account or API key.

## Development

```bash
npm install
npm start
```

Open `http://localhost:4200`.

```bash
npm run build     # production build -> dist/cf-repractice/browser
npm run test:ci   # unit tests (window logic, analysis engine, mashup generator, app shell)
```

Core logic lives in `src/app/core/`:

- `time-window.ts` — month math, default window, presets, clamping
- `analysis.ts` — window-aware grouping and tiers
- `mashup.ts` — duration mapping and copy-ready selection
- `chart-options.ts` — the two charts used by Progress

## Deploy to Cloudflare

This repo ships a `wrangler.jsonc` that serves the Angular build as a **Worker with static assets** and sets the SPA fallback, so deep links like `/u/tourist` work.

### Option A — Workers Builds (Git-connected, recommended)

1. Push this repo to GitHub/GitLab.
2. In Cloudflare **Workers & Pages → Create → Workers → Connect to Git**, pick the repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Node version:** 22+ (Angular 22 supports Node 20.19+, 22.12+ or 24+; `.nvmrc` pins 22)
4. Deploy, then enable a URL under **Settings → Domains & Routes** (`workers.dev` or a custom domain).

Every push to `main` redeploys automatically.

### Option B — deploy from your machine

```bash
npm run build
npx wrangler deploy
```

The SPA fallback comes from `wrangler.jsonc` (`assets.not_found_handling: "single-page-application"`), not a `_redirects` file — Workers static assets rejects the classic `/* /index.html 200` Pages rule as an infinite loop. Any static host with an SPA fallback works too (Netlify, GitHub Pages with a 404 fallback, etc.).

## Notes

- Not affiliated with Codeforces.
- Only public data is used; private submissions, hacks and source code are not requested.
- If Codeforces changes its API or rate limits, add a small proxy function in a future version. The current API sends `Access-Control-Allow-Origin: *`, so no proxy is required today.
