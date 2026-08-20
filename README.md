# NGG Deep Research — Interactive Learning Units

Static site presenting the takeaways of the NGG deep-research study
**תמחור תשומות ותוצרים בעידן ה-AI — השוק הישראלי** as a series of interactive,
narrated slide units. Planned scope: 5 units. Currently live: units 01–02.

## Structure

```
index.html          Homepage — directory of all units (2 live, 3 placeholders)
unit-01.html        Unit 01 · כש-AI מקצר את העבודה — מה קורה למחיר?
unit-02.html        Unit 02 · מתוצרים חד־פעמיים לנכסים מתמשכים
support.js          Runtime that boots the interactive units (generated file — do not edit)
vendor/             React 18.3.1 UMD builds, self-hosted (integrity-verified)
assets/             NGG logos + homepage preview images (assets/previews/)
audio/              Unit 01 narration, one MP3 per slide
audio02/            Unit 02 narration, one MP3 per slide
```

Every reference is relative, so the site works from any root — GitHub Pages
project paths, Vercel, or a plain local server. No build step.

The unit pages are self-contained: React is served from `vendor/` (the runtime
skips its CDN fetch when React is already present), audio and logos are local.
The only external dependency is Google Fonts (Heebo, Frank Ruhl Libre), with
system-font fallbacks if unavailable.

## Deployment

### GitHub Pages (active)

`.github/workflows/deploy-pages.yml` publishes the repository root to GitHub
Pages on every push to the deployment branches. Site URL:

**https://ngg-global.github.io/NGGresearch/**

If a run ever fails on "Pages not enabled": Settings → Pages → Build and
deployment → Source: **GitHub Actions**, then re-run the workflow.

### Vercel (optional alternative)

Import the repository at vercel.com/new, keep the defaults (no framework, no
build command, root directory `.`) and deploy. Nothing in the repo needs to
change.

## Local preview

```
python3 -m http.server 8000
# open http://localhost:8000/
```

## Adding a unit (03–05)

1. Add the unit file as `unit-03.html` and its narration folder (e.g.
   `audio03/`), keeping the same relative layout the file expects. If the unit
   was produced like units 01–02, also add to its `<head>`: a `<title>`, the
   robots/noindex tag, and the two `vendor/` script tags **before**
   `support.js` (copy the head of `unit-02.html`).
2. Add a preview image: `assets/previews/unit-03.jpg` (1280×720 screenshot of
   the unit cover).
3. In `index.html`, copy one of the live unit cards (the comment in the file
   marks the template), point it at the new file, and remove the matching
   "בקרוב" placeholder card.

## Notes

- The site is publicly reachable by anyone with the URL. All pages carry
  `noindex, nofollow`, so they are not meant to appear in search engines.
- Research working material (source PDF, design documentation) is deliberately
  not part of this public repository — only the presentation units themselves.
- `support.js` is generated; treat it as read-only.
