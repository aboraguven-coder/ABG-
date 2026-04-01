// =============================================
// BlockDrop — Block Puzzle Game
// No timer, no internet, save & resume anytime
// =============================================

(() => {
  'use strict';

  // =====================
  // CONSTANTS
  // =====================
  const GRID = 10;
  const STORAGE_KEY = 'blockdrop_save';
  const HIGH_KEY = 'blockdrop_best';

  const COLORS = [
    '#6c5ce7', '#00cec9', '#ff6b6b', '#feca57',
    '#00b894', '#fd79a8', '#e17055'
  ];

  // Block shapes: each is a 2D array of 0s and 1s
  const SHAPES = [
    // Singles & small
    [[1]],
    [[1, 1]],
    [[1], [1]],
    [[1, 1, 1]],
    [[1], [1], [1]],
    [[1, 1], [1, 1]],

    // L-shapes
    [[1, 0], [1, 0], [1, 1]],
    [[0, 1], [0, 1], [1, 1]],
    [[1, 1], [1, 0], [1, 0]],
    [[1, 1], [0, 1], [0, 1]],
    [[1, 0], [1, 1]],
    [[0, 1], [1, 1]],
    [[1, 1], [1, 0]],
    [[1, 1], [0, 1]],

    // T-shapes
    [[1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 1], [1, 0]],
    [[0, 1], [1, 1], [0, 1]],

    // Lines
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
    [[1, 1, 1, 1, 1]],
    [[1], [1], [1], [1], [1]],

    // S/Z shapes
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[1, 0], [1, 1], [0, 1]],
    [[0, 1], [1, 1], [1, 0]],

    // Big blocks
    [[1, 1, 1], [1, 1, 1]],
    [[1, 1], [1, 1], [1, 1]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]],

    // Corner shapes
    [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1], [0, 0, 1]],
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
  ];

  // =====================
  // STATE
  // =====================
  let board = [];       // 10x10 grid, 0 = empty, color string = filled
  let pieces = [];      // current 3 pieces: { shape, color, used }
  let score = 0;
  let best = parseInt(localStorage.getItem(HIGH_KEY)) || 0;
  let selectedPiece = -1;
  let hoverCell = null; // { row, col } under cursor/touch
  let isDragging = false;
  let dragPieceIndex = -1;

  // Canvas
  let canvas, ctx;
  let cellSize = 0;
  let boardX = 0, boardY = 0;

  // =====================
  // DOM REFS
  // =====================
  const $ = id => document.getElementById(id);

  const startScreen   = $('startScreen');
  const gameScreen     = $('gameScreen');
  const pauseOverlay   = $('pauseOverlay');
  const gameOverOverlay = $('gameOverOverlay');
  const scoreValue     = $('scoreValue');
  const bestValue      = $('bestValue');
  const piecesTray     = $('piecesTray');
  const comboPopup     = $('comboPopup');
  const startHighscore = $('startHighscore');
  const btnContinue    = $('btnContinue');

  // =====================
  // INIT
  // =====================
  function init() {
    canvas = $('gameCanvas');
    ctx = canvas.getContext('2d');

    // Button events
    $('btnPlay').addEventListener('click', () => startNewGame());
    btnContinue.addEventListener('click', () => resumeSavedGame());
    $('btnPause').addEventListener('click', () => showPause());
    $('btnResume').addEventListener('click', () => hidePause());
    $('btnRestartPause').addEventListener('click', () => { hidePause(); startNewGame(); });
    $('btnHomePause').addEventListener('click', () => { hidePause(); goHome(); });
    $('btnRestartOver').addEventListener('click', () => { hideGameOver(); startNewGame(); });
    $('btnHomeOver').addEventListener('click', () => { hideGameOver(); goHome(); });

    // Canvas input
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    // Show start screen
    updateStartScreen();
  }

  // =====================
  // SCREENS
  // =====================
  function showScreen(screen) {
    [startScreen, gameScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  function showPause() {
    pauseOverlay.classList.add('active');
  }
  function hidePause() {
    pauseOverlay.classList.remove('active');
  }
  function showGameOver() {
    $('finalScore').textContent = score;
    const isNewBest = score > 0 && score >= best;
    $('finalBest').textContent = isNewBest ? 'New High Score!' : `Best: ${best}`;
    gameOverOverlay.classList.add('active');
  }
  function hideGameOver() {
    gameOverOverlay.classList.remove('active');
  }

  function goHome() {
    showScreen(startScreen);
    updateStartScreen();
  }

  function updateStartScreen() {
    best = parseInt(localStorage.getItem(HIGH_KEY)) || 0;
    startHighscore.textContent = best > 0 ? `High Score: ${best}` : '';

    const saved = localStorage.getItem(STORAGE_KEY);
    btnContinue.style.display = saved ? 'block' : 'none';
  }

  // =====================
  // GAME START / RESUME
  // =====================
  function startNewGame() {
    board = createEmptyBoard();
    score = 0;
    selectedPiece = -1;
    hoverCell = null;
    pieces = generatePieces();

    showScreen(gameScreen);
    sizeCanvas();
    updateUI();
    renderPiecesTray();
    drawBoard();
    saveGame();
  }

  function resumeSavedGame() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) { startNewGame(); return; }

    board = saved.board;
    score = saved.score;
    pieces = saved.pieces;
    selectedPiece = -1;
    hoverCell = null;

    showScreen(gameScreen);
    sizeCanvas();
    updateUI();
    renderPiecesTray();
    drawBoard();
  }

  function createEmptyBoard() {
    return Array.from({ length: GRID }, () => Array(GRID).fill(0));
  }

  // =====================
  // PIECE GENERATION
  // =====================
  function generatePieces() {
    const result = [];
    for (let i = 0; i < 3; i++) {
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      result.push({ shape, color, used: false });
    }
    return result;
  }

  // =====================
  // CANVAS SIZING
  // =====================
  function sizeCanvas() {
    const container = canvas.parentElement;
    const maxW = container.clientWidth - 32;
    const maxH = container.clientHeight - 16;
    const size = Math.min(maxW, maxH);

    const dpr = window.devicePixelRatio || 1;
    cellSize = Math.floor(size / GRID);
    const canvasSize = cellSize * GRID;

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rect = canvas.getBoundingClientRect();
    boardX = rect.left;
    boardY = rect.top;
  }

  window.addEventListener('resize', () => {
    if (gameScreen.classList.contains('active')) {
      sizeCanvas();
      drawBoard();
    }
  });

  // =====================
  // DRAWING
  // =====================
  function drawBoard() {
    const size = cellSize * GRID;
    ctx.clearRect(0, 0, size, size);

    // Draw grid cells
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = c * cellSize;
        const y = r * cellSize;

        if (board[r][c]) {
          // Filled cell
          ctx.fillStyle = board[r][c];
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

          // Inner highlight
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, 3);
          ctx.fillRect(x + 1, y + 1, 3, cellSize - 2);

          // Inner shadow
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(x + 1, y + cellSize - 4, cellSize - 2, 3);
          ctx.fillRect(x + cellSize - 4, y + 1, 3, cellSize - 2);
        } else {
          // Empty cell
          ctx.fillStyle = (r + c) % 2 === 0 ? '#1a1e38' : '#1e2240';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }
      }
    }

    // Draw hover preview
    if (hoverCell && selectedPiece >= 0 && pieces[selectedPiece] && !pieces[selectedPiece].used) {
      const piece = pieces[selectedPiece];
      const valid = canPlace(piece.shape, hoverCell.row, hoverCell.col);

      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (!piece.shape[r][c]) continue;
          const br = hoverCell.row + r;
          const bc = hoverCell.col + c;
          if (br < 0 || br >= GRID || bc < 0 || bc >= GRID) continue;

          const x = bc * cellSize;
          const y = br * cellSize;

          if (valid) {
            ctx.fillStyle = piece.color;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = '#ff6b6b';
            ctx.globalAlpha = 0.25;
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  // =====================
  // PIECES TRAY
  // =====================
  function renderPiecesTray() {
    piecesTray.innerHTML = '';

    pieces.forEach((piece, i) => {
      const slot = document.createElement('div');
      slot.className = 'piece-slot' + (piece.used ? ' used' : '') + (i === selectedPiece ? ' selected' : '');
      slot.dataset.index = i;

      const miniSize = Math.min(20, Math.floor(70 / Math.max(piece.shape.length, piece.shape[0].length)));
      const pcW = piece.shape[0].length * miniSize;
      const pcH = piece.shape.length * miniSize;

      const pc = document.createElement('canvas');
      pc.className = 'piece-canvas';
      pc.width = pcW;
      pc.height = pcH;
      pc.style.width = pcW + 'px';
      pc.style.height = pcH + 'px';

      const pctx = pc.getContext('2d');
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (!piece.shape[r][c]) continue;
          pctx.fillStyle = piece.color;
          pctx.fillRect(c * miniSize + 1, r * miniSize + 1, miniSize - 2, miniSize - 2);
          pctx.fillStyle = 'rgba(255,255,255,0.18)';
          pctx.fillRect(c * miniSize + 1, r * miniSize + 1, miniSize - 2, 2);
        }
      }

      slot.appendChild(pc);

      // Tap to select
      slot.addEventListener('pointerdown', (e) => {
        if (piece.used) return;
        e.preventDefault();
        selectPiece(i);
      });

      piecesTray.appendChild(slot);
    });
  }

  function selectPiece(index) {
    if (pieces[index].used) return;
    selectedPiece = selectedPiece === index ? -1 : index;
    renderPiecesTray();
    drawBoard();
  }

  // =====================
  // INPUT HANDLING
  // =====================
  function onPointerDown(e) {
    e.preventDefault();
    const pos = getCellFromEvent(e);
    if (!pos) return;

    if (selectedPiece >= 0) {
      // Try to place the piece
      hoverCell = pos;
      tryPlace();
    }

    isDragging = true;
  }

  function onPointerMove(e) {
    e.preventDefault();
    const pos = getCellFromEvent(e);

    if (selectedPiece >= 0) {
      hoverCell = pos;
      drawBoard();
    }
  }

  function onPointerUp(e) {
    e.preventDefault();
    isDragging = false;
  }

  function getCellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return null;
    return { row, col };
  }

  // =====================
  // PLACEMENT LOGIC
  // =====================
  function canPlace(shape, startRow, startCol) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const br = startRow + r;
        const bc = startCol + c;
        if (br < 0 || br >= GRID || bc < 0 || bc >= GRID) return false;
        if (board[br][bc]) return false;
      }
    }
    return true;
  }

  function tryPlace() {
    if (selectedPiece < 0 || !hoverCell) return;
    const piece = pieces[selectedPiece];
    if (piece.used) return;

    if (!canPlace(piece.shape, hoverCell.row, hoverCell.col)) return;

    // Place the piece
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        board[hoverCell.row + r][hoverCell.col + c] = piece.color;
      }
    }

    // Count cells placed for score
    let cellsPlaced = 0;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) cellsPlaced++;
      }
    }
    score += cellsPlaced;

    piece.used = true;
    selectedPiece = -1;
    hoverCell = null;

    // Clear lines
    const linesCleared = clearLines();
    if (linesCleared > 0) {
      const lineBonus = linesCleared * GRID * linesCleared; // bonus scales with combo
      score += lineBonus;
      showCombo(linesCleared);
    }

    // Check if all 3 pieces used — generate new set
    if (pieces.every(p => p.used)) {
      pieces = generatePieces();
    }

    updateUI();
    renderPiecesTray();
    drawBoard();
    saveGame();

    // Check game over
    if (isGameOver()) {
      setTimeout(() => {
        updateBest();
        localStorage.removeItem(STORAGE_KEY);
        showGameOver();
      }, 400);
    }
  }

  // =====================
  // LINE CLEARING
  // =====================
  function clearLines() {
    const rowsToClear = [];
    const colsToClear = [];

    // Check rows
    for (let r = 0; r < GRID; r++) {
      if (board[r].every(cell => cell !== 0)) {
        rowsToClear.push(r);
      }
    }

    // Check columns
    for (let c = 0; c < GRID; c++) {
      let full = true;
      for (let r = 0; r < GRID; r++) {
        if (!board[r][c]) { full = false; break; }
      }
      if (full) colsToClear.push(c);
    }

    // Clear them
    rowsToClear.forEach(r => {
      for (let c = 0; c < GRID; c++) board[r][c] = 0;
    });
    colsToClear.forEach(c => {
      for (let r = 0; r < GRID; r++) board[r][c] = 0;
    });

    return rowsToClear.length + colsToClear.length;
  }

  // =====================
  // GAME OVER CHECK
  // =====================
  function isGameOver() {
    for (const piece of pieces) {
      if (piece.used) continue;
      if (canPlaceAnywhere(piece.shape)) return false;
    }
    return true;
  }

  function canPlaceAnywhere(shape) {
    for (let r = 0; r <= GRID - shape.length; r++) {
      for (let c = 0; c <= GRID - shape[0].length; c++) {
        if (canPlace(shape, r, c)) return true;
      }
    }
    return false;
  }

  // =====================
  // COMBO DISPLAY
  // =====================
  function showCombo(lines) {
    const messages = ['', 'Clear!', 'Double!', 'Triple!', 'QUAD!'];
    const msg = messages[Math.min(lines, 4)] || `x${lines} COMBO!`;
    comboPopup.textContent = msg;
    comboPopup.classList.add('show');
    setTimeout(() => comboPopup.classList.remove('show'), 1200);
  }

  // =====================
  // UI UPDATES
  // =====================
  function updateUI() {
    scoreValue.textContent = score;
    bestValue.textContent = Math.max(best, score);
  }

  function updateBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(HIGH_KEY, best);
    }
  }

  // =====================
  // SAVE / LOAD
  // =====================
  function saveGame() {
    const state = { board, score, pieces };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
