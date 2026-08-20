# Migration notes — YouTube Channel Intelligence dashboard V1

This branch carries the V1 dashboard for the Hebrew horror channel לילה לבן.
It is intended to be migrated into **NGG-Global/Laylalavan**.

The dashboard was pushed here through the GitHub API rather than `git push`,
because the originating session could not reach `NGG-Global/Laylalavan` and its
`git push` was blocked. The API path accepts text file content only, which is
why the files below are missing.

**Read this before assuming the branch is complete.**

## 1. Files that could NOT be pushed

### Binary files (the API tools accept text content only)

| Path | Size | What it is |
|---|---|---|
| `public/brand/channel-avatar.png` | 77,623 B | Channel avatar. Used by the top nav, the connect screen and settings. |
| `public/brand/channel-avatar-sm.png` | 5,541 B | Small copy of the same avatar. |
| `src/app/icon.png` | 5,541 B | Favicon (Next.js App Router picks this up by filename). Byte-identical to `channel-avatar-sm.png`. |

`channel-avatar-sm.png` and `src/app/icon.png` have the same SHA-256
(`245ba905b23560c4...`), so one file satisfies both paths.

**Effect if missing:** the app builds and runs, but `next/image` requests for
`/brand/channel-avatar.png` return 404 and the avatar/favicon render blank. No
analytics or logic depends on them.

**How to restore:** copy the three PNGs from the originating session's handoff
bundle (or supply any square channel avatar) to those paths. The source image
is the channel's own logo artwork.

### Deliberately not transcribed

| Path | Size | Why |
|---|---|---|
| `package-lock.json` | 325,382 B | Pushing it required re-emitting 325 KB of generated JSON by hand through a tool call. A silently corrupted lockfile fails in confusing ways at `npm ci`, and an absent one is trivially regenerated — so it was left out on purpose rather than risked. |

**How to restore:** `npm install` regenerates it from `package.json`. Note that
this resolves fresh versions within the declared semver ranges, so it will not
be byte-identical to the lockfile the session verified against. The verified
versions are pinned exactly in `package.json` for `next` (15.5.23) and
`eslint-config-next` (15.5.23); everything else is a caret range.

## 2. Renamed to avoid clobbering an existing file

| Local path | Pushed as | Why |
|---|---|---|
| `README.md` | `README-dashboard.md` | This branch was created from `claude/slide-platform-deploy-xi3xre`, whose root already holds the learning-units `README.md`. Overwriting it was explicitly out of scope, so the dashboard README sits beside it. |

When the dashboard becomes the root of `Laylalavan`, rename
`README-dashboard.md` back to `README.md`.

## 3. Learning-units files left untouched

Nothing from the base branch was modified. `index.html`, `unit-*.html`,
`support.js`, `audio*/`, `assets/`, `vendor/` and the root `README.md` are
exactly as they were on `claude/slide-platform-deploy-xi3xre`. They are not part
of the dashboard and should be dropped when migrating, not carried over.

## 4. Verification status

**Verified in the originating session, against the full working tree** (which
included the PNGs and the lockfile):

- `tsc --noEmit` — clean
- `eslint src tests` — clean
- `vitest run` — 152 tests passing
- `next build` — clean production build
- Playwright walk of connect → dashboard → videos → video → snapshot switch —
  27/27 checks, no console errors, no horizontal overflow at 1440px or 1024px

**Verified after pushing:** every one of the 111 text files was fetched back
from this branch and compared to the local working tree by git blob hash. All
111 are byte-identical.

The test and build results above were produced *before* the transfer, on a tree
that had the PNGs and lockfile present. After `npm install` and restoring the
three PNGs, `npm run verify` should reproduce them.

## 5. Suggested migration steps

1. Copy everything except the learning-units files into `Laylalavan`.
2. Rename `README-dashboard.md` to `README.md`.
3. Add the three PNGs listed above.
4. `npm install` (regenerates `package-lock.json`).
5. `npm run verify` — expect typecheck, lint, 152 tests and the build to pass.
6. Delete this file once the migration is done.
