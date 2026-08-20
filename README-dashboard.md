# לילה לבן · Channel Intelligence

A personal YouTube analytics dashboard for the Hebrew horror channel
**לילה לבן**. It answers one question quickly: *how is my latest video doing
compared with my usual videos at the same point in their life?*

Hebrew, RTL, single channel, single user.

- **Insight → Context → Metrics → Raw data** — the dashboard leads with a
  verdict and the evidence behind it, not a wall of numbers.
- **Honest by construction** — a missing metric is never rendered as zero, and
  an approximation is never presented as a precise measurement.

---

## Contents

- [Quick start (demo mode)](#quick-start-demo-mode)
- [Required services](#required-services)
- [Google Cloud setup](#google-cloud-setup)
- [Supabase setup](#supabase-setup)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Running tests](#running-tests)
- [Demo mode](#demo-mode)
- [How the analytics work](#how-the-analytics-work)
- [Production deployment](#production-deployment)
- [Scheduled sync](#scheduled-sync)
- [V1 limitations](#v1-limitations)

---

## Quick start (demo mode)

No credentials, no database, no Google account:

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app boots in **demo mode** with realistic
Hebrew sample data and a `DEMO DATA` badge in the header. Everything except
live syncing works, and it uses the same domain models and components as real
mode.

---

## Required services

| Service | Why | Required for |
|---|---|---|
| Supabase (or any Postgres) | stores channel, videos, snapshots, insights | live mode |
| Google Cloud project | OAuth + YouTube APIs | live mode |
| Anthropic API | Claude-generated insight copy | optional |

Without the optional Anthropic key the app still produces insights, from a
deterministic rules engine that uses the same measured comparisons.

---

## Google Cloud setup

1. Create (or pick) a project at https://console.cloud.google.com.
2. **Enable these APIs** under *APIs & Services → Library*:
   - **YouTube Data API v3** — channel metadata, uploads, video metadata
   - **YouTube Analytics API** — views, watch time, retention, subscribers
   - **YouTube Reporting API** — bulk reach reports (thumbnail impressions and
     impressions CTR). Optional but required for any CTR figure.
3. Configure the **OAuth consent screen**. While it is in *Testing*, add your
   own Google account under *Test users*. Scopes requested:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`

   These are read-only. The app never requests permission to upload, edit,
   delete or schedule anything, and no monetary scope is requested.
4. Create an **OAuth 2.0 Client ID**, application type *Web application*, with
   the authorised redirect URI:

   ```
   <APP_BASE_URL>/api/auth/google/callback
   ```

   For local development that is `http://localhost:3000/api/auth/google/callback`.
   It must match `APP_BASE_URL` exactly, including scheme and port.
5. Copy the client ID and client secret into your `.env.local`.

The signed-in Google account must own the YouTube channel — YouTube Analytics
only returns data to the channel owner.

## Supabase setup

1. Create a project at https://supabase.com.
2. Copy the **Project URL** and the **service role** key
   (*Project Settings → API*). The service role key is server-side only.
3. Apply the migrations in `supabase/migrations/`, in filename order. Either:

   **Supabase CLI**
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

   **Or the SQL editor** — paste each file in order:
   ```
   0001_initial_schema.sql       tables and indexes
   0002_row_level_security.sql   deny-by-default RLS
   0003_updated_at_triggers.sql  updated_at maintenance
   ```

The schema lives in migrations, never in hand-made tables — that is what keeps
environments reproducible.

**Security posture.** RLS is enabled on every table with *no* permissive
policies, and grants on the credential table are revoked from `anon` and
`authenticated`. All access goes through server-side code holding the service
role key. If the anon key leaks, it reads nothing. Google tokens are encrypted
at rest with AES-256-GCM before they are stored.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. Every variable is
documented there. The essentials:

| Variable | Required | Notes |
|---|---|---|
| `APP_MODE` | no | `demo` or `live`; auto-detects when omitted |
| `APP_BASE_URL` | live | must match the Google redirect URI origin |
| `SUPABASE_URL` | live | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | live | server-side only, bypasses RLS |
| `GOOGLE_CLIENT_ID` | live | OAuth web client |
| `GOOGLE_CLIENT_SECRET` | live | OAuth web client |
| `APP_ENCRYPTION_KEY` | live | 32 bytes; `openssl rand -base64 32` |
| `APP_SESSION_SECRET` | live | signs the OAuth state cookie |
| `CRON_SECRET` | scheduled sync | shared secret for `/api/cron/sync` |
| `ANTHROPIC_API_KEY` | no | enables Claude insights |
| `ANTHROPIC_MODEL` | no | defaults to `claude-sonnet-4-5` |
| `YOUTUBE_REPORTING_REACH_REPORT_TYPE` | no | defaults to `channel_reach_basic_a1` |
| `SYNC_MAX_ANALYTICS_VIDEOS` | no | caps API calls per run (default 60) |

Nothing secret is ever sent to the browser, and no secret belongs in the repo.

## Running locally

```bash
npm install
npm run dev            # http://localhost:3000
```

To run against real data, fill in `.env.local`, set `APP_MODE=live`, then open
the app and connect your account from `/connect`. Connecting triggers an
initial sync automatically: channel metadata → uploaded videos → available
analytics → current-state snapshots → historical daily backfill where the APIs
allow it.

## Running tests

```bash
npm run typecheck      # TypeScript, strict
npm run lint           # ESLint
npm run test           # vitest: 152 unit + flow tests
npm run build          # production build
npm run verify         # all of the above, in order
```

Tests use fixtures and a fake Supabase client — none of them touch live YouTube
data, and they are deterministic (fixed reference date, no randomness).

The browser walk of the critical flow — connect → dashboard → videos → video →
snapshot switch — is a separate script, because it needs a running server:

```bash
npm run dev                                  # in one shell
npm run test:e2e                             # in another
E2E_BASE_URL=http://localhost:3010 npm run test:e2e   # custom port
```

## Demo mode

Demo mode exists so the interface can be developed before any credential is
configured. It is active whenever `APP_MODE=demo`, or automatically when
Supabase and Google are not both configured, and it is labelled `DEMO DATA` in
the header.

It is a **data source**, not a separate frontend: the same domain models,
benchmark engine, insight engine and components run in both modes, so nothing
built against demo data has to be rewritten later.

The fixtures deliberately exercise the awkward states:

- a 3-day-old video that has 24h and 72h snapshots but *not* 7d (so the
  snapshot selector has a genuinely disabled option)
- videos whose snapshots are `daily_backfill` rather than real milestone
  captures, to show the honesty warnings and mixed-quality benchmarks
- older videos with **pending** reach metrics, since reach reports do not
  stretch back indefinitely
- a Short and a live stream, which must never be benchmarked against long-form

## How the analytics work

**Snapshots.** New videos get performance captured at **24h**, **72h** and
**7d**. A capture happens while the video's real age is inside a tolerance
window (±6h, ±12h, ±24h respectively), and the row stores the *actual* age at
capture. The milestone list in `src/lib/domain/snapshots.ts` already contains
6h, 14d and 30d, disabled — enabling them is a one-word change.

**Historical accuracy.** For videos that existed before tracking began, the app
reconstructs milestones by summing YouTube's *daily* rows — and records them as
`daily_backfill`, not as milestone captures. This matters: the first calendar
day of a video is a partial day that depends on publication time, so it is not
the same measurement as "the first 24 hours". Benchmarks prefer like-quality
peers and tell you when the comparison is mixed.

**Benchmarking.** A video is compared against the **median** of up to 10
previous, benchmark-eligible videos of the same content type, at the same
milestone. Median rather than mean, so one viral upload does not make every
normal video look like a failure. Below 5 comparable videos the app says
`עדיין אין מספיק נתונים להשוואה אמינה.` rather than guessing.

**Score.** A transparent 0–100 restatement of those comparisons: each metric's
percentage difference from the median maps linearly onto points, saturating at
±60%, weighted (views 30%, retention 25%, CTR 25%, subs/1K 20%) and rescaled
over whatever was actually measurable. Under half coverage, there is no score.
All of it lives in `src/lib/benchmark/score.ts`.

**Insights.** The engine builds a structured fact sheet and hands it to a
provider. With `ANTHROPIC_API_KEY` set that is Claude, forced into a validated
JSON shape; otherwise it is a deterministic rules engine using the same
comparisons. Malformed AI output is discarded, never displayed.

**Reach (impressions and CTR).** The YouTube Analytics API does not expose
impressions or CTR at all. They come only from Reporting API reach reports,
which requires a reporting *job* to exist before YouTube starts generating
data. Reach values are only reported for a window that downloaded reports fully
cover; otherwise they stay pending. One assumption is documented in the code: a
CTR value at or below 1 is treated as a ratio and scaled to a percentage.

## Production deployment

The app is a standard Next.js App Router deployment; Vercel is the path of
least resistance.

1. Push the repository and import it.
2. Set every live-mode environment variable in the hosting dashboard. Set
   `APP_BASE_URL` to the production URL.
3. Add `<production-url>/api/auth/google/callback` as an authorised redirect URI
   in Google Cloud, alongside the localhost one.
4. Apply the Supabase migrations to the production project.
5. Deploy, open `/connect`, and connect the channel once.

Sync runs can take a while on a large channel; the sync routes declare
`maxDuration = 300`. If your platform caps function duration lower than that,
lower `SYNC_MAX_ANALYTICS_VIDEOS`.

## Scheduled sync

Milestone captures only happen if something calls the app while the window is
open, so a schedule every few hours is what makes 24h/72h/7d snapshots real.

`vercel.json` ships a cron entry hitting `/api/cron/sync` every three hours.
Any scheduler works — the endpoint just needs the shared secret:

```bash
curl -X POST "https://<host>/api/cron/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

The scheduler is deliberately isolated in `src/lib/sync/scheduler.ts`: swapping
Vercel Cron for GitHub Actions, `pg_cron` or a queue touches that file and the
route, never the analytics logic. Sync is idempotent, so running it more often
than needed is harmless — it updates rows instead of duplicating them.

## V1 limitations

Being explicit, because several of these look like bugs and are not:

- **YouTube analytics lag up to 48 hours.** A freshly published video legitimately
  shows nothing. The dashboard says so instead of showing zeros.
- **Reporting API reach data lags further.** The job must exist before YouTube
  generates reports, so the first CTR figures can take a day or more to appear.
  Until then impressions and CTR are `pending` everywhere.
- **V1 downloads the latest reach report only.** Reach for a window is reported
  only when every day in it is covered, so older videos keep pending reach
  rather than showing an understated number.
- **Reach report column names are matched from a candidate list.** If your
  report uses different column names the app reports reach as unavailable and
  names the headers it received, rather than guessing.
- **Benchmarking is long-form only.** Shorts, live streams and videos whose
  duration lands in the ambiguous 65–180 second band are excluded. Manual
  content-type override exists in the schema
  (`videos.content_type_override`) but has no UI yet.
- **Analytics cost one API request per video**, so a run is capped
  (`SYNC_MAX_ANALYTICS_VIDEOS`, default 60 newest). Older videos keep the data
  they already have.
- **Missed milestones cannot be recovered precisely.** If nothing called the
  app during a 24h window, that measurement is gone; only a day-granularity
  approximation is possible, and it is labelled as one.
- **Single channel, single user.** There is no authentication in front of the
  dashboard itself — deploy it somewhere private, or put your host's access
  control in front of it.
- **Mobile is functional, not optimised.** Desktop ~1440px and tablet ~1024px
  are the designed targets.
- **No comment tools, idea generation, competitor analysis or revenue data.**
  Out of V1 scope by design.
