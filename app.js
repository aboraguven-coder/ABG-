// =============================================
// NumDrop — Number Merge + Block Blast Puzzle
// No timer, offline, auto-save every move
// =============================================

(() => {
  'use strict';

  // =====================
  // CONFIG
  // =====================
  const GRID = 8;
  const SAVE_KEY = 'numdrop_save';
  const BEST_KEY = 'numdrop_best';

  // Number → color mapping (2048-inspired, dark-theme adjusted)
  const NUM_COLORS = {
    2:    { bg: '#4a4458', fg: '#e8e4f0' },
    4:    { bg: '#5b4e6e', fg: '#f0ecf5' },
    8:    { bg: '#c47f32', fg: '#fff' },
    16:   { bg: '#d46b3a', fg: '#fff' },
    32:   { bg: '#d95040', fg: '#fff' },
    64:   { bg: '#e03030', fg: '#fff' },
    128:  { bg: '#e6c440', fg: '#fff' },
    256:  { bg: '#e6c020', fg: '#fff' },
    512:  { bg: '#e0b810', fg: '#fff' },
    1024: { bg: '#ddb000', fg: '#fff' },
    2048: { bg: '#edc22e', fg: '#fff' },
    4096: { bg: '#a040e0', fg: '#fff' },
    8192: { bg: '#6020c0', fg: '#fff' },
  };

  function getNumColor(n) {
    if (NUM_COLORS[n]) return NUM_COLORS[n];
    return { bg: '#4020a0', fg: '#fff' };
  }

  // Block shapes (same as Block Blast style)
  const SHAPES = [
    // 1-cell
    [[1]],
    // 2-cell
    [[1, 1]],
    [[1], [1]],
    // 3-cell lines
    [[1, 1, 1]],
    [[1], [1], [1]],
    // L-shapes (3-cell)
    [[1, 1], [1, 0]],
    [[1, 1], [0, 1]],
    [[1, 0], [1, 1]],
    [[0, 1], [1, 1]],
    // 4-cell lines
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
    // 4-cell square
    [[1, 1], [1, 1]],
    // T-shapes
    [[1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 1], [1, 0]],
    [[0, 1], [1, 1], [0, 1]],
    // S/Z shapes
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    // L-shapes (4-cell)
    [[1, 0], [1, 0], [1, 1]],
    [[0, 1], [0, 1], [1, 1]],
    [[1, 1], [1, 0], [1, 0]],
    [[1, 1], [0, 1], [0, 1]],
    // 5-cell line
    [[1, 1, 1, 1, 1]],
    [[1], [1], [1], [1], [1]],
    // 2x3 / 3x2
    [[1, 1, 1], [1, 1, 1]],
    [[1, 1], [1, 1], [1, 1]],
    // 3x3
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    // Corner shapes
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
  ];

  // =====================
  // STATE
  // =====================
  let board = [];     // 8x8, each cell = 0 or a power-of-2 number
  let pieces = [];    // current 3 pieces: { shape, nums (2D matching shape), used }
  let score = 0;
  let best = 0;
  let selectedPiece = -1;
  let hoverCell = null;
  let animating = false;

  // Canvas refs
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
  const tray         = $('tray');
  const popup        = $('popup');

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

    // Canvas pointer events
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerleave', () => { hoverCell = null; draw(); });

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
    // Generate number for each filled cell
    // Higher scores → occasionally higher starting numbers
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
    const size = cellSize * GRID;
    ctx.clearRect(0, 0, size, size);

    const gap = 2;
    const radius = Math.max(3, cellSize * 0.12);

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = c * cellSize + gap;
        const y = r * cellSize + gap;
        const w = cellSize - gap * 2;
        const h = cellSize - gap * 2;

        if (board[r][c]) {
          // Filled cell with number
          const nc = getNumColor(board[r][c]);
          roundRect(x, y, w, h, radius, nc.bg);

          // Top shine
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.12));

          // Number text
          drawNum(board[r][c], x, y, w, h, nc.fg);
        } else {
          // Empty cell
          const shade = (r + c) % 2 === 0 ? '#181b28' : '#1c1f2e';
          roundRect(x, y, w, h, radius, shade);
        }
      }
    }

    // Draw hover preview
    if (hoverCell && selectedPiece >= 0 && pieces[selectedPiece] && !pieces[selectedPiece].used) {
      const piece = pieces[selectedPiece];
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
            ctx.globalAlpha = 0.5;
            roundRect(x, y, w, h, radius, nc.bg);
            drawNum(piece.nums[r][c], x, y, w, h, nc.fg);
            ctx.globalAlpha = 1;
          } else {
            ctx.globalAlpha = 0.25;
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
    ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x + w / 2, y + h / 2 + 1);
  }

  // =====================
  // TRAY
  // =====================
  function renderTray() {
    tray.innerHTML = '';

    pieces.forEach((piece, idx) => {
      const slot = document.createElement('div');
      slot.className = 'piece-slot' + (piece.used ? ' used' : '') + (idx === selectedPiece ? ' selected' : '');

      const miniSize = Math.min(18, Math.floor(65 / Math.max(piece.shape.length, piece.shape[0].length)));
      const pcW = piece.shape[0].length * miniSize;
      const pcH = piece.shape.length * miniSize;

      const pc = document.createElement('canvas');
      pc.className = 'piece-canvas';
      pc.width = pcW * 2;
      pc.height = pcH * 2;
      pc.style.width = pcW + 'px';
      pc.style.height = pcH + 'px';

      const pctx = pc.getContext('2d');
      pctx.setTransform(2, 0, 0, 2, 0, 0);

      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (!piece.shape[r][c]) continue;
          const num = piece.nums[r][c];
          const nc = getNumColor(num);
          const mg = 1;
          const bx = c * miniSize + mg;
          const by = r * miniSize + mg;
          const bw = miniSize - mg * 2;
          const bh = miniSize - mg * 2;

          pctx.fillStyle = nc.bg;
          pctx.beginPath();
          const rr = 2;
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
          pctx.fill();

          // Mini number
          const fs = miniSize * 0.45;
          pctx.fillStyle = nc.fg;
          pctx.font = `800 ${fs}px sans-serif`;
          pctx.textAlign = 'center';
          pctx.textBaseline = 'middle';
          pctx.fillText(String(num), bx + bw / 2, by + bh / 2 + 0.5);
        }
      }

      slot.appendChild(pc);
      slot.addEventListener('pointerdown', () => {
        if (piece.used || animating) return;
        selectedPiece = selectedPiece === idx ? -1 : idx;
        renderTray();
        draw();
      });

      tray.appendChild(slot);
    });
  }

  // =====================
  // INPUT
  // =====================
  function getCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return null;
    return { row, col };
  }

  function onMove(e) {
    if (animating) return;
    const cell = getCell(e);
    // Adjust hover to center the piece
    if (cell && selectedPiece >= 0 && pieces[selectedPiece]) {
      const p = pieces[selectedPiece];
      cell.row -= Math.floor(p.shape.length / 2);
      cell.col -= Math.floor(p.shape[0].length / 2);
    }
    hoverCell = cell;
    draw();
  }

  function onDown(e) {
    if (animating) return;
    const cell = getCell(e);
    if (!cell) return;

    if (selectedPiece >= 0) {
      const p = pieces[selectedPiece];
      // Center the piece on tap
      const adjRow = cell.row - Math.floor(p.shape.length / 2);
      const adjCol = cell.col - Math.floor(p.shape[0].length / 2);
      hoverCell = { row: adjRow, col: adjCol };
      tryPlace();
    }
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

  function tryPlace() {
    if (selectedPiece < 0 || !hoverCell || animating) return;
    const piece = pieces[selectedPiece];
    if (piece.used) return;
    if (!canPlace(piece, hoverCell.row, hoverCell.col)) return;

    // Place the piece on the board
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

    // Start merge + clear chain
    animating = true;
    renderTray();
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
        score += mergeCount * 10 * (chainStep + 1);
        draw();
        chainStep++;
        // Continue merging after a short delay
        setTimeout(step, 200);
        return;
      }

      // Phase 2: Clear full rows/columns
      const cleared = doClear();
      totalClears += cleared;

      if (cleared > 0) {
        score += cleared * GRID * 2;
        draw();
        // After clearing, check for new merges
        setTimeout(step, 250);
        return;
      }

      // Chain complete
      if (totalMerges > 0 || totalClears > 0) {
        if (totalMerges >= 3) showPopup('CHAIN!', 'merge-pop');
        else if (totalClears >= 2) showPopup('COMBO!', 'clear-pop');
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

      // Check game over
      if (isGameOver()) {
        setTimeout(showGameOver, 400);
      }
    }

    step();
  }

  // Merge: find adjacent pairs with same number, merge them
  // Returns number of merges performed in this pass
  function doMerges() {
    let merges = 0;

    // Scan bottom-right to top-left so merges "settle" naturally
    // But actually, scan all and collect merge targets, then apply
    const merged = Array.from({ length: GRID }, () => Array(GRID).fill(false));

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (!board[r][c] || merged[r][c]) continue;
        const val = board[r][c];

        // Check right neighbor
        if (c + 1 < GRID && board[r][c + 1] === val && !merged[r][c + 1]) {
          board[r][c + 1] = val * 2;
          board[r][c] = 0;
          merged[r][c + 1] = true;
          merges++;
          continue; // This cell is now empty, move on
        }

        // Check bottom neighbor
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

  // Clear full rows and columns
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
    $('overScore').textContent = score.toLocaleString();

    const oldBest = parseInt(localStorage.getItem(BEST_KEY)) || 0;
    const isNew = score > oldBest;
    if (isNew) {
      best = score;
      localStorage.setItem(BEST_KEY, best);
    }
    $('overBest').textContent = isNew ? 'New High Score!' : (oldBest > 0 ? `Best: ${oldBest.toLocaleString()}` : '');

    // Find highest number on board
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
  // POPUP
  // =====================
  function showPopup(text, cls) {
    popup.textContent = text;
    popup.className = 'popup show ' + cls;
    setTimeout(() => popup.classList.remove('show'), 1000);
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
