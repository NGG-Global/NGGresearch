# NGG Deep Research — Interactive Learning Units

Static site presenting NGG deep-research findings — pricing, methods, tools,
and ways of action — as a series of interactive, narrated slide units, each
distilling a study on a different organizational topic. Planned scope: 5
units. All five are live.

## Structure

```
index.html          Homepage — directory of all units
unit-01.html        Unit 01 · כש-AI מקצר את העבודה — מה קורה למחיר?
unit-02.html        Unit 02 · מתוצרים חד־פעמיים לנכסים מתמשכים
unit-03.html        Unit 03 · Trusted Advisor בעידן ה-AI
unit-04.html        Unit 04 · AI Transformation — מה ארגונים באמת משנים
unit-05.html        Unit 05 · המנהל בעידן ה-AI — לא פחות ניהול. ניהול אחר.
support.js          Runtime that boots the interactive units (generated file — do not edit)
vendor/             React 18.3.1 UMD builds, self-hosted (integrity-verified)
assets/             NGG logos + homepage preview images (assets/previews/)
audio/              Unit 01 narration, one MP3 per slide
audio02/            Unit 02 narration, one MP3 per slide
audio03/            Unit 03 narration, one MP3 per scene
audio04/            Unit 04 narration, one MP3 per scene
audio05/            Unit 05 narration, one MP3 per scene
```

Every reference is relative, so the site works from any root — GitHub Pages
project paths, Vercel, or a plain local server. No build step.

The unit pages are self-contained: React is served from `vendor/` (the runtime
skips its CDN fetch when React is already present), audio and logos are local.
The only external dependency is Google Fonts (Heebo, Frank Ruhl Libre), with
system-font fallbacks if unavailable.

## Deployment

### GitHub Pages (active)

`.github/workflows/deploy-pages.yml` copies the repository root to the
`gh-pages` branch on every push to the deployment branches; GitHub Pages
serves that branch. Site URL:

**https://ngg-global.github.io/NGGresearch/**

If the URL ever returns 404, Pages needs its one-time activation: Settings →
Pages → Build and deployment → Source: **Deploy from a branch** → Branch:
**gh-pages** / **(root)** → Save. From then on every push publishes
automatically.

### Vercel (optional alternative)

Import the repository at vercel.com/new, keep the defaults (no framework, no
build command, root directory `.`) and deploy. Nothing in the repo needs to
change.

## Local preview

```
python3 -m http.server 8000
# open http://localhost:8000/
```

## Adding a unit

1. Add the unit file as `unit-NN.html` and its narration folder (`audioNN/`),
   keeping the same relative layout the file expects. Its `<head>` needs a
   `<title>`, the robots/noindex tag, and the two `vendor/` script tags
   **before** `support.js` — copy the head of `unit-05.html`.
2. Add a preview image: `assets/previews/unit-NN.jpg` (1280×720 screenshot of
   the unit cover).
3. In `index.html`, copy one of the unit cards (the comment in the file marks
   the template), point it at the new file, and update the unit count in the
   header strip.

## Full-research links

Each unit can link out to the full research document it was built from, in two
places:

- **End screen** — a download panel ("להורדת המחקר המלא") with the document's
  name, format and page count.
- **Every scene** — a "להעמיק במחקר ↗" link in the source footer, pointing at
  the page where that scene's material is discussed.

Both are driven by one table in each unit's script block, `this.RES`:

```js
this.RES={href:'',name:'המנהל בעידן ה-AI',pages:20,
  p:{1:1,2:10,3:3,4:16,5:5,6:6,7:12,8:11,9:9,10:13}};
```

- `href` — where the document lives. **While it is empty, both the panel and
  every scene link render nothing at all**, so an unhosted unit shows no broken
  link. Setting it turns the whole feature on for that unit.
- `name`, `pages` — shown in the download panel's caption.
- `p` — scene number → opening page of the relevant section. The scene link
  becomes `href + '#page=' + p[scene]`, which most PDF viewers honour.

The page numbers were taken from each document's own bookmark outline, matched
to the scene that covers the same material.

**Before setting `href`, check where the document may be hosted.** This
repository is public, and the Pages workflow copies the whole repository root
to `gh-pages` — so a PDF committed here is downloadable by anyone with the URL.
`noindex` keeps it out of search results; it does not restrict access. For a
document that should stay inside the team, host it somewhere access-controlled
and put that URL in `href` instead.

## Subtitles

Each unit carries a subtitle track for its narration, so the content can be
followed with the sound off. It is toggled by the `CC` control next to the
audio button. Defaults: **audio on, subtitles off**. Once a viewer turns
subtitles on the choice is remembered (`localStorage`, key `nggCC`), so it
follows them across scenes and units.

The text lives in a `this.CAP` table in each unit's script block, right below
`CUES`. One line per animation cue, keyed by cue name — the timing comes from
`CUES` automatically, so there is nothing to time by hand:

```js
this.CAP={
  1:{head:'קנינו AI. מה באמת השתנה?',
     mach:'ארגון הוא מכונה של תהליכים, לא רק אוסף כלים.',
     lic:'עשרת אלפים רישיונות זו לא טרנספורמציה.',
     fast:'', jam:'', q:''},   // המכונה הארגונית
};
```

- The key is the scene number, matching `AUD`, `DUR` and `CUES`.
- Inside each scene the keys are that scene's cue names, taken straight from
  its `CUES` entry. The skeleton in each file already lists every cue for
  every scene, so filling subtitles in means typing between the quotes.
- A line appears when its cue fires and stays until the next filled cue. An
  empty cue is skipped — the previous line stays on screen.
- Order inside the object does not matter; lines are sorted by cue time.
- A scene may instead use an explicit `[[seconds, text], ...]` array when it
  needs finer, sentence-level timing than the cue beats give. Unit 05 uses
  this form throughout: its lines are cut at the narration's own sentence
  boundaries and timed to them, independently of the animation cues.

Subtitles track the fallback timer as well as the audio clock, so they stay in
sync when audio is blocked or muted — which is the case this feature exists
for.

While every slot in a unit is still empty its `CC` control stays hidden, so an
untranscribed unit shows no dead button.

## Notes

- The site is publicly reachable by anyone with the URL. All pages carry
  `noindex, nofollow`, so they are not meant to appear in search engines.
- Research working material (source PDF, design documentation) is deliberately
  not part of this public repository — only the presentation units themselves.
- `support.js` is generated; treat it as read-only.
