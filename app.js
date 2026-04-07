// =============================================
// NumDrop — Number Merge + Block Blast Puzzle
// Mobile game: drag & drop, haptics, PWA offline
// =============================================

(() => {
  'use strict';

  // =====================
  // CONFIG
  // =====================
  const GRID = 8;
  const SAVE_KEY = 'numdrop_save';
  const BEST_KEY = 'numdrop_best';
  const SOUND_KEY = 'numdrop_sound';

  // Starting power-up counts
  const PU_START = { trash: 3, reshuffle: 2, hammer: 2, bomb: 1 };

  // =====================
  // AUDIO ENGINE (Web Audio API — no files needed)
  // =====================
  let audioCtx = null;
  let soundOn = true;
  let musicGain = null;
  let musicPlaying = false;

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
  }

  // --- SFX ---
  function playTone(freq, duration, type, volume, ramp) {
    if (!audioCtx || !soundOn) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (ramp) osc.frequency.linearRampToValueAtTime(ramp, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  // Only the place/crash sound — user removed others, music plays instead
  function sfxPlace() {
    playTone(180, 0.14, 'triangle', 0.22);
    playTone(280, 0.1, 'sine', 0.12);
  }

  // --- BACKGROUND MUSIC ---
  // Simple ambient loop: soft chord progression
  function startMusic() {
    if (!audioCtx || musicPlaying || !soundOn) return;
    musicPlaying = true;

    musicGain = audioCtx.createGain();
    musicGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    musicGain.connect(audioCtx.destination);

    // Chord progression: Am → F → C → G (classic chill loop)
    const chords = [
      [220, 261.6, 329.6],   // Am
      [174.6, 220, 261.6],   // F
      [261.6, 329.6, 392],   // C
      [196, 246.9, 293.7],   // G
    ];

    let chordIdx = 0;
    let activeOscs = [];

    function playChord() {
      if (!soundOn || !musicPlaying) return;

      // Fade out old
      activeOscs.forEach(o => {
        try { o.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5); } catch(e) {}
      });
      setTimeout(() => {
        activeOscs.forEach(o => { try { o.osc.stop(); } catch(e) {} });
        activeOscs = [];
      }, 600);

      const chord = chords[chordIdx % chords.length];
      chord.forEach(freq => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.8);
        gain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 2.5);
        gain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 3.8);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 4.0);
        activeOscs.push({ osc, gain });
      });

      chordIdx++;
    }

    playChord();
    window._musicInterval = setInterval(playChord, 3800);
  }

  function stopMusic() {
    musicPlaying = false;
    if (window._musicInterval) {
      clearInterval(window._musicInterval);
      window._musicInterval = null;
    }
  }

  function toggleSound() {
    initAudio();
    soundOn = !soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    const btn = $('btnSound');
    btn.classList.toggle('muted', !soundOn);
    if (soundOn) {
      startMusic();
    } else {
      stopMusic();
    }
  }

  // Number → color mapping (vibrant & colorful)
  const NUM_COLORS = {
    2:    { bg: '#5b7cf7', fg: '#fff' },
    4:    { bg: '#8b5cf6', fg: '#fff' },
    8:    { bg: '#f59e0b', fg: '#fff' },
    16:   { bg: '#f97316', fg: '#fff' },
    32:   { bg: '#ef4444', fg: '#fff' },
    64:   { bg: '#ec4899', fg: '#fff' },
    128:  { bg: '#10b981', fg: '#fff' },
    256:  { bg: '#14b8a6', fg: '#fff' },
    512:  { bg: '#06b6d4', fg: '#fff' },
    1024: { bg: '#f43f5e', fg: '#fff' },
    2048: { bg: '#eab308', fg: '#fff' },
    4096: { bg: '#a855f7', fg: '#fff' },
    8192: { bg: '#6366f1', fg: '#fff' },
  };
  function getNumColor(n) {
    return NUM_COLORS[n] || { bg: '#4020a0', fg: '#fff' };
  }

  // Block shapes (Block Blast style)
  const SHAPES = [
    [[1]],
    [[1,1]], [[1],[1]],
    [[1,1,1]], [[1],[1],[1]],
    [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],
    [[1,1,1,1]], [[1],[1],[1],[1]],
    [[1,1],[1,1]],
    [[1,1,1],[0,1,0]], [[0,1,0],[1,1,1]],
    [[1,0],[1,1],[1,0]], [[0,1],[1,1],[0,1]],
    [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]],
    [[1,0],[1,0],[1,1]], [[0,1],[0,1],[1,1]],
    [[1,1],[1,0],[1,0]], [[1,1],[0,1],[0,1]],
    [[1,1,1,1,1]], [[1],[1],[1],[1],[1]],
    [[1,1,1],[1,1,1]], [[1,1],[1,1],[1,1]],
    [[1,1,1],[1,1,1],[1,1,1]],
    [[1,1,1],[1,0,0]], [[1,1,1],[0,0,1]],
    [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
  ];

  // =====================
  // STATE
  // =====================
  let board = [];
  let pieces = [];
  let score = 0;
  let best = 0;
  let selectedPiece = -1;
  let hoverCell = null;
  let animating = false;

  // Drag state
  let dragging = false;
  let dragIndex = -1;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Canvas
  let canvas, ctx;
  let fxCanvas, fxCtx;
  let cellSize = 0;

  // Power-ups
  let powerups = { ...PU_START };
  let activePU = null;       // current power-up mode: 'trash' | 'hammer' | null
  let currentStreak = 0;     // dynamic background level based on chain streaks

  // =====================
  // DOM
  // =====================
  const $ = id => document.getElementById(id);

  const titleScreen  = $('titleScreen');
  const gameScreen   = $('gameScreen');
  const pauseOverlay = $('pauseOverlay');
  const overOverlay  = $('overOverlay');
  const trayEl       = $('tray');
  const popup        = $('popup');
  const scorePop     = $('scorePop');
  const dragGhost    = $('dragGhost');

  // =====================
  // INIT
  // =====================
  function init() {
    canvas = $('boardCanvas');
    ctx = canvas.getContext('2d');
    fxCanvas = $('effectsCanvas');
    fxCtx = fxCanvas.getContext('2d');
    best = parseInt(localStorage.getItem(BEST_KEY)) || 0;

    // Sound button
    $('btnSound').onclick = toggleSound;
    // Restore muted state
    if (localStorage.getItem(SOUND_KEY) === 'off') {
      soundOn = false;
      $('btnSound').classList.add('muted');
    }

    // Init audio on first user interaction (required by browsers)
    const startAudioOnce = () => {
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (soundOn) startMusic();
      document.removeEventListener('pointerdown', startAudioOnce);
    };
    document.addEventListener('pointerdown', startAudioOnce);

    // Buttons
    $('btnNewGame').onclick = startNew;
    $('btnContinue').onclick = loadAndResume;
    $('btnPause').onclick = () => { pauseOverlay.classList.add('active'); stopMusic(); };
    $('btnResume').onclick = () => { pauseOverlay.classList.remove('active'); if (soundOn) startMusic(); };
    $('btnRestartP').onclick = () => { pauseOverlay.classList.remove('active'); startNew(); };
    $('btnHomeP').onclick = () => { pauseOverlay.classList.remove('active'); goHome(); };
    $('btnRetry').onclick = () => { overOverlay.classList.remove('active'); startNew(); };
    $('btnHomeO').onclick = () => { overOverlay.classList.remove('active'); goHome(); };

    // Power-up buttons
    $('puTrash').onclick     = () => togglePU('trash');
    $('puReshuffle').onclick = () => usePU('reshuffle');
    $('puHammer').onclick    = () => togglePU('hammer');
    $('puBomb').onclick      = () => usePU('bomb');
    $('hammerCancel').onclick = () => setActivePU(null);

    // Global pointer events for drag
    document.addEventListener('pointermove', onGlobalMove, { passive: false });
    document.addEventListener('pointerup', onGlobalUp);
    document.addEventListener('pointercancel', onGlobalUp);

    // Also support tap-to-place on board (for accessibility)
    canvas.addEventListener('pointerdown', onBoardTap);

    // Prevent context menu on long press
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Prevent pinch zoom
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('touchmove', e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    updateTitleScreen();
  }

  // =====================
  // SCREENS
  // =====================
  function showScreen(s) {
    [titleScreen, gameScreen].forEach(x => x.classList.remove('active'));
    s.classList.add('active');
  }

  function goHome() {
    stopMusic();
    currentStreak = 0;
    updateStreakClass();
    setActivePU(null);
    showScreen(titleScreen);
    updateTitleScreen();
  }

  function updateTitleScreen() {
    best = parseInt(localStorage.getItem(BEST_KEY)) || 0;
    $('titleBest').textContent = best > 0 ? `High Score: ${best.toLocaleString()}` : '';
    $('btnContinue').style.display = localStorage.getItem(SAVE_KEY) ? 'block' : 'none';
  }

  // =====================
  // NEW GAME / LOAD
  // =====================
  function startNew() {
    board = Array.from({ length: GRID }, () => Array(GRID).fill(0));
    score = 0;
    selectedPiece = -1;
    hoverCell = null;
    animating = false;
    dragging = false;
    dragIndex = -1;
    pieces = genPieces();
    powerups = { ...PU_START };
    setActivePU(null);
    currentStreak = 0;
    updateStreakClass();

    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    renderTray();
    renderPowerups();
    draw();
    save();
    if (soundOn) startMusic();
  }

  function loadAndResume() {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) { startNew(); return; }
    board = data.board;
    score = data.score;
    pieces = data.pieces;
    powerups = Object.assign({ ...PU_START }, data.powerups || {});
    selectedPiece = -1;
    hoverCell = null;
    animating = false;
    setActivePU(null);
    currentStreak = 0;
    updateStreakClass();

    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    renderTray();
    renderPowerups();
    draw();
    if (soundOn) startMusic();
  }

  // =====================
  // PIECE GENERATION
  // =====================
  function genPieces() {
    const result = [];
    for (let i = 0; i < 3; i++) {
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const nums = genNums(shape);
      result.push({ shape, nums, used: false });
    }
    return result;
  }

  function genNums(shape) {
    const tier = Math.min(3, Math.floor(score / 500));
    const pool = [2, 2, 2, 2, 4, 4];
    if (tier >= 1) pool.push(4, 4, 8);
    if (tier >= 2) pool.push(8, 8);
    if (tier >= 3) pool.push(16);

    return shape.map(row =>
      row.map(cell => cell ? pool[Math.floor(Math.random() * pool.length)] : 0)
    );
  }

  // =====================
  // CANVAS SIZING
  // =====================
  function sizeCanvas() {
    const wrap = $('boardWrap');
    const maxW = wrap.clientWidth - 24;
    const maxH = wrap.clientHeight - 12;
    const size = Math.min(maxW, maxH);

    const dpr = window.devicePixelRatio || 1;
    cellSize = Math.floor(size / GRID);
    const canvasSize = cellSize * GRID;

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Effects canvas mirrors the board canvas
    fxCanvas.width = canvasSize * dpr;
    fxCanvas.height = canvasSize * dpr;
    fxCanvas.style.width = canvasSize + 'px';
    fxCanvas.style.height = canvasSize + 'px';
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Position effects canvas on top of board canvas
    const boardRect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    fxCanvas.style.left = (boardRect.left - wrapRect.left) + 'px';
    fxCanvas.style.top  = (boardRect.top  - wrapRect.top)  + 'px';
  }

  window.addEventListener('resize', () => {
    if (gameScreen.classList.contains('active')) {
      sizeCanvas(); draw();
    }
  });

  // =====================
  // DRAWING
  // =====================
  function draw() {
    const total = cellSize * GRID;
    ctx.clearRect(0, 0, total, total);

    const gap = 2;
    const radius = Math.max(3, cellSize * 0.12);

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = c * cellSize + gap;
        const y = r * cellSize + gap;
        const w = cellSize - gap * 2;
        const h = cellSize - gap * 2;

        if (board[r][c]) {
          const nc = getNumColor(board[r][c]);
          roundRect(x, y, w, h, radius, nc.bg);
          // Shine
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.12));
          drawNum(board[r][c], x, y, w, h, nc.fg);
        } else {
          const shade = (r + c) % 2 === 0 ? '#1a1d30' : '#212540';
          roundRect(x, y, w, h, radius, shade);
        }
      }
    }

    // Hover preview (from drag or selected piece)
    const previewIdx = dragging ? dragIndex : selectedPiece;
    if (hoverCell && previewIdx >= 0 && pieces[previewIdx] && !pieces[previewIdx].used) {
      const piece = pieces[previewIdx];
      const valid = canPlace(piece, hoverCell.row, hoverCell.col);

      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (!piece.shape[r][c]) continue;
          const br = hoverCell.row + r;
          const bc = hoverCell.col + c;
          if (br < 0 || br >= GRID || bc < 0 || bc >= GRID) continue;

          const x = bc * cellSize + gap;
          const y = br * cellSize + gap;
          const w = cellSize - gap * 2;
          const h = cellSize - gap * 2;

          if (valid) {
            const nc = getNumColor(piece.nums[r][c]);
            ctx.globalAlpha = 0.55;
            roundRect(x, y, w, h, radius, nc.bg);
            drawNum(piece.nums[r][c], x, y, w, h, nc.fg);
            ctx.globalAlpha = 1;
          } else {
            ctx.globalAlpha = 0.2;
            roundRect(x, y, w, h, radius, '#ef4444');
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawNum(num, x, y, w, h, color) {
    const str = String(num);
    let fontSize;
    if (str.length <= 2) fontSize = cellSize * 0.42;
    else if (str.length === 3) fontSize = cellSize * 0.34;
    else fontSize = cellSize * 0.26;

    ctx.fillStyle = color;
    ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x + w / 2, y + h / 2 + 1);
  }

  // =====================
  // TRAY (piece slots)
  // =====================
  function renderTray() {
    trayEl.innerHTML = '';

    pieces.forEach((piece, idx) => {
      const slot = document.createElement('div');
      slot.className = 'piece-slot'
        + (piece.used ? ' used' : '')
        + (idx === selectedPiece ? ' selected' : '')
        + (dragging && idx === dragIndex ? ' dragging' : '')
        + (activePU === 'trash' && !piece.used ? ' trash-target' : '');

      const miniSize = Math.min(22, Math.floor(75 / Math.max(piece.shape.length, piece.shape[0].length)));
      const pcCanvas = createPieceCanvas(piece, miniSize);

      slot.appendChild(pcCanvas);

      // Start drag on pointerdown — unless trash mode (then tap to delete)
      slot.addEventListener('pointerdown', (e) => {
        if (piece.used || animating) return;
        if (activePU === 'trash') {
          e.preventDefault();
          trashPiece(idx);
          return;
        }
        e.preventDefault();
        startDrag(idx, e);
      });

      trayEl.appendChild(slot);
    });
  }

  function createPieceCanvas(piece, miniSize) {
    const pcW = piece.shape[0].length * miniSize;
    const pcH = piece.shape.length * miniSize;
    const dpr = 2;

    const pc = document.createElement('canvas');
    pc.className = 'piece-canvas';
    pc.width = pcW * dpr;
    pc.height = pcH * dpr;
    pc.style.width = pcW + 'px';
    pc.style.height = pcH + 'px';

    const pctx = pc.getContext('2d');
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mg = 1;
    const rr = 2;

    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const num = piece.nums[r][c];
        const nc = getNumColor(num);
        const bx = c * miniSize + mg;
        const by = r * miniSize + mg;
        const bw = miniSize - mg * 2;
        const bh = miniSize - mg * 2;

        // Rounded rect
        pctx.beginPath();
        pctx.moveTo(bx + rr, by);
        pctx.lineTo(bx + bw - rr, by);
        pctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rr);
        pctx.lineTo(bx + bw, by + bh - rr);
        pctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rr, by + bh);
        pctx.lineTo(bx + rr, by + bh);
        pctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rr);
        pctx.lineTo(bx, by + rr);
        pctx.quadraticCurveTo(bx, by, bx + rr, by);
        pctx.closePath();
        pctx.fillStyle = nc.bg;
        pctx.fill();

        // Number
        const fs = miniSize * 0.45;
        pctx.fillStyle = nc.fg;
        pctx.font = `800 ${fs}px sans-serif`;
        pctx.textAlign = 'center';
        pctx.textBaseline = 'middle';
        pctx.fillText(String(num), bx + bw / 2, by + bh / 2 + 0.5);
      }
    }
    return pc;
  }

  // =====================
  // DRAG & DROP
  // =====================
  function startDrag(idx, e) {
    dragging = true;
    dragIndex = idx;
    selectedPiece = -1;

    const piece = pieces[idx];

    // Create ghost canvas at board-cell size
    const ghostCanvas = createPieceCanvas(piece, cellSize);
    dragGhost.innerHTML = '';
    dragGhost.appendChild(ghostCanvas);
    dragGhost.classList.add('active');

    // Calculate offsets so ghost is centered on finger
    dragOffsetX = parseInt(ghostCanvas.style.width) / 2;
    dragOffsetY = parseInt(ghostCanvas.style.height) / 2;

    // Position ghost — offset upward so user can see it above their thumb
    const fingerOffset = 60;
    dragGhost.style.left = (e.clientX - dragOffsetX) + 'px';
    dragGhost.style.top = (e.clientY - dragOffsetY - fingerOffset) + 'px';

    // Calculate hover cell
    updateDragHover(e.clientX, e.clientY - fingerOffset);

    renderTray();
    draw();
    haptic(5);
  }

  function onGlobalMove(e) {
    if (!dragging) return;
    e.preventDefault();

    const fingerOffset = 60;
    const ghostX = e.clientX - dragOffsetX;
    const ghostY = e.clientY - dragOffsetY - fingerOffset;

    dragGhost.style.left = ghostX + 'px';
    dragGhost.style.top = ghostY + 'px';

    updateDragHover(e.clientX, e.clientY - fingerOffset);
    draw();
  }

  function onGlobalUp(e) {
    if (!dragging) return;

    const piece = pieces[dragIndex];
    if (hoverCell && canPlace(piece, hoverCell.row, hoverCell.col)) {
      placePiece(dragIndex);
    } else {
      // Invalid drop — snap back
      haptic(10);
    }

    // Clean up drag
    dragging = false;
    dragIndex = -1;
    hoverCell = null;
    dragGhost.classList.remove('active');
    renderTray();
    draw();
  }

  function updateDragHover(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const bx = clientX - rect.left;
    const by = clientY - rect.top;

    const piece = pieces[dragIndex];
    // Calculate which board cell the center of the ghost maps to
    const col = Math.floor(bx / cellSize) - Math.floor(piece.shape[0].length / 2);
    const row = Math.floor(by / cellSize) - Math.floor(piece.shape.length / 2);

    // Check if we're over the board area at all
    if (bx < -cellSize || bx > rect.width + cellSize || by < -cellSize || by > rect.height + cellSize) {
      hoverCell = null;
    } else {
      hoverCell = { row, col };
    }
  }

  // =====================
  // TAP-TO-PLACE (fallback)
  // =====================
  function onBoardTap(e) {
    if (animating || dragging) return;

    // Hammer mode — tap a cell to remove it
    if (activePU === 'hammer') {
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / cellSize);
      const row = Math.floor((e.clientY - rect.top)  / cellSize);
      if (row >= 0 && row < GRID && col >= 0 && col < GRID && board[row][col]) {
        useHammer(row, col);
      }
      return;
    }

    // If no piece selected, ignore
    if (selectedPiece < 0) return;

    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / cellSize);
    const row = Math.floor((e.clientY - rect.top) / cellSize);

    const p = pieces[selectedPiece];
    const adjRow = row - Math.floor(p.shape.length / 2);
    const adjCol = col - Math.floor(p.shape[0].length / 2);
    hoverCell = { row: adjRow, col: adjCol };

    if (canPlace(p, adjRow, adjCol)) {
      placePiece(selectedPiece);
    }
    hoverCell = null;
    draw();
  }

  // =====================
  // PLACEMENT
  // =====================
  function canPlace(piece, startRow, startCol) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const br = startRow + r;
        const bc = startCol + c;
        if (br < 0 || br >= GRID || bc < 0 || bc >= GRID) return false;
        if (board[br][bc] !== 0) return false;
      }
    }
    return true;
  }

  function canPlaceAnywhere(piece) {
    for (let r = 0; r <= GRID - piece.shape.length; r++) {
      for (let c = 0; c <= GRID - piece.shape[0].length; c++) {
        if (canPlace(piece, r, c)) return true;
      }
    }
    return false;
  }

  function placePiece(idx) {
    const piece = pieces[idx];
    if (!hoverCell || !canPlace(piece, hoverCell.row, hoverCell.col)) return;

    let cellsPlaced = 0;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        board[hoverCell.row + r][hoverCell.col + c] = piece.nums[r][c];
        cellsPlaced++;
      }
    }
    score += cellsPlaced;

    piece.used = true;
    selectedPiece = -1;
    hoverCell = null;

    haptic(15);
    sfxPlace();

    // Start merge + clear chain
    animating = true;
    renderTray();
    updateHUD();
    draw();

    setTimeout(() => runChain(), 150);
  }

  // =====================
  // MERGE + CLEAR CHAIN
  // =====================
  function runChain() {
    let totalMerges = 0;
    let totalClears = 0;
    let chainStep = 0;

    function step() {
      // Phase 1: Merge adjacent same numbers
      const mergeCount = doMerges();
      totalMerges += mergeCount;

      if (mergeCount > 0) {
        const pts = mergeCount * 10 * (chainStep + 1);
        score += pts;
        showScorePop('+' + pts);
        haptic(20);
        currentStreak++;
        updateStreakClass();
        updateHUD();
        draw();
        chainStep++;
        setTimeout(step, 220);
        return;
      }

      // Phase 2: Clear full rows/columns
      const cleared = doClear();
      totalClears += cleared;

      if (cleared > 0) {
        const pts = cleared * GRID * 2;
        score += pts;
        showScorePop('+' + pts);
        haptic(30);
        currentStreak++;
        updateStreakClass();
        updateHUD();
        draw();
        setTimeout(step, 260);
        return;
      }

      // Chain complete
      if (totalMerges >= 3) { showPopup('CHAIN!', 'merge-pop'); }
      else if (totalClears >= 2) { showPopup('COMBO!', 'clear-pop'); }

      // Decay streak when nothing happens this placement
      if (totalMerges === 0 && totalClears === 0) {
        currentStreak = Math.max(0, currentStreak - 1);
        updateStreakClass();
      }

      // Check if all 3 used → new set
      if (pieces.every(p => p.used)) {
        pieces = genPieces();
      }

      animating = false;
      updateHUD();
      renderTray();
      draw();
      save();

      if (isGameOver()) {
        setTimeout(showGameOver, 400);
      }
    }

    step();
  }

  // Flood fill: find all connected same-value cells starting from (r,c)
  function findGroup(r, c, val, visited) {
    const group = [];
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      if (cr < 0 || cr >= GRID || cc < 0 || cc >= GRID) continue;
      if (visited[cr][cc]) continue;
      if (board[cr][cc] !== val) continue;
      visited[cr][cc] = true;
      group.push([cr, cc]);
      stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
    }
    return group;
  }

  // Merge: find all connected groups of same numbers, merge each group at once
  // A group of N same-value cells with value V → one cell with value V * 2^(N-1)
  function doMerges() {
    let merges = 0;
    const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    const groupsToMerge = [];

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (!board[r][c] || visited[r][c]) continue;
        const val = board[r][c];
        const group = findGroup(r, c, val, visited);
        if (group.length >= 2) {
          groupsToMerge.push({ cells: group, val });
        }
      }
    }

    // Apply merges: pick the "last" cell (bottom-right-most) of each group as the target
    groupsToMerge.forEach(g => {
      const target = g.cells.reduce((best, cell) => {
        if (cell[0] > best[0] || (cell[0] === best[0] && cell[1] > best[1])) return cell;
        return best;
      }, g.cells[0]);

      // Clear all cells in group
      g.cells.forEach(([r, c]) => { board[r][c] = 0; });

      // Set target to merged value
      let mergedValue = g.val;
      for (let i = 1; i < g.cells.length; i++) mergedValue *= 2;
      board[target[0]][target[1]] = mergedValue;

      merges += g.cells.length - 1;
    });

    return merges;
  }

  function doClear() {
    const rowsToClear = [];
    const colsToClear = [];

    for (let r = 0; r < GRID; r++) {
      if (board[r].every(cell => cell !== 0)) rowsToClear.push(r);
    }
    for (let c = 0; c < GRID; c++) {
      let full = true;
      for (let r = 0; r < GRID; r++) {
        if (!board[r][c]) { full = false; break; }
      }
      if (full) colsToClear.push(c);
    }

    rowsToClear.forEach(r => {
      for (let c = 0; c < GRID; c++) board[r][c] = 0;
    });
    colsToClear.forEach(c => {
      for (let r = 0; r < GRID; r++) board[r][c] = 0;
    });

    return rowsToClear.length + colsToClear.length;
  }

  // =====================
  // GAME OVER
  // =====================
  function isGameOver() {
    // If player still has a rescue power-up, it's not game over
    if (powerups.reshuffle > 0 || powerups.trash > 0 || powerups.bomb > 0 || powerups.hammer > 0) {
      return false;
    }
    for (const piece of pieces) {
      if (piece.used) continue;
      if (canPlaceAnywhere(piece)) return false;
    }
    return true;
  }

  function showGameOver() {
    stopMusic();
    currentStreak = 0;
    updateStreakClass();
    haptic(50);
    $('overScore').textContent = score.toLocaleString();

    const oldBest = parseInt(localStorage.getItem(BEST_KEY)) || 0;
    const isNew = score > oldBest;
    if (isNew) {
      best = score;
      localStorage.setItem(BEST_KEY, best);
    }
    $('overBest').textContent = isNew ? 'New High Score!' : (oldBest > 0 ? `Best: ${oldBest.toLocaleString()}` : '');

    let highest = 0;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (board[r][c] > highest) highest = board[r][c];
      }
    }
    $('overHighest').textContent = highest > 0 ? `Highest tile: ${highest}` : '';

    localStorage.removeItem(SAVE_KEY);
    overOverlay.classList.add('active');
  }

  // =====================
  // HAPTIC FEEDBACK
  // =====================
  function haptic(ms) {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // =====================
  // POPUPS
  // =====================
  function showPopup(text, cls) {
    popup.textContent = text;
    popup.className = 'popup show ' + cls;
    setTimeout(() => popup.classList.remove('show'), 1000);
  }

  function showScorePop(text) {
    const sv = $('scoreVal');
    const rect = sv.getBoundingClientRect();

    scorePop.textContent = text;
    scorePop.style.left = (rect.left + rect.width / 2) + 'px';
    scorePop.style.top = (rect.bottom + 4) + 'px';
    scorePop.style.transform = 'translateX(-50%) translateY(0)';
    scorePop.className = 'score-pop';

    // Force reflow
    void scorePop.offsetWidth;
    scorePop.classList.add('show');
    setTimeout(() => scorePop.classList.remove('show'), 600);

    // Score bump animation
    sv.classList.add('bump');
    setTimeout(() => sv.classList.remove('bump'), 150);
  }

  // =====================
  // HUD
  // =====================
  function updateHUD() {
    $('scoreVal').textContent = score.toLocaleString();
    $('bestVal').textContent = Math.max(best, score).toLocaleString();
  }

  // =====================
  // POWER-UPS
  // =====================
  function renderPowerups() {
    const map = {
      trash: $('puTrash'),
      reshuffle: $('puReshuffle'),
      hammer: $('puHammer'),
      bomb: $('puBomb'),
    };
    Object.keys(map).forEach(k => {
      const btn = map[k];
      const count = powerups[k] || 0;
      btn.classList.toggle('empty', count <= 0);
      btn.classList.toggle('active', activePU === k);
    });
    $('puTrashCount').textContent     = powerups.trash;
    $('puReshuffleCount').textContent = powerups.reshuffle;
    $('puHammerCount').textContent    = powerups.hammer;
    $('puBombCount').textContent      = powerups.bomb;
  }

  function setActivePU(name) {
    activePU = name;
    document.body.classList.toggle('hammer-active', name === 'hammer');
    $('hammerMode').classList.toggle('active', name === 'hammer');
    renderPowerups();
    renderTray();
  }

  function togglePU(name) {
    if (animating) return;
    if (powerups[name] <= 0) return;
    setActivePU(activePU === name ? null : name);
  }

  function usePU(name) {
    if (animating) return;
    if (powerups[name] <= 0) return;
    if (name === 'reshuffle') useReshuffle();
    else if (name === 'bomb') useBomb();
  }

  // Trash: remove a single piece from the tray
  function trashPiece(idx) {
    if (powerups.trash <= 0) return;
    const piece = pieces[idx];
    if (!piece || piece.used) return;

    powerups.trash--;
    piece.used = true;
    haptic(10);

    // If all 3 used → refresh
    if (pieces.every(p => p.used)) pieces = genPieces();

    setActivePU(null);
    renderPowerups();
    renderTray();
    draw();
    save();
  }

  // Swap: replace all current (unused) pieces with new ones
  function useReshuffle() {
    powerups.reshuffle--;
    pieces = genPieces();
    setActivePU(null);
    haptic(15);
    showPopup('SWAP!', 'merge-pop');
    renderPowerups();
    renderTray();
    draw();
    save();
  }

  // Hammer: remove a single block from the board
  function useHammer(r, c) {
    if (powerups.hammer <= 0) return;
    if (!board[r][c]) return;
    powerups.hammer--;
    board[r][c] = 0;
    haptic(20);
    sfxPlace();
    setActivePU(null);
    renderPowerups();
    draw();
    save();

    // Trigger merges/clears after removal
    animating = true;
    setTimeout(() => runChain(), 150);
  }

  // Bomb: clear the entire board with an explosion
  function useBomb() {
    powerups.bomb--;
    setActivePU(null);
    animating = true;
    haptic(60);
    showPopup('BOOM!', 'bomb-pop');
    document.body.classList.add('flash');
    setTimeout(() => document.body.classList.remove('flash'), 450);

    // Count non-empty cells for score
    let count = 0;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) if (board[r][c]) count++;
    }
    const pts = count * 5;
    score += pts;
    if (pts > 0) showScorePop('+' + pts);

    runBombAnimation(() => {
      // Clear board after animation
      board = Array.from({ length: GRID }, () => Array(GRID).fill(0));
      updateHUD();
      renderPowerups();
      draw();
      save();
      animating = false;
    });
  }

  // Particle-based bomb explosion on the effects canvas
  function runBombAnimation(onDone) {
    const total = cellSize * GRID;
    const cx = total / 2;
    const cy = total / 2;
    const particles = [];
    const colors = ['#f43f5e', '#fb923c', '#facc15', '#22d3ee', '#a3e635', '#38bdf8'];

    // Rings of particles
    for (let i = 0; i < 90; i++) {
      const angle = (Math.PI * 2 * i) / 90 + Math.random() * 0.2;
      const speed = 4 + Math.random() * 6;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }

    const startTime = performance.now();
    const duration = 900;

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      fxCtx.clearRect(0, 0, total, total);

      // Central flash
      if (t < 0.3) {
        const a = 1 - (t / 0.3);
        const grad = fxCtx.createRadialGradient(cx, cy, 0, cx, cy, total * 0.6);
        grad.addColorStop(0, `rgba(255, 255, 255, ${a * 0.9})`);
        grad.addColorStop(0.3, `rgba(251, 146, 60, ${a * 0.7})`);
        grad.addColorStop(0.7, `rgba(244, 63, 94, ${a * 0.3})`);
        grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        fxCtx.fillStyle = grad;
        fxCtx.fillRect(0, 0, total, total);
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.vx *= 0.985;
        p.life = 1 - t;
        if (p.life <= 0) return;
        fxCtx.globalAlpha = p.life;
        fxCtx.fillStyle = p.color;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        fxCtx.fill();
      });
      fxCtx.globalAlpha = 1;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        fxCtx.clearRect(0, 0, total, total);
        if (onDone) onDone();
      }
    }

    // Clear board visually mid-animation
    setTimeout(() => {
      board = Array.from({ length: GRID }, () => Array(GRID).fill(0));
      draw();
    }, 250);

    requestAnimationFrame(frame);
  }

  // =====================
  // DYNAMIC BACKGROUND (reacts to chain streaks)
  // =====================
  function updateStreakClass() {
    const body = document.body;
    body.classList.remove('streak-1', 'streak-2', 'streak-3');
    if (currentStreak >= 5) body.classList.add('streak-3');
    else if (currentStreak >= 3) body.classList.add('streak-2');
    else if (currentStreak >= 1) body.classList.add('streak-1');
  }

  // =====================
  // SAVE / LOAD
  // =====================
  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ board, score, pieces, powerups }));
  }

  // =====================
  // START
  // =====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
