# Codeforces Repractice

Find the Codeforces problems that beat you, see how long ago it was, and get a practice plan built from your own submission history.

Enter a public Codeforces handle — no login, no backend, no API key.

![Angular](https://img.shields.io/badge/Angular-22-dd0031)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Pages-f38020)

## What it does

- **Struggle radar** — groups every submission by problem and counts all failed submissions, including failures after an AC.
- **Severity buckets** — `10+` must redo, `5–9` should redo, `2–4` maybe redo, `0–1` solid. Problems that were never solved get their own bucket.
- **Recency** — every row shows the last attempt and first accepted submission, with a default sort that pushes old struggles to the top.
- **Attempt timeline** — expand a problem to see every submission, verdict, date, language, runtime and memory.
- **In-depth analysis** — weakest tags, failure verdicts, difficulty vs. failures, rating buckets, contest vs. practice, yearly activity, rating history and rule-based insights.
- **Practice builder** — recommends unattempted problems around your rating that match your weakest tags, using the public Codeforces problemset.

## Attempt counting

For each problem:

- `failures` = every non-`OK` submission, across all time, **including submissions after an accepted one**
- `failuresBeforeFirstAC` = failures before the first `OK`
- `submissions` = all attempts
- `acs` = accepted submissions
- `tier` = based on `failures` (the **All failures** mode)

The Struggles tab has a **Counting** toggle:

- **All failures** (default) — buckets and the ranked count use every failure ever, including after an AC.
- **Pre-AC only** — re-buckets each problem using only `failuresBeforeFirstAC`, so post-AC resubmissions no longer inflate it.

Each row shows the failure count, how many of those were pre-AC, the AC count and total submissions, so the number driving the bucket is always explicit.

## Data and rate limits

- Data comes from the public [Codeforces API](https://codeforces.com/apiHelp).
- The API allows **1 request per 2 seconds**. Every call goes through a shared queue with a 2.1 second gap.
- `user.status` is paginated in 10,000-submission pages, so histories of any size are supported.
- Responses are cached in **IndexedDB for one hour** per handle. The problemset is cached for 24 hours.
- No data leaves your browser aside from requests to Codeforces. There is no server, account or API key.

## Development

```bash
npm install
npm start
```

Open `http://localhost:4200`.

```bash
npm run build     # production build -> dist/cf-repractice/browser
npm test          # unit tests (analysis engine + app shell)
```

The analysis engine lives in `src/app/core/analysis.ts` and is covered by fixtures in `analysis.spec.ts`.

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

`public/_redirects` is kept for hosts that use the Pages convention; the Worker's `assets.not_found_handling` setting handles the SPA fallback here. Any static host with an SPA fallback works too (Netlify, GitHub Pages with a 404 fallback, etc.).

## Notes

- Not affiliated with Codeforces.
- Only public data is used; private submissions, hacks and source code are not requested.
- If Codeforces changes its API or rate limits, add a small proxy function in a future version. The current API sends `Access-Control-Allow-Origin: *`, so no proxy is required today.
# repractice
