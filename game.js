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

  // Reverse-pour based generator: start solved, undo random legal pours.
  // A reverse pour takes a "pour" backwards: pick bottle `to` that received
  // a pour last (has some run at top) and move that run back to a bottle
  // that could have been its source (empty, or not full, and not equal top
  // to avoid degenerate no-ops beyond capacity).
  function generateLevel(level) {
    var numColors = Math.min(3 + Math.floor((level - 1) / 2), 12);
    var numEmpty = level < 3 ? 2 : (level < 8 ? 2 : (level < 20 ? 2 : 2));
    // extra empties scale slightly for very high levels to keep solvable/playable
    if (numColors >= 8) numEmpty = 2;
    if (numColors >= 11) numEmpty = 3;
    var maxBottles = 14;
    var totalBottles = Math.min(numColors + numEmpty, maxBottles);
    numEmpty = totalBottles - numColors;
    if (numEmpty < 1) numEmpty = 1;

    var bottles = buildSolvedState(numColors, numEmpty);
    var shuffleCount = 40 + level * 6; // increases difficulty
    shuffleCount = Math.min(shuffleCount, 400);

    var rng = mulberry32(level * 2654435761 % 2147483647 + 12345);

    for (var iter = 0; iter < shuffleCount; iter++) {
      var reverseMoves = getReverseMoves(bottles);
      if (reverseMoves.length === 0) continue;
      var m = reverseMoves[Math.floor(rng() * reverseMoves.length)];
      bottles = applyReverseMove(bottles, m[0], m[1]);
    }

    // Safety: ensure not already solved and has at least one legal move
    if (isSolved(bottles) || legalMoves(bottles).length === 0) {
      return generateLevel(level + 1); // extremely unlikely fallback
    }
    return { bottles: bottles, numColors: numColors };
  }

  // A reverse move: pick a source bottle `s` with a top run (1..3 units,
  // since a full untouched bottle of 4 same color reversing would be a no-op
  // reveal) and a destination bottle `d` that is empty or has different top
  // color or has room, simulating "undoing" a pour from d to s.
  // We define: reverseMove(from=d, to=s) means: take top run off d (which
  // represents liquid that was poured there) and put it onto s.
  function getReverseMoves(bottles) {
    var moves = [];
    for (var d = 0; d < bottles.length; d++) {
      if (bottles[d].length === 0) continue;
      var topColor = bottles[d][bottles[d].length - 1];
      // run length at top of d
      var runLen = 0;
      for (var i = bottles[d].length - 1; i >= 0; i--) {
        if (bottles[d][i] === topColor) runLen++; else break;
      }
      for (var s = 0; s < bottles.length; s++) {
        if (s === d) continue;
        var srcStack = bottles[s];
        var room = CAPACITY - srcStack.length;
        if (room <= 0) continue;
        // valid reverse target: empty bottle, or top matches topColor
        if (srcStack.length === 0 || srcStack[srcStack.length - 1] === topColor) {
          moves.push([d, s]); // move run from d -> s
        }
      }
    }
    return moves;
  }

  function applyReverseMove(bottles, from, to) {
    var b = bottles.map(function (s) { return s.slice(); });
    var src = b[from], dst = b[to];
    var topColor = src[src.length - 1];
    var room = CAPACITY - dst.length;
    var runLen = 0;
    for (var i = src.length - 1; i >= 0; i--) {
      if (src[i] === topColor) runLen++; else break;
    }
    var moveCount = Math.min(runLen, room);
    // random partial move to increase variety (at least 1)
    if (moveCount > 1) {
      moveCount = 1 + Math.floor(Math.random() * moveCount);
    }
    for (var k = 0; k < moveCount; k++) dst.push(src.pop());
    return b;
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
    mulberry32: mulberry32
  };

  // ---------- UI / App (only runs in browser) ----------
  if (typeof document === 'undefined') return;

  var STORAGE_KEY = 'watersort_save_v1';

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
    won: false
  };

  function saveProgress() {
    try {
      var data = {
        level: state.level,
        score: state.score,
        bestScore: state.bestScore,
        muted: state.muted,
        colorblind: state.colorblind
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore storage errors */ }
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (typeof data.level === 'number') state.level = data.level;
      if (typeof data.score === 'number') state.score = data.score;
      if (typeof data.bestScore === 'number') state.bestScore = data.bestScore;
      if (typeof data.muted === 'boolean') state.muted = data.muted;
      if (typeof data.colorblind === 'boolean') state.colorblind = data.colorblind;
    } catch (e) { /* ignore parse errors */ }
  }

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
    el.nextBtn = document.getElementById('btn-next');
    el.stuckBanner = document.getElementById('stuck-banner');
    el.confettiCanvas = document.getElementById('confetti-canvas');
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
    bottle.setAttribute('aria-label', 'Bottle ' + (idx + 1));

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
    state.selected = -1;
    clearHint();
    render();
  }

  function onRestart() {
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
    highlightHint(best[0], best[1]);
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
    saveProgress();
    sounds.win();
    renderStats();
    showWinOverlay(levelScore);
    launchConfetti();
  }

  function showWinOverlay(levelScore) {
    var stars = 1;
    if (state.moves <= 15) stars = 3; else if (state.moves <= 25) stars = 2;
    el.winStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    el.winScore.textContent = '+' + levelScore + ' points';
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
    startLevel(state.level);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose a few things for debugging/testing in-browser
  global.WaterSortApp = { state: state, startLevel: startLevel };

})(typeof globalThis !== 'undefined' ? globalThis : this);
