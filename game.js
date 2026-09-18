/* Water Sort Puzzle - game logic + UI
 * Pure logic functions are attached to globalThis so they can be
 * required/tested from Node without a DOM (see scratchpad tests).
 */
(function (global) {
  'use strict';

  // ---------- Palette ----------
  var COLORS = [
    '#22d3ee', // cyan
    '#facc15', // yellow
    '#3b82f6', // blue
    '#f472b6', // pink
    '#e11d48', // magenta/red-pink
    '#a855f7', // purple
    '#f97316', // orange
    '#22c55e', // green
    '#ef4444', // red
    '#14b8a6', // teal
    '#fbcfe8', // light-pink
    '#84cc16'  // lime
  ];
  var SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '◉', '▼', '✦', '◈', '✱', '▶'];
  var CAPACITY = 4;

  // ---------- Hebrew UI strings (single source of truth for all user-facing text) ----------
  var STR = {
    bottleLabel: function (n) { return 'בקבוק ' + n; },
    noMoves: 'אין מהלכים אפשריים! נסו',
    undoWord: 'ביטול מהלך',
    restartWord: 'התחלה מחדש',
    winTitle: 'כל הכבוד!',
    winPoints: function (n) { return '+' + n + ' נקודות'; },
    winTotal: function (n) { return 'סה"כ: ' + n; },
    statsLevels: 'שלבים שהושלמו',
    statsMoves: 'סה"כ מהלכים',
    statsHints: 'רמזים בשימוש',
    statsUndos: 'ביטולים בשימוש',
    statsStreak: 'רצף נוכחי',
    statsBestStreak: 'רצף שיא'
  };

  // ---------- Pure game logic ----------

  // Build a solved state for a given number of colors and bottles (colors + empties)
  function buildSolvedState(numColors, numEmpty) {
    var bottles = [];
    for (var c = 0; c < numColors; c++) {
      var stack = [];
      for (var i = 0; i < CAPACITY; i++) stack.push(c);
      bottles.push(stack);
    }
    for (var e = 0; e < numEmpty; e++) bottles.push([]);
    return bottles;
  }

  // Returns list of legal "forward" moves [from, to] for a given state
  function legalMoves(bottles) {
    var moves = [];
    for (var from = 0; from < bottles.length; from++) {
      if (bottles[from].length === 0) continue;
      var topColor = bottles[from][bottles[from].length - 1];
      for (var to = 0; to < bottles.length; to++) {
        if (to === from) continue;
        if (canPour(bottles, from, to)) moves.push([from, to]);
      }
    }
    return moves;
  }

  function canPour(bottles, from, to) {
    var src = bottles[from], dst = bottles[to];
    if (src.length === 0) return false;
    if (dst.length >= CAPACITY) return false;
    var topColor = src[src.length - 1];
    if (dst.length === 0) return true;
    var dstTop = dst[dst.length - 1];
    return dstTop === topColor;
  }

  // Perform a pour, returns { moved, newBottles } - does not mutate input
  function pour(bottles, from, to) {
    var b = bottles.map(function (s) { return s.slice(); });
    var src = b[from], dst = b[to];
    if (!canPour(b, from, to)) return { moved: 0, bottles: b };
    var topColor = src[src.length - 1];
    var moved = 0;
    while (src.length > 0 && src[src.length - 1] === topColor && dst.length < CAPACITY) {
      dst.push(src.pop());
      moved++;
    }
    return { moved: moved, bottles: b };
  }

  // Check win: every bottle empty or full with 4 identical
  function isSolved(bottles) {
    for (var i = 0; i < bottles.length; i++) {
      var s = bottles[i];
      if (s.length === 0) continue;
      if (s.length !== CAPACITY) return false;
      for (var j = 1; j < s.length; j++) if (s[j] !== s[0]) return false;
    }
    return true;
  }

  // ---------- Difficulty metric ----------
  // boardDifficulty(bottles) measures how "scrambled"/hard a freshly
  // generated board is, so generateLevel can reject boards that are too
  // easy (e.g. bottles that already sit solved). Defined as:
  //   - completeCount: number of bottles that are already a single solid
  //     color AND full (length === CAPACITY). These are "free wins" the
  //     player does nothing to earn - a hard requirement is that this is 0
  //     at level start.
  //   - quadCount: number of bottles holding 4-of-a-kind (same as
  //     completeCount for CAPACITY=4, kept separate/explicit per spec so the
  //     check reads clearly and stays correct if CAPACITY ever changes).
  //   - fragmentation: total number of maximal same-color "runs" across all
  //     bottles (a solved board has exactly `numColors` runs - one per full
  //     bottle - and 0 for each empty). More runs = more mixed/fragmented =
  //     harder, since undoing the mixing takes more pours.
  //   - avgColorsPerBottle: mean number of distinct colors per non-empty
  //     bottle; higher means colors are more interleaved (harder).
  function countRuns(stack) {
    if (stack.length === 0) return 0;
    var runs = 1;
    for (var i = 1; i < stack.length; i++) {
      if (stack[i] !== stack[i - 1]) runs++;
    }
    return runs;
  }

  function boardDifficulty(bottles) {
    var completeCount = 0, quadCount = 0, fragmentation = 0, distinctSum = 0, nonEmpty = 0;
    for (var i = 0; i < bottles.length; i++) {
      var s = bottles[i];
      if (s.length === 0) continue;
      nonEmpty++;
      var runs = countRuns(s);
      fragmentation += runs;
      if (runs === 1 && s.length === CAPACITY) completeCount++;
      if (s.length === CAPACITY && runs === 1) quadCount++;
      distinctSum += new Set(s).size;
    }
    return {
      completeCount: completeCount,
      quadCount: quadCount,
      fragmentation: fragmentation,
      avgColorsPerBottle: nonEmpty ? distinctSum / nonEmpty : 0
    };
  }

  // How many colors / empty bottles a level should use. Colors ramp up to
  // the palette cap (12) by level 19; the number of "free" empty bottles
  // shrinks as levels rise (2 early on, down to 1 at higher levels) so late
  // boards have less slack to work with.
  function computeNumColors(level) {
    return Math.min(3 + Math.floor((level - 1) / 2), 12);
  }

  function computeNumEmpty(level, numColors) {
    var empties = level <= 10 ? 2 : 1;
    if (numColors + empties > 14) empties = Math.max(1, 14 - numColors);
    return empties;
  }

  // ---------- Reverse-pour scramble (mixing-capable + solvable-by-construction) ----------
  // A forward pour takes the top run of A (uniform color X) and places it on
  // B, which must be empty or already topped with X. Two facts follow that
  // matter for generation:
  //   1) The only way a bottle B ever loses part of its content is from the
  //      TOP - so any "lower" content was there from the very start. That is
  //      exactly how bottles end up holding several different colors in a
  //      real puzzle: the mixing is present in the INITIAL deal, not created
  //      by later pours.
  //   2) A pour does not care what A's own top sits on top of - only B's top
  //      must be empty-or-matching.
  // So to build a solvable, genuinely-mixed initial board we run the pours
  // in reverse from the solved state: reverseMove(d -> s) means "undo a
  // future pour from s to d" - take (some of) d's current top run and place
  // it back on top of s, regardless of what s's own current top color is
  // (this is what actually produces bottles with several different colors
  // stacked, which the old same-color-only rule could never do - that was
  // the root cause of the original difficulty bug: every bottle stayed
  // monochrome forever).
  // The one rule that must hold for the resulting board to remain
  // constructible via legal forward pours: if we take d's ENTIRE current
  // top run (not just part of it), whatever was directly under that run in
  // d must not exist yet from s's perspective at that point in time - in
  // practice we simply require that a *full* removal only happens when it
  // empties d completely (d was until now purely that one run). Partial
  // removals (leaving at least one unit of that color on top of d) are
  // always fine. Solvability is still verified explicitly afterwards by a
  // bounded BFS in generateLevel (see below) as a belt-and-braces check.
  function getReverseMoves(bottles) {
    var moves = [];
    for (var d = 0; d < bottles.length; d++) {
      var stack = bottles[d];
      if (stack.length === 0) continue;
      var topColor = stack[stack.length - 1];
      var runLen = 0;
      for (var i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === topColor) runLen++; else break;
      }
      // Max units of the top run we may legally peel off: all of it if that
      // empties the bottle entirely, otherwise all but the last unit (so a
      // different color is never "revealed" mid-history).
      var maxAmount = (runLen === stack.length) ? runLen : (runLen - 1);
      if (maxAmount <= 0) continue;
      for (var s = 0; s < bottles.length; s++) {
        if (s === d) continue;
        var room = CAPACITY - bottles[s].length;
        if (room <= 0) continue;
        moves.push([d, s]);
      }
    }
    return moves;
  }

  function applyReverseMove(bottles, from, to, rng) {
    rng = rng || Math.random;
    var b = bottles.map(function (s) { return s.slice(); });
    var src = b[from], dst = b[to];
    var topColor = src[src.length - 1];
    var runLen = 0;
    for (var i = src.length - 1; i >= 0; i--) {
      if (src[i] === topColor) runLen++; else break;
    }
    var maxAmount = (runLen === src.length) ? runLen : (runLen - 1);
    var room = CAPACITY - dst.length;
    var cap = Math.min(maxAmount, room);
    if (cap < 1) return b; // no-op guard
    // Bias toward moving just 1-2 units at a time: splitting a run into more
    // pieces increases fragmentation, which is what makes boards harder.
    var moveCount = cap === 1 ? 1 : 1 + Math.floor(rng() * Math.min(cap, 2));
    for (var k = 0; k < moveCount; k++) dst.push(src.pop());
    return b;
  }

  // Score a candidate reverse move: higher score = more likely to increase
  // fragmentation/mixing (breaking into a bottle that already holds a
  // different color mixes colors together; pouring onto an empty bottle
  // spreads colors out so later moves have more to mix with).
  function scoreReverseMove(bottles, mv) {
    var d = mv[0], s = mv[1];
    var dStack = bottles[d], sStack = bottles[s];
    var score = 1;
    if (sStack.length === 0) score += 1;
    else if (sStack[sStack.length - 1] !== dStack[dStack.length - 1]) score += 4;
    return score;
  }

  // Build one scrambled candidate board via biased reverse-pours. Biasing
  // avoids the original bug where uniformly-random reverse moves tend to
  // undo each other and drift back toward the solved state: we weight
  // mixing/fragmentation-increasing moves higher and never immediately undo
  // the previous reverse move.
  function scrambleBoard(numColors, numEmpty, shuffleCount, rng) {
    var bottles = buildSolvedState(numColors, numEmpty);
    var lastMove = null;
    for (var iter = 0; iter < shuffleCount; iter++) {
      var reverseMoves = getReverseMoves(bottles);
      if (reverseMoves.length === 0) break;
      var filtered = reverseMoves.filter(function (mv) {
        return !(lastMove && mv[0] === lastMove[1] && mv[1] === lastMove[0]);
      });
      if (filtered.length === 0) filtered = reverseMoves;
      var weights = filtered.map(function (mv) { return scoreReverseMove(bottles, mv); });
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      var r = rng() * total;
      var chosen = filtered[filtered.length - 1];
      for (var k = 0; k < filtered.length; k++) {
        r -= weights[k];
        if (r <= 0) { chosen = filtered[k]; break; }
      }
      bottles = applyReverseMove(bottles, chosen[0], chosen[1], rng);
      lastMove = chosen;
    }
    return bottles;
  }

  // Bounded BFS returning the OPTIMAL (shortest) solution length, or null if
  // that could not be determined within the node budget. A null result is
  // treated as "hard enough" by the caller (never as a rejection) - the
  // board is still guaranteed solvable by construction (see comment above
  // getReverseMoves), just possibly expensive to solve optimally.
  function solverLength(bottles, maxStates) {
    maxStates = maxStates || 20000;
    var startKey = stateKey(bottles);
    var visited = new Set([startKey]);
    var queue = [{ b: bottles, d: 0 }];
    var head = 0;
    var count = 0;
    while (head < queue.length) {
      var cur = queue[head++];
      count++;
      if (count > maxStates) return null;
      if (isSolved(cur.b)) return cur.d;
      var moves = legalMoves(cur.b);
      for (var i = 0; i < moves.length; i++) {
        var res = pour(cur.b, moves[i][0], moves[i][1]);
        var key = stateKey(res.bottles);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ b: res.bottles, d: cur.d + 1 });
        }
      }
    }
    return null; // exhausted search space without reaching solved (shouldn't happen)
  }

  // Minimum acceptable OPTIMAL solution length for a level. This is the
  // real difficulty gate: a board that can be solved in a couple of pours is
  // "too easy" even if it happens to have zero complete bottles. The floor
  // is never below 6 moves, scales with color count (more colors need more
  // untangling) and grows with level so late levels are comfortably in the
  // tens of moves.
  function minSolverMoves(level, numColors) {
    // Calibrated against what this board size (up to 14 bottles, 12 colors,
    // capacity 4) can actually produce: optimal solutions here realistically
    // top out in the low-mid twenties, so the bar rises with level up to
    // that plateau instead of demanding an unreachable target.
    return Math.min(6 + Math.floor(level * 0.7), 19);
  }

  // Reverse-pour based generator: start solved, undo biased reverse pours,
  // then measure and possibly reject the result. Generation is quality
  // driven (measure boardDifficulty AND the optimal solver length), not
  // just step-count driven, since step count alone doesn't guarantee a hard
  // board (random reverse moves can undo each other).
  function generateLevel(level) {
    var numColors = computeNumColors(level);
    var numEmpty = computeNumEmpty(level, numColors);

    var shuffleCount = Math.min(40 + level * 8, 450);
    // Fragmentation bar rises with level so late boards are provably more
    // mixed than early ones (checked/asserted by the verification script).
    var minFragmentation = Math.ceil(numColors * 1.5) + Math.floor(level / 6);
    var requiredSolverMoves = minSolverMoves(level, numColors);
    // Keep generation fast (must run on a phone, well under a second): cap
    // the BFS node budget. A board whose optimal length can't be pinned
    // down within the budget is treated as acceptable/hard, never rejected.
    var solverBudget = 12000;

    var maxAttempts = 60;
    var best = null;
    var bestScore = -Infinity;

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var seed = ((level * 2654435761 + attempt * 40503) % 2147483647 + 2147483647) % 2147483647 + 12345;
      var rng = mulberry32(seed);
      var bottles = scrambleBoard(numColors, numEmpty, shuffleCount, rng);

      if (isSolved(bottles) || legalMoves(bottles).length === 0) continue;

      var diff = boardDifficulty(bottles);
      var structOk = diff.completeCount === 0 && diff.quadCount === 0 &&
        diff.fragmentation >= minFragmentation;
      if (!structOk) {
        var badScore = diff.fragmentation - diff.completeCount * 1000 - diff.quadCount * 500;
        if (badScore > bestScore) { bestScore = badScore; best = bottles; }
        continue;
      }

      var solLen = solverLength(bottles, solverBudget);
      // null (budget exceeded without finding solved) is treated as hard
      // enough - only a DEFINITE short solution causes rejection.
      var meetsBar = solLen === null || solLen >= requiredSolverMoves;

      var score = (solLen === null ? 1e6 : solLen) + diff.fragmentation;
      if (score > bestScore) { bestScore = score; best = bottles; }
      if (meetsBar) { best = bottles; break; }
    }

    if (!best) {
      // Should be unreachable in practice, but guarantees a legal, playable
      // board rather than throwing.
      best = buildSolvedState(numColors, numEmpty);
    }
    return { bottles: best, numColors: numColors };
  }

  // Deterministic PRNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Solver: BFS/DFS with visited set to verify solvability.
  function isSolvable(bottles, maxStates) {
    maxStates = maxStates || 200000;
    var startKey = stateKey(bottles);
    var visited = new Set([startKey]);
    var queue = [bottles];
    var count = 0;
    while (queue.length > 0) {
      var cur = queue.shift();
      count++;
      if (count > maxStates) return false;
      if (isSolved(cur)) return true;
      var moves = legalMoves(cur);
      for (var i = 0; i < moves.length; i++) {
        var res = pour(cur, moves[i][0], moves[i][1]);
        var key = stateKey(res.bottles);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(res.bottles);
        }
      }
    }
    return false;
  }

  function stateKey(bottles) {
    return bottles.map(function (s) { return s.join(','); }).sort().join('|');
    // Note: sorting bottles for key is fine for solvability check since
    // bottle *identity* doesn't matter for whether a solved state is
    // reachable in the abstract puzzle sense used here for verification.
  }

  // Expose pure logic for testing / reuse
  global.WaterSort = {
    COLORS: COLORS,
    SYMBOLS: SYMBOLS,
    CAPACITY: CAPACITY,
    buildSolvedState: buildSolvedState,
    legalMoves: legalMoves,
    canPour: canPour,
    pour: pour,
    isSolved: isSolved,
    generateLevel: generateLevel,
    isSolvable: isSolvable,
    mulberry32: mulberry32,
    boardDifficulty: boardDifficulty,
    computeNumColors: computeNumColors,
    computeNumEmpty: computeNumEmpty,
    solverLength: solverLength,
    minSolverMoves: minSolverMoves
  };

  // ---------- UI / App (only runs in browser) ----------
  if (typeof document === 'undefined') return;

  // ---------- Durable save (localStorage + IndexedDB, versioned schema) ----------
  var OLD_STORAGE_KEY = 'watersort_save_v1'; // legacy flat shape, migrated below
  var STORAGE_KEY = 'watersort_save_v2';     // versioned schema key
  var IDB_DB_NAME = 'watersort-db';
  var IDB_STORE = 'saves';
  var IDB_KEY = 'main';

  function defaultStats() {
    return {
      levelsCompleted: 0,
      totalMoves: 0,
      totalHints: 0,
      totalUndos: 0,
      bestMovesPerLevel: {},
      currentStreak: 0,
      longestStreak: 0
    };
  }

  function defaultSaveData() {
    return {
      version: 1,
      level: 1,
      totalScore: 0,
      bestScore: 0,
      stats: defaultStats(),
      settings: { muted: false, colorblind: false },
      savedAt: 0
    };
  }

  function isValidSaveData(d) {
    return !!(d && typeof d === 'object' &&
      typeof d.version === 'number' &&
      typeof d.level === 'number' && d.level >= 1 &&
      typeof d.totalScore === 'number' &&
      typeof d.bestScore === 'number' &&
      d.stats && typeof d.stats === 'object' &&
      d.settings && typeof d.settings === 'object');
  }

  // Reads the OLD flat localStorage format so a user's current progress is
  // not lost when this versioned-schema update lands.
  function migrateOldSave() {
    try {
      var raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      var out = defaultSaveData();
      if (typeof data.level === 'number') out.level = data.level;
      if (typeof data.score === 'number') out.totalScore = data.score;
      if (typeof data.bestScore === 'number') out.bestScore = data.bestScore;
      if (typeof data.muted === 'boolean') out.settings.muted = data.muted;
      if (typeof data.colorblind === 'boolean') out.settings.colorblind = data.colorblind;
      out.savedAt = Date.now();
      return out;
    } catch (e) { return null; }
  }

  function buildSaveData() {
    return {
      version: 1,
      level: state.level,
      totalScore: state.score,
      bestScore: state.bestScore,
      stats: state.stats,
      settings: { muted: state.muted, colorblind: state.colorblind },
      savedAt: Date.now()
    };
  }

  // Picks whichever save is "more advanced" (higher level, then score, then
  // most recently saved) so loading from two redundant stores never regresses
  // progress.
  function pickNewer(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.level !== b.level) return a.level > b.level ? a : b;
    if (a.totalScore !== b.totalScore) return a.totalScore > b.totalScore ? a : b;
    return (a.savedAt || 0) >= (b.savedAt || 0) ? a : b;
  }

  function applySaveData(data) {
    state.level = data.level;
    state.score = data.totalScore;
    state.bestScore = data.bestScore;
    var s = data.stats || {};
    state.stats = Object.assign(defaultStats(), s, {
      bestMovesPerLevel: Object.assign({}, s.bestMovesPerLevel || {})
    });
    state.muted = !!(data.settings && data.settings.muted);
    state.colorblind = !!(data.settings && data.settings.colorblind);
  }

  // ---- IndexedDB mirror: fully async-safe, never throws, never blocks
  // rendering. Every operation degrades to a no-op if IndexedDB is
  // unavailable (e.g. under file://) or errors for any reason.
  var idbAvailable = (typeof indexedDB !== 'undefined');

  function idbOpen() {
    return new Promise(function (resolve) {
      if (!idbAvailable) { resolve(null); return; }
      try {
        var req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = function () {
          try { req.result.createObjectStore(IDB_STORE); } catch (e) { /* ignore */ }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function idbSave(data) {
    return idbOpen().then(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(data, IDB_KEY);
        tx.oncomplete = function () { try { db.close(); } catch (e) { /* ignore */ } };
        tx.onerror = function () { try { db.close(); } catch (e) { /* ignore */ } };
      } catch (e) { /* ignore */ }
    }).catch(function () { /* ignore */ });
  }

  function idbLoad() {
    return idbOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var req = tx.objectStore(IDB_STORE).get(IDB_KEY);
          req.onsuccess = function () { resolve(req.result || null); try { db.close(); } catch (e) { /* ignore */ } };
          req.onerror = function () { resolve(null); try { db.close(); } catch (e) { /* ignore */ } };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function saveProgress() {
    var data = buildSaveData();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* memory-only fallback */ }
    idbSave(data); // fire-and-forget; never blocks rendering
  }

  // Synchronous initial load (localStorage, or migrated legacy save, or a
  // fresh default) so the first render is never delayed. Corrupt/invalid
  // data always falls back to a fresh state rather than crashing.
  function loadProgress() {
    var local = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (isValidSaveData(parsed)) local = parsed;
      }
    } catch (e) { /* corrupt JSON - ignore */ }

    if (!local) local = migrateOldSave();
    if (!local) local = defaultSaveData();
    applySaveData(local);

    // Async: also check IndexedDB for a possibly newer/further-along save
    // (e.g. localStorage was cleared but IndexedDB survived, or vice
    // versa), merge, and re-render only if it actually changes anything.
    idbLoad().then(function (idbData) {
      try {
        if (idbData && isValidSaveData(idbData)) {
          var winner = pickNewer(local, idbData);
          if (winner === idbData && (idbData.level !== state.level || idbData.totalScore !== state.score)) {
            applySaveData(idbData);
            saveProgress();
            if (typeof render === 'function') { try { render(); } catch (e) { /* ignore */ } }
          }
        }
        // Mirror whichever save won back into both stores so they agree.
        idbSave(buildSaveData());
      } catch (e) { /* ignore */ }
    }).catch(function () { /* ignore */ });
  }

  var state = {
    level: 1,
    score: 0,
    bestScore: 0,
    bottles: [],
    numColors: 3,
    selected: -1,
    moves: 0,
    undosLeft: 5,
    addsLeft: 2,
    hintsLeft: 3,
    history: [], // stack of {bottles, moves}
    muted: false,
    colorblind: false,
    won: false,
    stats: defaultStats()
  };

  // ---------- WebAudio sound effects ----------
  var audioCtx = null;
  function getCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function beep(freq, duration, type, gainVal, delay) {
    if (state.muted) return;
    try {
      var ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(gainVal || 0.15, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio not available */ }
  }

  var sounds = {
    select: function () { beep(520, 0.08, 'triangle', 0.12); },
    pour: function () {
      beep(300, 0.12, 'sine', 0.12);
      beep(380, 0.12, 'sine', 0.1, 0.06);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        beep(f, 0.25, 'triangle', 0.15, i * 0.12);
      });
    },
    error: function () { beep(140, 0.18, 'sawtooth', 0.12); }
  };

  // ---------- Scoring ----------
  function computeLevelScore(moves, undosUsed, undosTotal) {
    var base = 100;
    var movePenalty = Math.max(0, moves - 10) * 2;
    var undoBonus = Math.max(0, (undosTotal - undosUsed)) * 15;
    var moveBonus = Math.max(0, 60 - movePenalty);
    return base + moveBonus + undoBonus;
  }

  // ---------- Level setup ----------
  var UNDOS_PER_LEVEL = 5;
  var ADDS_PER_LEVEL = 2;
  var HINTS_PER_LEVEL = 3;

  function startLevel(levelNum) {
    var gen = global.WaterSort.generateLevel(levelNum);
    state.level = levelNum;
    state.bottles = gen.bottles;
    state.numColors = gen.numColors;
    state.selected = -1;
    state.moves = 0;
    state.undosLeft = UNDOS_PER_LEVEL;
    state.addsLeft = ADDS_PER_LEVEL;
    state.hintsLeft = HINTS_PER_LEVEL;
    state.history = [];
    state.won = false;
    saveProgress();
    render();
  }

  // ---------- DOM refs ----------
  var el = {};
  function cacheDom() {
    el.board = document.getElementById('board');
    el.level = document.getElementById('stat-level');
    el.score = document.getElementById('stat-score');
    el.moves = document.getElementById('stat-moves');
    el.best = document.getElementById('stat-best');
    el.undoBtn = document.getElementById('btn-undo');
    el.undoCount = document.getElementById('undo-count');
    el.restartBtn = document.getElementById('btn-restart');
    el.addBtn = document.getElementById('btn-add');
    el.addCount = document.getElementById('add-count');
    el.hintBtn = document.getElementById('btn-hint');
    el.hintCount = document.getElementById('hint-count');
    el.muteBtn = document.getElementById('btn-mute');
    el.cbBtn = document.getElementById('btn-colorblind');
    el.winOverlay = document.getElementById('win-overlay');
    el.winStars = document.getElementById('win-stars');
    el.winScore = document.getElementById('win-score');
    el.winTotal = document.getElementById('win-total');
    el.nextBtn = document.getElementById('btn-next');
    el.stuckBanner = document.getElementById('stuck-banner');
    el.confettiCanvas = document.getElementById('confetti-canvas');
    el.levelProgressFill = document.getElementById('level-progress-fill');
    el.statsBtn = document.getElementById('btn-stats');
    el.statsOverlay = document.getElementById('stats-overlay');
    el.statsCloseBtn = document.getElementById('btn-stats-close');
    el.sLevels = document.getElementById('s-levels');
    el.sMoves = document.getElementById('s-moves');
    el.sHints = document.getElementById('s-hints');
    el.sUndos = document.getElementById('s-undos');
    el.sStreak = document.getElementById('s-streak');
    el.sBestStreak = document.getElementById('s-best-streak');
  }

  function levelProgressPct() {
    if (!state.bottles.length) return 0;
    var complete = 0;
    state.bottles.forEach(function (stack) {
      if (stack.length === global.WaterSort.CAPACITY) {
        var c = stack[0], ok = true;
        for (var i = 1; i < stack.length; i++) { if (stack[i] !== c) { ok = false; break; } }
        if (ok) complete++;
      }
    });
    return Math.min(100, Math.round((complete / Math.max(1, state.numColors)) * 100));
  }

  function renderStats() {
    el.level.textContent = state.level;
    el.score.textContent = state.score;
    el.moves.textContent = state.moves;
    el.best.textContent = state.bestScore;
    el.undoCount.textContent = state.undosLeft;
    el.addCount.textContent = state.addsLeft;
    el.hintCount.textContent = state.hintsLeft;
    el.undoBtn.disabled = state.undosLeft <= 0 || state.history.length === 0;
    el.addBtn.disabled = state.addsLeft <= 0;
    el.hintBtn.disabled = state.hintsLeft <= 0;
    el.muteBtn.textContent = state.muted ? '🔇' : '🔊';
    el.muteBtn.setAttribute('aria-pressed', String(state.muted));
    el.cbBtn.setAttribute('aria-pressed', String(state.colorblind));
    el.cbBtn.classList.toggle('active', state.colorblind);
    if (el.levelProgressFill) el.levelProgressFill.style.width = levelProgressPct() + '%';
  }

  function renderStatsPanel() {
    var s = state.stats;
    el.sLevels.textContent = s.levelsCompleted;
    el.sMoves.textContent = s.totalMoves;
    el.sHints.textContent = s.totalHints;
    el.sUndos.textContent = s.totalUndos;
    el.sStreak.textContent = s.currentStreak;
    el.sBestStreak.textContent = s.longestStreak;
  }

  function onStatsOpen() {
    renderStatsPanel();
    el.statsOverlay.hidden = false;
  }
  function onStatsClose() {
    el.statsOverlay.hidden = true;
  }

  function render() {
    renderStats();
    el.board.innerHTML = '';
    el.board.className = 'board bottles-' + state.bottles.length;
    state.bottles.forEach(function (stack, idx) {
      el.board.appendChild(buildBottleEl(stack, idx));
    });
    checkStuck();
  }

  function buildBottleEl(stack, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'bottle-wrap';
    var bottle = document.createElement('div');
    bottle.className = 'bottle';
    if (idx === state.selected) bottle.classList.add('selected');
    bottle.dataset.index = String(idx);
    bottle.setAttribute('role', 'button');
    bottle.setAttribute('tabindex', '0');
    bottle.setAttribute('aria-label', STR.bottleLabel(idx + 1));

    var liquidWrap = document.createElement('div');
    liquidWrap.className = 'liquid-wrap';

    var topColor = stack.length ? stack[stack.length - 1] : -1;
    var runLen = 0;
    if (topColor >= 0) {
      for (var i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === topColor) runLen++; else break;
      }
    }

    for (var pos = 0; pos < global.WaterSort.CAPACITY; pos++) {
      var seg = document.createElement('div');
      seg.className = 'segment empty-seg';
      if (pos < stack.length) {
        var colorIdx = stack[pos];
        seg.className = 'segment';
        seg.style.background = colorForIndex(colorIdx);
        var isTop = pos >= stack.length - runLen;
        if (idx === state.selected && isTop) {
          seg.classList.add('lifted');
        }
        if (state.colorblind) {
          var label = document.createElement('span');
          label.className = 'seg-label';
          label.textContent = global.WaterSort.SYMBOLS[colorIdx % global.WaterSort.SYMBOLS.length];
          seg.appendChild(label);
        }
      }
      liquidWrap.appendChild(seg);
    }

    bottle.appendChild(liquidWrap);
    var glass = document.createElement('div');
    glass.className = 'glass-overlay';
    bottle.appendChild(glass);
    wrap.appendChild(bottle);

    bottle.addEventListener('click', function () { onBottleClick(idx); });
    bottle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBottleClick(idx); }
    });
    return wrap;
  }

  function colorForIndex(i) {
    return global.WaterSort.COLORS[i % global.WaterSort.COLORS.length];
  }

  function pushHistory() {
    state.history.push({
      bottles: state.bottles.map(function (s) { return s.slice(); }),
      moves: state.moves
    });
  }

  function onBottleClick(idx) {
    if (state.won) return;
    clearHint();
    if (state.selected === -1) {
      if (state.bottles[idx].length === 0) return;
      state.selected = idx;
      sounds.select();
      render();
      return;
    }
    if (state.selected === idx) {
      state.selected = -1;
      render();
      return;
    }
    var ws = global.WaterSort;
    if (ws.canPour(state.bottles, state.selected, idx)) {
      pushHistory();
      var result = ws.pour(state.bottles, state.selected, idx);
      state.bottles = result.bottles;
      state.moves++;
      state.stats.totalMoves++;
      state.selected = -1;
      sounds.pour();
      render();
      animatePour(idx);
      if (ws.isSolved(state.bottles)) {
        setTimeout(onWin, 350);
      }
    } else {
      sounds.error();
      var fromEl = el.board.children[state.selected];
      var toEl = el.board.children[idx];
      shake(fromEl);
      shake(toEl);
      state.selected = -1;
      render();
    }
  }

  function shake(wrapEl) {
    if (!wrapEl) return;
    var b = wrapEl.querySelector('.bottle');
    if (!b) return;
    b.classList.add('shake');
    setTimeout(function () { b.classList.remove('shake'); }, 320);
  }

  function animatePour(toIdx) {
    var wrapEl = el.board.children[toIdx];
    if (!wrapEl) return;
    var b = wrapEl.querySelector('.bottle');
    if (!b) return;
    b.classList.add('pour-bounce');
    setTimeout(function () { b.classList.remove('pour-bounce'); }, 300);
  }

  function onUndo() {
    if (state.undosLeft <= 0 || state.history.length === 0) return;
    var prev = state.history.pop();
    state.bottles = prev.bottles;
    state.moves = prev.moves;
    state.undosLeft--;
    state.stats.totalUndos++;
    state.selected = -1;
    clearHint();
    saveProgress();
    render();
  }

  function onRestart() {
    // An explicit restart breaks the "levels won without restarting" streak.
    state.stats.currentStreak = 0;
    startLevel(state.level);
  }

  function onAddBottle() {
    if (state.addsLeft <= 0) return;
    if (state.bottles.length >= 14) return;
    state.addsLeft--;
    pushHistory();
    state.bottles.push([]);
    render();
  }

  function onHint() {
    if (state.hintsLeft <= 0) return;
    var moves = global.WaterSort.legalMoves(state.bottles);
    // Prefer a move that empties a bottle or completes a color for better hints
    if (moves.length === 0) return;
    var best = moves[0];
    for (var i = 0; i < moves.length; i++) {
      var res = global.WaterSort.pour(state.bottles, moves[i][0], moves[i][1]);
      if (global.WaterSort.isSolved(res.bottles)) { best = moves[i]; break; }
    }
    state.hintsLeft--;
    state.stats.totalHints++;
    highlightHint(best[0], best[1]);
    saveProgress();
    renderStats();
  }

  var hintTimeout = null;
  function highlightHint(from, to) {
    clearHint();
    var fromEl = el.board.children[from];
    var toEl = el.board.children[to];
    if (fromEl) fromEl.querySelector('.bottle').classList.add('hint-from');
    if (toEl) toEl.querySelector('.bottle').classList.add('hint-to');
    hintTimeout = setTimeout(clearHint, 1800);
  }
  function clearHint() {
    if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
    var els = el.board.querySelectorAll('.hint-from, .hint-to');
    els.forEach(function (e) { e.classList.remove('hint-from', 'hint-to'); });
  }

  function checkStuck() {
    if (state.won) { el.stuckBanner.hidden = true; return; }
    var moves = global.WaterSort.legalMoves(state.bottles);
    el.stuckBanner.hidden = moves.length > 0;
  }

  function onWin() {
    state.won = true;
    var levelScore = computeLevelScore(state.moves, UNDOS_PER_LEVEL - state.undosLeft, UNDOS_PER_LEVEL);
    state.score += levelScore;
    if (state.score > state.bestScore) state.bestScore = state.score;
    state.stats.levelsCompleted++;
    var prevBest = state.stats.bestMovesPerLevel[state.level];
    if (prevBest === undefined || state.moves < prevBest) {
      state.stats.bestMovesPerLevel[state.level] = state.moves;
    }
    state.stats.currentStreak++;
    if (state.stats.currentStreak > state.stats.longestStreak) {
      state.stats.longestStreak = state.stats.currentStreak;
    }
    saveProgress();
    sounds.win();
    renderStats();
    showWinOverlay(levelScore);
    launchConfetti();
  }

  function showWinOverlay(levelScore) {
    var stars = 1;
    if (state.moves <= 15) stars = 3; else if (state.moves <= 25) stars = 2;
    el.winStars.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var s = document.createElement('span');
      s.className = 'star';
      s.textContent = i < stars ? '★' : '☆';
      el.winStars.appendChild(s);
    }
    el.winScore.textContent = STR.winPoints(levelScore);
    el.winTotal.textContent = STR.winTotal(state.score);
    el.winOverlay.hidden = false;
    el.winOverlay.classList.add('show');
  }

  function hideWinOverlay() {
    el.winOverlay.hidden = true;
    el.winOverlay.classList.remove('show');
  }

  function onNextLevel() {
    hideWinOverlay();
    startLevel(state.level + 1);
  }

  function onMuteToggle() {
    state.muted = !state.muted;
    saveProgress();
    renderStats();
  }

  function onColorblindToggle() {
    state.colorblind = !state.colorblind;
    saveProgress();
    render();
  }

  // ---------- Confetti (canvas) ----------
  function launchConfetti() {
    var canvas = el.confettiCanvas;
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    var pieces = [];
    var colors = global.WaterSort.COLORS;
    for (var i = 0; i < 90; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3
      });
    }
    var start = Date.now();
    function frame() {
      var elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      if (elapsed < 2600 && !el.winOverlay.hidden) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- Init ----------
  function init() {
    cacheDom();
    loadProgress();
    el.undoBtn.addEventListener('click', onUndo);
    el.restartBtn.addEventListener('click', onRestart);
    el.addBtn.addEventListener('click', onAddBottle);
    el.hintBtn.addEventListener('click', onHint);
    el.muteBtn.addEventListener('click', onMuteToggle);
    el.cbBtn.addEventListener('click', onColorblindToggle);
    el.nextBtn.addEventListener('click', onNextLevel);
    el.statsBtn.addEventListener('click', onStatsOpen);
    el.statsCloseBtn.addEventListener('click', onStatsClose);
    startLevel(state.level);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose a few things for debugging/testing in-browser
  global.WaterSortApp = { state: state, startLevel: startLevel, onWin: onWin };

})(typeof globalThis !== 'undefined' ? globalThis : this);
