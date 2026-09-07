# Know Your Block — web demo

A self-contained browser demo of the app's core loop, built for kiosks, pitches and
the marketing site — now on the app's **real map**: Mapbox GL JS rendering the same
hand-authored `BoldCivicStyle.json` the iOS app loads, with every honoree at their
true coordinates.

It lives inside the site, so it deploys with it: publishing `website/` puts the demo at
**/demo** and the landing page's "Try the demo" nav link resolves to it. Every path
inside the demo is relative, so it also works from a subdirectory or a preview host.

## Run it

```sh
cd knowyourblock/website
python3 -m http.server 8788
# open http://localhost:8788/demo/
```

A local server is required (the bundled `.ttf` faces won't load over `file://` in
Chrome). Unlike the classic version, the map itself needs network access (Mapbox
tiles) and a valid public access token (see below).

## What it does

- **Walk the real city.** Tap a spot near the walker and it routes there **along
  actual streets** (Mapbox Directions, walking profile; straight-line fallback if the
  request fails). Drag to pan, pinch/scroll to zoom. Arrow keys walk a block.
- **Ride the subway.** Tap somewhere far away (or use "Ride the Subway There" in a
  story sheet) and stairs appear: the walker descends, the map dims to a rocking
  train car — strap in hand, tunnel lights streaking past — and climbs out about a
  block from the destination. All input is ignored until the ride finishes.
- **Proximity notification.** Come within 40 m (real metres) of an unstamped sign and
  an iOS-style banner fires: *"You're near {street}" / "Tap to visit."*
- **Read the story.** Tap any sign to open the detail sheet: hero sign, ruled record
  block, the full story, and source links.
- **Stamp it.** In range, **Visit This Icon** blooms the sign from grayscale into full
  colour and slams the honoree badge down like an official seal.

## Demo-only deviations

| | Demo | App |
|---|---|---|
| Reset | A visit un-stamps itself 10 s after you close the story | Visits are permanent, stored in `CollectedStore` |
| Speed | Walking is exaggerated (~65 m/s) so the last block takes seconds; far hops ride a fictional K train | Real walking |
| Location | Simulated puck driven by taps | Real CoreLocation |
| Map | Same style + real coordinates, via Mapbox GL JS | Same style, via Mapbox iOS SDK |

The palette, type, sign construction, copy strings, and the 40 m collect radius are
mirrored from the app. The original procedurally-drawn map version is preserved at
**/demo/classic** — it needs no network beyond first load, so it's the fallback if
venue wifi dies.

## The twenty honorees

Shirley Chisholm · Walt Whitman · Elizabeth Jennings · Dr. Elizabeth Blackwell ·
James E. Davis · Dorie Miller · Althea Gibson · Emily Warren Roebling ·
Rena "Rusty" Kanokogi · The Notorious B.I.G. · Harriet Tubman · Sylvia Rivera ·
Frances Perkins · Raoul Wallenberg · Margaret Corbin · Louis Armstrong ·
Tenzing Norgay · Susannah Mushatt Jones · Celia Cruz · Granville T. Woods

Change the roster in `scripts/gen_demo_data.py` (repo root) and re-run it — it
regenerates `data.js` and copies the badge art from the app bundle.

## Mapbox credentials

`app.js` embeds the project's **public** access token (`pk.…`) — that's how Mapbox
web tokens are meant to ship, but it should be **URL-restricted** to
`knowyourblock.nyc` (plus `localhost` for development) in the Mapbox dashboard.
The token needs the default public scopes only; Directions requests use the same
token.

## Files

| File | Notes |
|---|---|
| `index.html` | Markup for the map screen, subway interstitial and story sheet |
| `styles.css` | Bold & Civic palette from `BoldCivicPalette.swift` + subway/Mapbox styling |
| `app.js` | Map boot, walking/Directions, subway ride, proximity, collect, demo reset |
| `data.js` | **Generated** by `scripts/gen_demo_data.py` from `streets.json` |
| `assets/BoldCivicStyle.json` | Copy of the app's Mapbox style |
| `assets/` | Copied from the app bundle: `sign_plate.png`, honoree badges, `KYBCivicStencil.ttf` |
| `classic/` | The original procedural-map demo, kept as an offline-friendly fallback |

`data.js` and `assets/` are copies of app resources. If the app's dataset or artwork
changes, re-run the generator / re-copy rather than editing them here.
