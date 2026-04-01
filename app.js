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
  let cellSize = 0;

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
    best = parseInt(localStorage.getItem(BEST_KEY)) || 0;

    // Buttons
    $('btnNewGame').onclick = startNew;
    $('btnContinue').onclick = loadAndResume;
    $('btnPause').onclick = () => pauseOverlay.classList.add('active');
    $('btnResume').onclick = () => pauseOverlay.classList.remove('active');
    $('btnRestartP').onclick = () => { pauseOverlay.classList.remove('active'); startNew(); };
    $('btnHomeP').onclick = () => { pauseOverlay.classList.remove('active'); goHome(); };
    $('btnRetry').onclick = () => { overOverlay.classList.remove('active'); startNew(); };
    $('btnHomeO').onclick = () => { overOverlay.classList.remove('active'); goHome(); };

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

    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    renderTray();
    draw();
    save();
  }

  function loadAndResume() {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) { startNew(); return; }
    board = data.board;
    score = data.score;
    pieces = data.pieces;
    selectedPiece = -1;
    hoverCell = null;
    animating = false;

    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    renderTray();
    draw();
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
        + (dragging && idx === dragIndex ? ' dragging' : '');

      const miniSize = Math.min(22, Math.floor(75 / Math.max(piece.shape.length, piece.shape[0].length)));
      const pcCanvas = createPieceCanvas(piece, miniSize);

      slot.appendChild(pcCanvas);

      // Start drag on pointerdown
      slot.addEventListener('pointerdown', (e) => {
        if (piece.used || animating) return;
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
        updateHUD();
        draw();
        setTimeout(step, 260);
        return;
      }

      // Chain complete
      if (totalMerges >= 3) showPopup('CHAIN!', 'merge-pop');
      else if (totalClears >= 2) showPopup('COMBO!', 'clear-pop');

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

  function doMerges() {
    let merges = 0;
    const merged = Array.from({ length: GRID }, () => Array(GRID).fill(false));

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (!board[r][c] || merged[r][c]) continue;
        const val = board[r][c];

        // Check right
        if (c + 1 < GRID && board[r][c + 1] === val && !merged[r][c + 1]) {
          board[r][c + 1] = val * 2;
          board[r][c] = 0;
          merged[r][c + 1] = true;
          merges++;
          continue;
        }
        // Check down
        if (r + 1 < GRID && board[r + 1][c] === val && !merged[r + 1][c]) {
          board[r + 1][c] = val * 2;
          board[r][c] = 0;
          merged[r + 1][c] = true;
          merges++;
        }
      }
    }
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
    for (const piece of pieces) {
      if (piece.used) continue;
      if (canPlaceAnywhere(piece)) return false;
    }
    return true;
  }

  function showGameOver() {
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
  // SAVE / LOAD
  // =====================
  function save() {
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
