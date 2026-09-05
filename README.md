# US States & Capitals Quiz

A mobile-first quiz for learning the 50 US state capitals. Shows a state's
outline (plus a locator map of where it sits in the country), names the state,
and offers four capitals to choose from.

**Play:** https://xta.github.io/us-states-and-capitals-quiz/

## Modes

- **Quick Quiz** — 10 random states
- **All 50** — every state, shuffled
- **Endless** — keeps going, tracking your current streak

## Stack

Static site, no build step, no backend, no dependencies at runtime: plain HTML,
CSS and vanilla JavaScript, served straight from GitHub Pages. Sized for a
phone viewport (designed against iPhone 13 Pro, 390×844).

```
index.html      markup + script tags
css/style.css   styles
js/states.js    the 50 states and their capitals
js/shapes.js    pre-rendered SVG path for each state + the national outline
js/app.js       hash router, quiz logic, rendering
```

## Map data

State outlines were generated ahead of time from
[us-atlas](https://github.com/topojson/us-atlas) (ISC licence), which packages
US Census Bureau cartographic boundaries (public domain). The TopoJSON was
projected with `d3-geo`'s `geoAlbersUsa`, lightly simplified, and flattened to
plain SVG path strings in `js/shapes.js` — so the site ships no mapping library
and makes no network requests. Because every path shares one projection, the
same data draws both the zoomed state outline and the locator map.

## Development

No tooling required — open `index.html`, or serve the folder:

```sh
python3 -m http.server 8000
```
