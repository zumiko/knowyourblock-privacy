# Know Your Block — web demo

A self-contained browser demo of the app's core loop, built for kiosks, pitches and
the marketing site. No build step, no dependencies, no API keys.

It lives inside the site, so it deploys with it: publishing `website/` puts the demo at
**/demo** and the landing page's "Try the demo" nav link resolves to it. Every path
inside the demo is relative, so it also works from a subdirectory or a preview host.

## Run it

```sh
cd knowyourblock/website
python3 -m http.server 8788
# open http://localhost:8788/demo/
```

A local server is required (the bundled `.ttf` faces won't load over `file://` in Chrome).
The folder is fully static, so it can be dropped onto any host as-is.

## What it does

- **Walk the map.** Swipe/drag to pan; on release the pedestrian walks to wherever you
  swiped. Tap an empty spot to walk straight there. Arrow keys move a block at a time.
  The walker never cuts across a block — routes are built along the street grid and turn
  at corners — and the figure runs a two-beat walk cycle, settling into a standing pose
  when it arrives.
- **Zoom.** Pinch, scroll, `+`/`-`, or the on-screen buttons. Pulling all the way back
  fits all seven honorees on screen; signs scale down with the map but stop shrinking
  before they stop reading.
- **Proximity notification.** Come within 40 m of an unstamped sign and an iOS-style
  banner fires: *"You're near {street}" / "Tap to visit."* Tap it to open the story.
- **Read the story.** Tap any sign to open the detail sheet: hero sign, ruled record
  block (Location / Co-named / Visited / Note), the full story, and source links.
- **Stamp it.** In range, **Visit This Icon** blooms the sign from grayscale into full
  colour and slams the honoree badge down like an official seal. Out of range you get
  the dashed **Get Closer to Visit** box with the live distance.

## Sizing

Full-bleed at every size. A single scale factor derived from the viewport drives the sign
size, the walker and the zoom together, so a phone, a laptop window and a landscape
touch table all get legible chrome; on screens wider than 860 px the story sheet becomes
a centred card instead of a bottom sheet. All input is pointer-based, so mouse, trackpad
and touch behave identically.

## Demo-only deviations

| | Demo | App |
|---|---|---|
| Reset | A visit un-stamps itself 10 s after you close the story, so the next person can stamp the same sign | Visits are permanent, stored in `CollectedStore` |
| Map | Procedurally drawn Bold & Civic street grid on `<canvas>` | Mapbox with `BoldCivicStyle.json` |
| Geography | Real coordinates compressed 10× around their centroid so all seven honorees share one walkable world, each nudged onto the nearest street line; relative bearings preserved | True coordinates |
| Location | Simulated puck driven by swipes | Real CoreLocation |

Everything else — palette, type, sign construction, copy strings, the 40 m collect
radius — is mirrored from the app.

## The seven honorees

Shirley Chisholm Place · Walt Whitman Way · Elizabeth Jennings Place ·
Dr. Elizabeth Blackwell Place · James E. Davis Avenue · Dorie Miller Place ·
Althea Gibson Street

## Files

| File | Notes |
|---|---|
| `index.html` | Markup for the map screen and story sheet |
| `styles.css` | Bold & Civic palette from `BoldCivicPalette.swift` |
| `app.js` | Map rendering, walking, proximity, collect, demo reset |
| `data.js` | **Generated.** Verbatim entries copied out of `KnowYourBlock/Resources/streets.json` |
| `assets/` | Copied from the app bundle: `sign_plate.png`, honoree badges, `KYBCivicStencil.ttf` |

`data.js` and `assets/` are copies of app resources. If the app's dataset or artwork
changes, re-copy them rather than editing them here.
