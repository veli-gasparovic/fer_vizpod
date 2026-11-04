# A chart is not a picture: a living deck for teaching D3

A 2 × 45 min lecture (Why → What → How) that is itself an interactive D3 page.
The slides are the demos. The live-code slides replay the old "uncomment the next block"
routine: each → reveals the next chunk of code and re-runs it on the stage next to it.

## Run it

Open `lecture/index.html` in Chrome or Firefox. That's it: everything (D3 v7.9.0, data,
TopoJSON) is local and loaded as plain scripts, so it works from `file://` and offline.
(A local server works too: `npx serve .` or `python -m http.server`.)

Only the two audience slides (Break, "Where are you?") need the network. They talk to
the existing dotsockets worker and degrade to an offline state without it.

## Keys

| key | action |
|---|---|
| → / Space / PageDown | next step (clickers work) |
| ← / PageUp | previous step |
| Shift + → / ← | next / previous slide, skipping steps |
| G | slide menu with timings (click to jump) |
| P | open the **presenter window** (notes, block timer, ahead/behind, next slide), synced over BroadcastChannel |
| X | **X-ray**: hover any element to see its DOM node and bound `__data__` |
| T | light / dark theme (`?theme=dark` in the URL also works) |
| F | fullscreen · B blackout · H hide progress bar |
| Ctrl + Enter | run the code in a live-code editor (you can type freely) |
| Esc | leave the editor so the arrow keys move slides again |

The URL hash tracks the position (`#21.3` = slide 21, step 3), so a reload keeps your place.

Live coding: type in any editor and press Ctrl+Enter. If you then press →, the deck tries to
keep your edits and only swaps in the next chunk. If your edit touched that chunk, it resets
to the scripted version and tells you so. ↺ reset in the editor bar also discards edits.

## Before the lecture

- [ ] Host `lecture/` somewhere public for the students' phones, e.g. Cloudflare Pages:
      `npx wrangler pages deploy . --project-name vizpod-lecture` from this folder.
      Present from the hosted URL and the on-screen join address (`…/join`) is filled in
      automatically. From `file://` it falls back to `joinUrl` in `js/config.js`.
- [ ] Check the worker is up: open `join.html` yourself, tap, then delete your dot.
- [ ] Clear old dots with the "clear all" button on the "Where are you?" slide (it asks twice).
- [ ] Check d3 npm downloads on npmjs.com the day before (the brief's numbers vary by tracker).
- [ ] Re-test the AI prompt on slide 27 with the current Claude model.
- [ ] Rehearse with the presenter window (P) on the laptop screen and the deck on the projector.

## Structure

```
index.html          all slides (<section class="slide">) + presenter notes (<aside class="notes">)
css/deck.css        theme, layout, code-stage styles
js/config.js        title, author, dotsockets endpoints, break length
js/deck.js          engine: steps, hash, presenter sync, X-ray, menu, progress stripes
js/codestage.js     live editor + stage ("uncomment the next chunk")
js/scripts/*.js     the live-code scripts (from ../d3.html, ../geo.js, …)
js/widgets/*.js     the explorable widgets
join.html           the phone page for the live poll
data/               HadCRUT 5.1 global (1850–2025), Berkeley Earth Croatia (1850–2020),
                    county populations, the Croatia TopoJSON, the census CSV, as scripts
vendor/             d3 v7.9.0, topojson-client 3.1.0
```

Adding a slide: copy a `<section>`. Use `.f` + `data-step="n"` for reveal-on-step fragments,
`data-minutes` for the timing plan, and an `<aside class="notes">` for the presenter view.
Adding a live-code slide: write a `Deck.script(name, { chunks: [{ at, until, label, code }] })`
in `js/scripts/` and drop in `<div class="widget grow" data-widget="code" data-script="name">`.

## Data

- Global: HadCRUT.5.1.0.0 annual global mean, anomaly vs 1961–1990 (Met Office Hadley Centre / CRU).
- Croatia: Berkeley Earth regional land-surface TAVG, annual mean of monthly anomalies vs 1951–1980.
  Land-only and noisier than the global mean; ends in 2020.
- Population: 2011 census (`../stanovnistvo_povrsina.csv`), grouped into counties by GADM
  `NAME_1` from `../hrvatska.topo.json`. GADM's "Grad Zagreb" includes a few surrounding municipalities.
