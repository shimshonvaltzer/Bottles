# Water Sort Puzzle

A single-page, dependency-free Water Sort Puzzle game. Pure HTML/CSS/JS —
no build step, no npm install. Open `index.html` directly in a browser
(desktop or mobile) to play.

## Files

- `index.html` — page structure (header, board, controls, win overlay)
- `style.css` — dark navy theme, glossy test-tube bottle styling, responsive grid
- `game.js` — game logic (procedural level generation, pour/undo logic,
  scoring, sound effects, persistence, rendering)
- `WaterSort.html` — single-file offline build (see below)
- `build-single.js` — generates `WaterSort.html` from the files above
- `README.md` — this file

## Single-file offline build

`WaterSort.html` is a self-contained build of the game: `style.css` and
`game.js` are inlined directly into one HTML file, with the manifest,
icon links, service worker registration, and "Install app" button
removed (none of them apply to a standalone file). It makes zero network
or subresource requests, which matters because opening `index.html` from
an Android file manager loads it over a `content://` URI — a context
where Chrome refuses to fetch the relative `style.css`/`game.js`
subresources, leaving an unstyled, non-functional page. `WaterSort.html`
sidesteps that entirely: download or copy this one file anywhere (a
phone's Downloads folder, a USB drive, an email attachment) and open it
directly, from `content://`, `file://`, `http://`, or a desktop
double-click, and it renders and plays fully offline.

Progress (level, score, best score, mute, colorblind setting) is saved
to `localStorage`, which is scoped per file location/origin — so
progress made in `WaterSort.html` opened from one location (or the
`index.html` PWA) is separate from progress made opening the same file
from a different location.

Regenerate it after changing `index.html`, `style.css`, or `game.js` by
running:

```
node build-single.js
```

## How to play

Click/tap a bottle to lift its top color group, then click/tap another
bottle to pour that group into it. A pour is legal when the destination
bottle is empty or its top color matches, and there is room (capacity 4
units per bottle). Sort every color into its own bottle (or leave bottles
empty) to win.

## Features

- **Procedural, guaranteed-solvable levels.** Each level starts from a
  fully solved state and is scrambled with random *legal reverse pours*
  (not a raw shuffle), so every generated puzzle is solvable by
  construction. Difficulty (number of colors, number of empty bottles,
  scramble depth) increases with level number, up to 12 colors and 14
  bottles total. Levels are infinite.
- **Undo** (5 per level), **Restart level**, and **Add Bottle** (2 per
  level, adds an extra empty bottle as a lifeline) — all with visible
  remaining-use counters and buttons that disable when exhausted.
- **Hint** button (3 per level) that highlights a valid move (preferring
  a move that would win the level if available).
- **Scoring**: base points per level plus bonuses for fewer moves and
  unused undos. Running total score and a persisted best score are shown
  in the header.
- **Stuck detection**: if no legal move exists in the current state, a
  banner suggests Undo or Restart.
- **Sound effects** are synthesized live with the WebAudio API (no audio
  files) for select, pour, win, and error events. A mute toggle persists
  across reloads.
- **Colorblind-friendly mode** overlays a distinct symbol on every liquid
  segment; toggled from the header and persisted.
- **Persistence**: current level, score, best score, mute state, and
  colorblind setting are saved to `localStorage` and restored on reload.
- **Win overlay** with a star rating (based on move count), the points
  earned, a canvas confetti burst, and a "Next Level" button.

## Testing

Verification scripts (Node solver checks + a Playwright smoke test) were
used during development to confirm: level generation is solvable for
levels 1–30, exactly 10 bottles render on load, pours and undo work as
expected, and there are no console errors. Those scripts live outside
this repository (in the development scratchpad) since they are dev-time
tooling, not part of the shipped game.

## Installing as an app (PWA)

Water Sort Puzzle is a fully installable, offline-capable Progressive
Web App — no app store needed.

**Android (Chrome):** open the game's URL, tap the browser menu (⋮),
then tap **"Add to Home screen"** (or use the install icon that appears
in the header once the browser detects the app is installable). The
game will then launch full-screen from your home screen and continue to
work without an internet connection.

**iPhone / iPad (Safari):** open the game's URL, tap the **Share**
button, then choose **"Add to Home Screen"**. Safari does not support
the automatic install prompt, so this manual step is required.

Once installed, a service worker caches all game assets so the puzzle
keeps working offline, including on repeat launches from the home
screen icon.

## Hosting on GitHub Pages

1. Push this repository to GitHub (already done for this branch).
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a
   branch", pick branch `claude/zealous-volta-75p00n` and folder
   `/ (root)`, then save.
4. GitHub Pages will publish the site at the URL shown on that settings
   page. The included `.nojekyll` file ensures all files (including
   `manifest.json` and `sw.js`) are served as-is.
