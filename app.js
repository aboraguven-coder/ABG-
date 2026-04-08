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
  const VIBE_KEY = 'numdrop_vibe';
  const PU_KEY = 'numdrop_pu';
  const PROGRESS_KEY = 'numdrop_progress';
  const GOLD_KEY = 'numdrop_gold';

  // One-time starting power-ups (persistent across games)
  const PU_START = { trash: 3, reshuffle: 1, hammer: 1, bomb: 1 };

  // Points required to fill the skill-progress bar (bigger = rarer drops)
  const SCORE_PER_REWARD = 2500;

  // Gold earned: 1 per this many points of score
  const GOLD_PER_POINT = 20;

  // Weighted probabilities for skill rewards
  const REWARD_WEIGHTS = [
    { name: 'trash',     w: 55, label: 'Trash' },
    { name: 'reshuffle', w: 25, label: 'Swap' },
    { name: 'hammer',    w: 15, label: 'Hammer' },
    { name: 'bomb',      w: 5,  label: 'Bomb',  rare: true },
  ];

  // Store prices for skills (in gold)
  const STORE_ITEMS = [
    { name: 'trash',     label: 'Trash',  price: 120, desc: 'Delete one tray piece.' },
    { name: 'reshuffle', label: 'Swap',   price: 240, desc: 'Replace all current pieces.' },
    { name: 'hammer',    label: 'Hammer', price: 320, desc: 'Remove one block on the board.' },
    { name: 'bomb',      label: 'Bomb',   price: 650, desc: 'Clear the entire board.', rare: true },
  ];

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

  // Place/crash sound
  function sfxPlace() {
    playTone(180, 0.14, 'triangle', 0.22);
    playTone(280, 0.1, 'sine', 0.12);
  }

  // "AMAZING!" big crash — rising arpeggio + low boom
  function sfxBigCrash() {
    if (!audioCtx || !soundOn) return;
    // Low boom
    playTone(120, 0.35, 'sine', 0.25, 70);
    // Rising bell arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.22, 'triangle', 0.18), i * 70);
    });
  }

  // --- BACKGROUND MUSIC ---
  // Peaceful lullaby — single sine melody with soft envelope. Very quiet.
  function startMusic() {
    if (!audioCtx || musicPlaying || !soundOn) return;
    musicPlaying = true;

    musicGain = audioCtx.createGain();
    musicGain.gain.setValueAtTime(0.028, audioCtx.currentTime);
    musicGain.connect(audioCtx.destination);

    // Gentle slow lullaby (C major): G4 C5 E5 C5 D5 A4 G4 (rest) — ~2s per note
    const melody = [
      392.00, 523.25, 659.25, 523.25,
      587.33, 440.00, 392.00, 0,
      523.25, 659.25, 783.99, 659.25,
      587.33, 523.25, 440.00, 0,
    ];

    let idx = 0;
    const noteDur = 2.0;

    function playNote() {
      if (!soundOn || !musicPlaying) return;
      const f = melody[idx % melody.length];
      idx++;
      if (!f) return; // rest
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, audioCtx.currentTime);
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.35);
      gain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + noteDur * 0.65);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + noteDur);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start();
      osc.stop(audioCtx.currentTime + noteDur + 0.1);
    }

    playNote();
    window._musicInterval = setInterval(playNote, noteDur * 1000);
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
    if (btn) btn.classList.toggle('muted', !soundOn);
    const setBtn = $('setSound');
    if (setBtn) setBtn.classList.toggle('on', soundOn);
    if (soundOn) startMusic();
    else stopMusic();
  }

  function toggleVibe() {
    vibeOn = !vibeOn;
    localStorage.setItem(VIBE_KEY, vibeOn ? 'on' : 'off');
    $('setVibe').classList.toggle('on', vibeOn);
    if (vibeOn && navigator.vibrate) navigator.vibrate(10);
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

  // Power-ups (persistent across games)
  let powerups = { ...PU_START };
  let activePU = null;       // current power-up mode: 'trash' | 'hammer' | null
  let currentStreak = 0;     // dynamic background level based on chain streaks
  let skillProgress = 0;     // 0..SCORE_PER_REWARD, fills to award random skill
  let gold = 0;              // persistent gold currency
  let vibeOn = true;         // vibration setting

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

    // Load persistent power-ups (first-ever load gets PU_START)
    loadPowerups();
    skillProgress = parseInt(localStorage.getItem(PROGRESS_KEY)) || 0;
    gold = parseInt(localStorage.getItem(GOLD_KEY)) || 0;
    vibeOn = localStorage.getItem(VIBE_KEY) !== 'off';

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

    // Store + settings
    $('btnStore').onclick = openStore;
    $('btnCloseStore').onclick = closeStore;
    $('btnSettings').onclick = openSettings;
    $('btnCloseSettings').onclick = closeSettings;
    $('setSound').onclick = toggleSound;
    $('setVibe').onclick = toggleVibe;
    $('btnResetProgress').onclick = resetAllProgress;

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
    $('homeGoldVal').textContent = gold.toLocaleString();
    $('hsTrash').textContent  = powerups.trash;
    $('hsSwap').textContent   = powerups.reshuffle;
    $('hsHammer').textContent = powerups.hammer;
    $('hsBomb').textContent   = powerups.bomb;
  }

  function updateGoldDisplays(pulse) {
    const hg = $('homeGoldVal');
    const gg = $('gameGoldVal');
    const sg = $('storeGoldVal');
    if (hg) hg.textContent = gold.toLocaleString();
    if (gg) gg.textContent = gold.toLocaleString();
    if (sg) sg.textContent = gold.toLocaleString();
    if (pulse) {
      [$('homeGoldPill'), $('gameGoldPill')].forEach(el => {
        if (!el) return;
        el.classList.remove('reward-bump');
        void el.offsetWidth;
        el.classList.add('reward-bump');
        setTimeout(() => el.classList.remove('reward-bump'), 520);
      });
    }
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
    // Power-ups and skillProgress persist across games — do not reset.
    setActivePU(null);
    currentStreak = 0;
    updateStreakClass();

    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    renderTray();
    renderPowerups();
    updateProgressBar();
    updateGoldDisplays(false);
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
    // Power-ups loaded from PU_KEY in init() — don't overwrite from save.
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
    updateProgressBar();
    updateGoldDisplays(false);
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
    // Faster difficulty curve — higher numbers appear sooner
    const tier = Math.min(4, Math.floor(score / 300));
    const pool = [2, 2, 2, 4, 4];
    if (tier >= 1) pool.push(4, 8, 8);
    if (tier >= 2) pool.push(8, 16);
    if (tier >= 3) pool.push(16, 16);
    if (tier >= 4) pool.push(32);

    return shape.map(row =>
      row.map(cell => cell ? pool[Math.floor(Math.random() * pool.length)] : 0)
    );
  }

  // =====================
  // CANVAS SIZING
  // =====================
  function sizeCanvas() {
    const wrap = $('boardWrap');
    const maxW = wrap.clientWidth - 12;
    const maxH = wrap.clientHeight - 8;
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

    const gap = 1;
    const radius = Math.max(2, cellSize * 0.09);

    // Background wash so empty cells look unified
    ctx.fillStyle = 'rgba(4, 12, 24, 0.75)';
    ctx.fillRect(0, 0, total, total);

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
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.14));
          drawNum(board[r][c], x, y, w, h, nc.fg);
        } else {
          // Empty cell: subtle fill + visible cyan border
          const shade = (r + c) % 2 === 0 ? 'rgba(12, 30, 56, 0.6)' : 'rgba(18, 42, 74, 0.6)';
          roundRect(x, y, w, h, radius, shade);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
      }
    }

    // Outer grid frame for clear separation
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, total - 1.5, total - 1.5);

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

    const preScore = score;
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

    setTimeout(() => runChain(preScore), 150);
  }

  // =====================
  // MERGE + CLEAR CHAIN
  // =====================
  function runChain(preScore) {
    if (preScore === undefined) preScore = score;
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

      // Chain complete — big combo detection
      const bigCombo = totalClears >= 3 || totalMerges >= 5 || (totalMerges >= 3 && totalClears >= 1);
      if (bigCombo) {
        showPopup('AMAZING!', 'bomb-pop');
        sfxBigCrash();
        document.body.classList.add('flash');
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('flash'), 450);
        setTimeout(() => document.body.classList.remove('shake'), 550);
        haptic(60);
      } else if (totalMerges >= 3) {
        showPopup('CHAIN!', 'merge-pop');
      } else if (totalClears >= 2) {
        showPopup('COMBO!', 'clear-pop');
      }

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

      // Award progress from total score gained this turn
      advanceProgress(score - preScore);

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
    if (vibeOn && navigator.vibrate) {
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
  function loadPowerups() {
    try {
      const raw = localStorage.getItem(PU_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        powerups = {
          trash:     Math.max(0, parseInt(data.trash)     || 0),
          reshuffle: Math.max(0, parseInt(data.reshuffle) || 0),
          hammer:    Math.max(0, parseInt(data.hammer)    || 0),
          bomb:      Math.max(0, parseInt(data.bomb)      || 0),
        };
      } else {
        // First ever load — give starting supply
        powerups = { ...PU_START };
        savePowerups();
      }
    } catch (e) {
      powerups = { ...PU_START };
    }
  }
  function savePowerups() {
    localStorage.setItem(PU_KEY, JSON.stringify(powerups));
  }

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

  // Trash: delete a single tray piece with a "poof" animation
  function trashPiece(idx) {
    if (powerups.trash <= 0) return;
    const piece = pieces[idx];
    if (!piece || piece.used) return;

    powerups.trash--;
    savePowerups();
    haptic(10);
    sfxPlace();

    // Poof animation on the slot DOM element
    const slot = trayEl.children[idx];
    if (slot) slot.classList.add('poofing');

    animating = true;
    setTimeout(() => {
      piece.used = true;
      if (pieces.every(p => p.used)) pieces = genPieces();
      setActivePU(null);
      renderPowerups();
      renderTray();
      draw();
      animating = false;
      save();
    }, 420);
  }

  // Swap: animate old pieces out, spin new ones in
  function useReshuffle() {
    powerups.reshuffle--;
    savePowerups();
    setActivePU(null);
    haptic(15);
    sfxPlace();
    showPopup('SWAP!', 'merge-pop');

    animating = true;

    // Animate current slots out
    Array.from(trayEl.children).forEach((slot, i) => {
      slot.style.animationDelay = (i * 60) + 'ms';
      slot.classList.add('swap-out');
    });

    setTimeout(() => {
      pieces = genPieces();
      renderTray();
      // Animate new slots in
      Array.from(trayEl.children).forEach((slot, i) => {
        slot.style.animationDelay = (i * 60) + 'ms';
        slot.classList.add('swap-in');
      });
      renderPowerups();
      draw();
      save();
      setTimeout(() => {
        Array.from(trayEl.children).forEach(slot => {
          slot.classList.remove('swap-in');
          slot.style.animationDelay = '';
        });
        animating = false;
      }, 600);
    }, 450);
  }

  // Hammer: animated strike on a board cell
  function useHammer(r, c) {
    if (powerups.hammer <= 0) return;
    if (!board[r][c]) return;
    powerups.hammer--;
    savePowerups();
    haptic(25);
    sfxPlace();
    setActivePU(null);

    animating = true;

    runHammerAnimation(r, c, () => {
      board[r][c] = 0;
      renderPowerups();
      draw();
      save();
      setTimeout(() => runChain(), 120);
    });
  }

  // Hammer strike effect: draw a swinging hammer on fxCanvas, then burst particles
  function runHammerAnimation(r, c, onDone) {
    const cx = c * cellSize + cellSize / 2;
    const cy = r * cellSize + cellSize / 2;
    const total = cellSize * GRID;
    const startTime = performance.now();
    const swingDur = 280;
    const burstDur = 450;
    const colors = ['#fb923c', '#facc15', '#f43f5e', '#22d3ee', '#a3e635'];
    const particles = [];
    let burstStarted = false;

    function spawnBurst() {
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 5;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: 2 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1,
        });
      }
      haptic(40);
      document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), 400);
    }

    function frame(now) {
      const elapsed = now - startTime;
      fxCtx.clearRect(0, 0, total, total);

      if (elapsed < swingDur) {
        // Swinging hammer animation — tilts then strikes
        const t = elapsed / swingDur;
        const ease = 1 - Math.pow(1 - t, 3);
        const angle = -1.1 + ease * 1.7; // swing from -63deg → +35deg
        const hx = cx;
        const hy = cy - cellSize * 1.6 * (1 - ease);
        fxCtx.save();
        fxCtx.translate(hx, hy);
        fxCtx.rotate(angle);
        const hs = cellSize * 0.9;
        // Handle
        fxCtx.fillStyle = '#b8865a';
        fxCtx.fillRect(-hs * 0.08, 0, hs * 0.16, hs * 0.9);
        // Head
        fxCtx.fillStyle = '#fb923c';
        fxCtx.shadowColor = 'rgba(251, 146, 60, 0.9)';
        fxCtx.shadowBlur = 20;
        roundRectCtx(fxCtx, -hs * 0.42, -hs * 0.2, hs * 0.84, hs * 0.4, hs * 0.1);
        fxCtx.shadowBlur = 0;
        // Shine
        fxCtx.fillStyle = 'rgba(255,255,255,0.35)';
        fxCtx.fillRect(-hs * 0.35, -hs * 0.15, hs * 0.7, hs * 0.06);
        fxCtx.restore();
      } else {
        if (!burstStarted) {
          burstStarted = true;
          spawnBurst();
        }
        const t = Math.min(1, (elapsed - swingDur) / burstDur);

        // Impact shockwave ring
        if (t < 0.6) {
          const ringR = cellSize * (0.3 + t * 2.5);
          const a = 1 - t / 0.6;
          fxCtx.strokeStyle = `rgba(251, 146, 60, ${a})`;
          fxCtx.lineWidth = 4;
          fxCtx.beginPath();
          fxCtx.arc(cx, cy, ringR, 0, Math.PI * 2);
          fxCtx.stroke();
        }

        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2;
          p.vx *= 0.98;
          p.life = 1 - t;
          if (p.life <= 0) return;
          fxCtx.globalAlpha = p.life;
          fxCtx.fillStyle = p.color;
          fxCtx.beginPath();
          fxCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          fxCtx.fill();
        });
        fxCtx.globalAlpha = 1;
      }

      if (elapsed < swingDur + burstDur) {
        requestAnimationFrame(frame);
      } else {
        fxCtx.clearRect(0, 0, total, total);
        if (onDone) onDone();
      }
    }

    // Clear the cell at impact
    setTimeout(() => {
      board[r][c] = 0;
      draw();
    }, swingDur);

    requestAnimationFrame(frame);
  }

  // Bomb: clear the entire board with a particle explosion + screen shake
  function useBomb() {
    powerups.bomb--;
    savePowerups();
    setActivePU(null);
    animating = true;
    haptic(80);
    sfxBigCrash();
    showPopup('BOOM!', 'bomb-pop');
    document.body.classList.add('flash');
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('flash'), 450);
    setTimeout(() => document.body.classList.remove('shake'), 550);

    // Count non-empty cells for score
    let count = 0;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) if (board[r][c]) count++;
    }
    const pts = count * 5;
    score += pts;
    if (pts > 0) showScorePop('+' + pts);

    runBombAnimation(() => {
      board = Array.from({ length: GRID }, () => Array(GRID).fill(0));
      updateHUD();
      renderPowerups();
      draw();
      save();
      animating = false;
    });
  }

  // ===== SKILL PROGRESS / RANDOM REWARDS =====
  function updateProgressBar() {
    const pct = Math.min(100, (skillProgress / SCORE_PER_REWARD) * 100);
    $('spFill').style.width = pct + '%';
    const remaining = Math.max(0, SCORE_PER_REWARD - skillProgress);
    $('spLabel').textContent = remaining > 0 ? `Next Skill • ${remaining}` : 'Skill Ready!';
  }

  function advanceProgress(points) {
    if (points <= 0) return;

    // Earn gold from score gained
    const goldGained = Math.floor(points / GOLD_PER_POINT);
    if (goldGained > 0) {
      gold += goldGained;
      localStorage.setItem(GOLD_KEY, gold);
      updateGoldDisplays(true);
    }

    skillProgress += points;
    let awarded = 0;
    while (skillProgress >= SCORE_PER_REWARD && awarded < 3) {
      skillProgress -= SCORE_PER_REWARD;
      awardRandomSkill();
      awarded++;
    }
    localStorage.setItem(PROGRESS_KEY, skillProgress);
    updateProgressBar();
    const bar = $('skillProgress');
    bar.classList.remove('filling');
    void bar.offsetWidth;
    bar.classList.add('filling');
    setTimeout(() => bar.classList.remove('filling'), 800);
  }

  function awardRandomSkill() {
    const total = REWARD_WEIGHTS.reduce((s, r) => s + r.w, 0);
    let roll = Math.random() * total;
    let chosen = REWARD_WEIGHTS[0];
    for (const r of REWARD_WEIGHTS) {
      roll -= r.w;
      if (roll <= 0) { chosen = r; break; }
    }
    powerups[chosen.name]++;
    savePowerups();
    renderPowerups();
    showSkillReward(chosen);

    // Pulse the awarded button
    const btnId = { trash: 'puTrash', reshuffle: 'puReshuffle', hammer: 'puHammer', bomb: 'puBomb' }[chosen.name];
    const btn = $(btnId);
    if (btn) {
      btn.classList.remove('reward-pulse');
      void btn.offsetWidth;
      btn.classList.add('reward-pulse');
      setTimeout(() => btn.classList.remove('reward-pulse'), 900);
    }
  }

  // Show the skill reward flyout with an SVG badge matching the skill
  function showSkillReward(reward) {
    const el = $('skillReward');
    const badge = $('srBadge');
    const nameEl = $('srName');
    badge.innerHTML = getSkillBadgeSVG(reward.name);
    nameEl.textContent = reward.label;
    el.classList.toggle('rare-drop', !!reward.rare);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    haptic(reward.rare ? 60 : 30);
    runConfetti(reward.rare);
    setTimeout(() => el.classList.remove('show'), 1800);
  }

  // Confetti burst on the effects canvas — used for skill rewards
  function runConfetti(rare) {
    if (!fxCtx) return;
    const total = cellSize * GRID;
    const cx = total / 2;
    const cy = total / 2;
    const particles = [];
    const colors = rare
      ? ['#f43f5e', '#fb923c', '#facc15', '#ffffff']
      : ['#22d3ee', '#a3e635', '#38bdf8', '#facc15', '#f472b6', '#ffffff'];
    const count = rare ? 80 : 60;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        w: 4 + Math.random() * 6,
        h: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }
    const startTime = performance.now();
    const duration = 1400;

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      fxCtx.clearRect(0, 0, total, total);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life = 1 - t;
        if (p.life <= 0) return;
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot);
        fxCtx.globalAlpha = p.life;
        fxCtx.fillStyle = p.color;
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.restore();
      });
      fxCtx.globalAlpha = 1;
      if (t < 1) requestAnimationFrame(frame);
      else fxCtx.clearRect(0, 0, total, total);
    }
    requestAnimationFrame(frame);
  }

  function getSkillBadgeSVG(name) {
    // Reuse the same SVG inlines as the power-up buttons (simplified)
    switch (name) {
      case 'trash':
        return `<svg viewBox="0 0 24 24" style="color:var(--neon-cyan);filter:drop-shadow(0 0 10px rgba(34,211,238,0.8))">
          <rect x="4" y="5.5" width="16" height="2" rx="1" fill="currentColor"/>
          <rect x="10" y="3" width="4" height="2" rx="0.5" fill="currentColor"/>
          <path d="M6 8 L7.2 20 Q7.3 21.2 8.5 21.2 L15.5 21.2 Q16.7 21.2 16.8 20 L18 8 Z" fill="currentColor"/>
        </svg>`;
      case 'reshuffle':
        return `<svg viewBox="0 0 24 24" style="color:var(--neon-lime);filter:drop-shadow(0 0 10px rgba(163,230,53,0.8))">
          <path d="M5 12 A 7 7 0 0 1 17 7 L15 9 L20 9 L20 4 L18 6 A 9 9 0 0 0 3 12 Z" fill="currentColor"/>
          <path d="M19 12 A 7 7 0 0 1 7 17 L9 15 L4 15 L4 20 L6 18 A 9 9 0 0 0 21 12 Z" fill="currentColor"/>
        </svg>`;
      case 'hammer':
        return `<svg viewBox="0 0 24 24" style="color:var(--neon-orange);filter:drop-shadow(0 0 10px rgba(251,146,60,0.8))">
          <rect x="4" y="3" width="13" height="6" rx="1.2" fill="currentColor"/>
          <rect x="10.2" y="9" width="2" height="12" rx="0.6" fill="#b8865a"/>
        </svg>`;
      case 'bomb':
        return `<svg viewBox="0 0 24 24" style="color:var(--neon-pink);filter:drop-shadow(0 0 14px rgba(244,63,94,0.9))">
          <circle cx="11" cy="14" r="7" fill="currentColor"/>
          <path d="M14 7.5 Q16 5.5 17.5 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <circle cx="17.5" cy="4" r="2" fill="#facc15"/>
        </svg>`;
    }
    return '';
  }

  // Helper: draw rounded rect on an arbitrary ctx
  function roundRectCtx(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.fill();
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
  // STORE
  // =====================
  function openStore() {
    renderStore();
    $('storeOverlay').classList.add('active');
    haptic(10);
  }
  function closeStore() {
    $('storeOverlay').classList.remove('active');
  }
  function renderStore() {
    const list = $('storeList');
    list.innerHTML = '';
    updateGoldDisplays(false);
    STORE_ITEMS.forEach(item => {
      const card = document.createElement('div');
      card.className = 'store-card' + (item.rare ? ' rare' : '');
      card.setAttribute('data-k', item.name);
      const owned = powerups[item.name] || 0;
      const canBuy = gold >= item.price;
      card.innerHTML = `
        <div class="sc-icon">${getSkillBadgeSVG(item.name)}</div>
        <div class="sc-info">
          <div class="sc-name">${item.label} <span style="opacity:0.6;font-size:10px">x${owned}</span></div>
          <div class="sc-desc">${item.desc}</div>
        </div>
        <button class="sc-buy" data-buy="${item.name}" ${canBuy ? '' : 'disabled'}>
          <span class="coin-icon"></span>${item.price}
        </button>
      `;
      list.appendChild(card);
    });
    // Wire buy buttons
    list.querySelectorAll('[data-buy]').forEach(btn => {
      btn.onclick = () => buySkill(btn.getAttribute('data-buy'));
    });
  }
  function buySkill(name) {
    const item = STORE_ITEMS.find(i => i.name === name);
    if (!item || gold < item.price) return;
    gold -= item.price;
    powerups[name]++;
    localStorage.setItem(GOLD_KEY, gold);
    savePowerups();
    haptic(25);
    sfxPlace();
    // Pulse the card
    const card = document.querySelector(`.store-card[data-k="${name}"]`);
    if (card) {
      card.classList.remove('just-bought');
      void card.offsetWidth;
      card.classList.add('just-bought');
    }
    renderStore();
    updateGoldDisplays(true);
    updateTitleScreen();
    renderPowerups();
  }

  // =====================
  // SETTINGS
  // =====================
  function openSettings() {
    $('setSound').classList.toggle('on', soundOn);
    $('setVibe').classList.toggle('on', vibeOn);
    $('settingsOverlay').classList.add('active');
    haptic(10);
  }
  function closeSettings() {
    $('settingsOverlay').classList.remove('active');
  }
  function resetAllProgress() {
    if (!confirm('Reset all progress? This clears your gold, skills, high score, and saves.')) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BEST_KEY);
    localStorage.removeItem(PU_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(GOLD_KEY);
    powerups = { ...PU_START };
    savePowerups();
    skillProgress = 0;
    gold = 0;
    best = 0;
    score = 0;
    closeSettings();
    goHome();
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
    // Power-ups and skillProgress persist via PU_KEY / PROGRESS_KEY separately.
    localStorage.setItem(SAVE_KEY, JSON.stringify({ board, score, pieces }));
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
