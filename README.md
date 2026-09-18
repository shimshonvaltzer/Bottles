# Water Sort Puzzle

A single-page, dependency-free Water Sort Puzzle game. Pure HTML/CSS/JS —
no build step, no npm install. Open `index.html` directly in a browser
(desktop or mobile) to play.

## Files

- `index.html` — page structure (header, board, controls, win overlay)
- `style.css` — dark navy theme, glossy test-tube bottle styling, responsive grid
- `game.js` — game logic (procedural level generation, pour/undo logic,
  scoring, sound effects, persistence, rendering)
- `README.md` — this file

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
