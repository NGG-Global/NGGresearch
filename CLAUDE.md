# CLAUDE.md — Layla Lavan Analytics

Context for future Claude Code sessions in this repository.

## What this is

A personal YouTube **Channel Intelligence** dashboard for the Hebrew horror
channel **לילה לבן**. Single channel, single user.

It is not a YouTube Studio replacement. It exists to answer, fast:

1. How is my latest video performing?
2. Is that better or worse than my usual videos *at the same stage*?
3. Which metric stands out?
4. What can I learn from it?
5. Is there anything I should do?

Information hierarchy, in this order: **Insight → Context → Metrics → Raw data.**
The interface should help make decisions, not just display analytics.

## V1 boundaries

In scope: YouTube connection/onboarding, overview dashboard, videos list, video
detail/analysis, minimal settings.

Explicitly **out** of scope — do not add without being asked: comment management
or comment AI, idea generation, content calendar or pipeline, script generation,
uploading, YouTube scheduling, Shorts generation, thumbnail generation,
competitor analysis, revenue analytics, team collaboration, multi-channel
support, notifications, automation builder, public benchmarking.

## Architecture

```
src/
  app/                  Next.js App Router pages and route handlers
  components/           UI only — no analytics logic
    ui/                 primitives: metric cards, badges, states, buttons
    shell/              nav + app shell
    dashboard/          dashboard-specific cards
    video/              table, chart, snapshot selector, metric groups
    insight/            verdict hero + evidence
  lib/
    config/env.ts       every environment variable read, in one place
    domain/             types, metric states, milestones, classification
    benchmark/          statistics, comparison sets, thresholds, score
    analysis/           assembles domain + benchmark into view models
    insights/           facts → provider (Claude | rules) → validated payload
    youtube/            OAuth, Data API v3, Analytics API, Reporting API
    sync/               orchestration, reach dataset, scheduler boundary
    db/                 Supabase client, crypto, mappers, repositories
    data/               single read entry point (demo or live)
    demo/               fixtures + dataset builder
    format/             all number, date, duration and metric formatting
supabase/migrations/    SQL migrations (source of truth for the schema)
tests/                  vitest unit + flow tests
e2e/                    Playwright walk of the critical flow
```

Layering rule: **UI → analysis → benchmark/domain → youtube/db.** Never the
reverse. Components receive computed view models; they must not fetch or
compute analytics.

`lib/data/index.ts` is the only read path used by pages. Demo and live mode
return the same `ChannelDataset` shape, so components never know which is
active. Demo mode must keep using the real domain models — never fork the UI.

Server-only modules (`db/`, `sync/`, `youtube/oauth`, `auth/`) import
`server-only`. Under vitest that specifier is aliased to a no-op; `next build`
enforces the real boundary.

## Analytics accuracy rules

These are the rules the product lives or dies by. Breaking one silently
produces a confident, wrong dashboard.

- **A metric is never a bare number.** Every metric is a `MetricValue` with
  state `available | pending | unavailable`. `0` and "unknown" are different
  facts; render an em dash plus a reason, never a zero.
- **Never fabricate a metric.** If YouTube has not returned it, it stays
  pending.
- **Milestone snapshots must be real measurements.** A `milestone_capture` is
  taken while the video's actual age is inside the milestone's tolerance
  window, and stores the real `video_age_hours`. A day of daily-report data is
  **not** a "24 hours after publication" reading — that is
  `daily_backfill`, an approximation, and it is labelled and surfaced as one.
- **Compare like with like.** Benchmarks use the median (not the mean) of
  *previous, benchmark-eligible, same-content-type* videos at the *same
  milestone*. Milestone-quality peers are preferred over backfilled ones.
- **Below `MIN_BENCHMARK_SAMPLE` (5) peers, withhold the verdict** and say
  exactly: `עדיין אין מספיק נתונים להשוואה אמינה.`
- **No unearned statistical claims.** `standsOutFromSpread` is a robust-MAD
  observation, never described to the user as statistical significance.
- **Shorts are never benchmarked against long-form.** Classification records
  its source and confidence; ambiguous durations (65–180s) are `unknown` and
  ineligible rather than guessed.
- **The score is deterministic and transparent** — a weighted, saturating map
  of percentage differences (`lib/benchmark/score.ts`). No randomness. It
  returns `null` when under half the weight is measurable.
- **Insights are grounded.** Providers see only the structured fact sheet, and
  output is schema-validated before display. Never state an inference as a
  proven cause: "the packaging is the likeliest weak point", not "the thumbnail
  is bad".
- **Sync is idempotent.** Videos key on `youtube_video_id`; snapshots on
  `(video_id, snapshot_target, snapshot_source)`. Re-running updates in place.
- **Reach data is gated on coverage.** Impressions/CTR are only summed over a
  window every day of which a downloaded report actually described; otherwise
  pending.

## Language, layout and design

- Interface language is **Hebrew**, document is `dir="rtl"`, `lang="he"`.
- Figures, percentages, dates and durations are LTR-isolated via the `.num`
  class; small Latin metric labels use `.metric-label`. Video titles mix Hebrew
  and English — wrap them in `.bidi-isolate`.
- Use logical properties (`ps`/`pe`, `ms`/`me`, `start`/`end`), never
  `left`/`right`.
- **The supplied Claude Design hi-fi is the visual source of truth.** All
  colours, type sizes and spacing come from tokens in `src/app/globals.css`,
  transcribed from that file. Do not introduce ad-hoc hex values — extend the
  token scale. Do not replace the design with generic component-library
  defaults.
- It is a clean professional analytics product, not a horror-themed one. The
  channel's identity comes from thumbnails, titles and channel imagery only.
- Responsive priority: desktop ~1440px, then tablet ~1024px. Mobile must not
  break but is not optimised for V1.

## Security

Google tokens and API secrets are server-side only, tokens encrypted at rest
(AES-256-GCM) in their own table with RLS on and client grants revoked. OAuth
state is a signed httpOnly cookie. Errors shown to users are sanitised — never
echo upstream bodies, which can contain codes or secrets. Never log tokens.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest unit + flow tests
npm run test:e2e     # Playwright walk of the critical flow (needs a server)
npm run verify       # typecheck + lint + test + build
```

`npm run verify` is the gate before calling anything done.

## Gotchas

- Demo mode is the default and needs no credentials; `/connect` stays reachable
  in demo mode on purpose, so the onboarding screen can be worked on.
- `page.textContent('body')` in Playwright includes RSC payloads inside
  `<script>` tags — assert visible state through locators instead.
- YouTube analytics lag by up to 48 hours, and Reporting API reach reports lag
  further. Empty is a normal state, not a bug.
- The Analytics API has no impressions or CTR metric at all; those come only
  from Reporting API reach reports.
