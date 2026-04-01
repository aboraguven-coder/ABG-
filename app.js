// =============================================
// ShadowKeep — Turn-Based Dungeon Crawler
// No timer, offline, auto-save every move
// =============================================

(() => {
  'use strict';

  // =====================
  // CONFIG
  // =====================
  const MAP_W = 30;
  const MAP_H = 24;
  const SAVE_KEY = 'shadowkeep_save';
  const BEST_KEY = 'shadowkeep_best';
  const TILE_SIZE_BASE = 20;

  // Tile types
  const T = {
    VOID: 0,
    FLOOR: 1,
    WALL: 2,
    STAIRS: 3,
    POTION: 4,
    GOLD: 5,
  };

  // Colors
  const TILE_COLORS = {
    [T.VOID]:   '#0a0c14',
    [T.FLOOR]:  '#1a1e30',
    [T.WALL]:   '#2c3150',
    [T.STAIRS]: '#1a1e30',
    [T.POTION]: '#1a1e30',
    [T.GOLD]:   '#1a1e30',
  };

  const PLAYER_COLOR = '#c084fc';
  const ENEMY_COLORS = ['#ef4444', '#f97316', '#ec4899', '#f43f5e', '#dc2626'];
  const STAIRS_COLOR = '#60a5fa';
  const POTION_COLOR = '#34d399';
  const GOLD_COLOR   = '#fbbf24';

  // Enemy templates per difficulty tier
  const ENEMY_TYPES = [
    { name: 'Rat',       icon: 'r', hp: 3,  atk: 1, xpGold: 2  },
    { name: 'Bat',       icon: 'b', hp: 4,  atk: 2, xpGold: 3  },
    { name: 'Goblin',    icon: 'g', hp: 6,  atk: 3, xpGold: 5  },
    { name: 'Skeleton',  icon: 's', hp: 8,  atk: 4, xpGold: 7  },
    { name: 'Orc',       icon: 'o', hp: 12, atk: 5, xpGold: 10 },
    { name: 'Wraith',    icon: 'w', hp: 15, atk: 6, xpGold: 12 },
    { name: 'Troll',     icon: 't', hp: 20, atk: 7, xpGold: 15 },
    { name: 'Demon',     icon: 'd', hp: 25, atk: 8, xpGold: 18 },
    { name: 'Dragon',    icon: 'D', hp: 35, atk: 10, xpGold: 25 },
  ];

  // =====================
  // STATE
  // =====================
  let state = null; // { map, player, enemies, floor, gold, kills, messages }

  let canvas, ctx;
  let tileSize = TILE_SIZE_BASE;
  let cameraX = 0, cameraY = 0;
  let viewW = 0, viewH = 0;

  // =====================
  // DOM
  // =====================
  const $ = id => document.getElementById(id);

  const titleScreen   = $('titleScreen');
  const howScreen      = $('howScreen');
  const gameScreen     = $('gameScreen');
  const menuOverlay    = $('menuOverlay');
  const deathOverlay   = $('deathOverlay');

  // =====================
  // INIT
  // =====================
  function init() {
    canvas = $('mapCanvas');
    ctx = canvas.getContext('2d');

    // Title buttons
    $('btnNewGame').addEventListener('click', startNewGame);
    $('btnContinue').addEventListener('click', loadAndResume);
    $('btnHowTo').addEventListener('click', () => showScreen(howScreen));
    $('btnBackHow').addEventListener('click', () => showScreen(titleScreen));

    // Game buttons
    $('btnMenu').addEventListener('click', showMenu);
    $('btnResume').addEventListener('click', hideMenu);
    $('btnRestart').addEventListener('click', () => { hideMenu(); startNewGame(); });
    $('btnHomeMenu').addEventListener('click', () => { hideMenu(); goHome(); });

    // Death buttons
    $('btnRetry').addEventListener('click', () => { hideDeath(); startNewGame(); });
    $('btnHomeDeath').addEventListener('click', () => { hideDeath(); goHome(); });

    // D-pad
    document.querySelectorAll('.dpad-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDirection(btn.dataset.dir));
    });

    // Keyboard
    window.addEventListener('keydown', onKey);

    // Swipe on map
    let touchStart = null;
    canvas.addEventListener('pointerdown', e => {
      touchStart = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', e => {
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchStart = null;

      if (dist < 15) {
        // Tap — try to move toward tapped cell
        handleTap(e);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        handleDirection(dx > 0 ? 'right' : 'left');
      } else {
        handleDirection(dy > 0 ? 'down' : 'up');
      }
    });

    // Show title
    updateTitle();
  }

  // =====================
  // SCREENS
  // =====================
  function showScreen(screen) {
    [titleScreen, howScreen, gameScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  function showMenu() {
    $('pauseFloor').textContent = state.floor;
    $('pauseGold').textContent = state.gold;
    menuOverlay.classList.add('active');
  }
  function hideMenu() { menuOverlay.classList.remove('active'); }

  function showDeath() {
    $('deathFloor').textContent = state.floor;
    $('deathGold').textContent = state.gold;
    $('deathKills').textContent = state.kills;

    const best = loadBest();
    const isRecord = state.floor > best.floor || (state.floor === best.floor && state.gold > best.gold);
    if (isRecord) {
      saveBest({ floor: state.floor, gold: state.gold, kills: state.kills });
      $('deathRecord').textContent = 'New Record!';
    } else {
      $('deathRecord').textContent = best.floor > 0 ? `Record: Floor ${best.floor}` : '';
    }

    localStorage.removeItem(SAVE_KEY);
    deathOverlay.classList.add('active');
  }
  function hideDeath() { deathOverlay.classList.remove('active'); }

  function goHome() {
    showScreen(titleScreen);
    updateTitle();
  }

  function updateTitle() {
    const saved = localStorage.getItem(SAVE_KEY);
    $('btnContinue').style.display = saved ? 'block' : 'none';

    const best = loadBest();
    $('titleStats').innerHTML = best.floor > 0
      ? `Deepest: Floor ${best.floor} &bull; Best Gold: ${best.gold}`
      : 'Enter the dungeon...';
  }

  // =====================
  // NEW GAME / LOAD
  // =====================
  function startNewGame() {
    state = {
      map: null,
      player: { x: 0, y: 0, hp: 20, maxHp: 20, atk: 3 },
      enemies: [],
      floor: 1,
      gold: 0,
      kills: 0,
    };

    generateFloor();
    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    log('You enter the dungeon...', '');
    render();
    saveGame();
  }

  function loadAndResume() {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) { startNewGame(); return; }
    state = JSON.parse(data);
    showScreen(gameScreen);
    sizeCanvas();
    updateHUD();
    log('Welcome back, adventurer.', '');
    render();
  }

  // =====================
  // MAP GENERATION
  // =====================
  function generateFloor() {
    // Create empty map
    const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(T.WALL));

    // Generate rooms using BSP-lite
    const rooms = [];
    carveRooms(map, rooms, 1, 1, MAP_W - 2, MAP_H - 2, 0);

    // Connect rooms with corridors
    for (let i = 1; i < rooms.length; i++) {
      connectRooms(map, rooms[i - 1], rooms[i]);
    }

    state.map = map;

    // Place player in first room
    const startRoom = rooms[0];
    state.player.x = startRoom.cx;
    state.player.y = startRoom.cy;

    // Place stairs in last room
    const endRoom = rooms[rooms.length - 1];
    map[endRoom.cy][endRoom.cx] = T.STAIRS;

    // Place enemies
    state.enemies = [];
    const numEnemies = 4 + Math.floor(state.floor * 1.5);
    for (let i = 0; i < numEnemies; i++) {
      const pos = randomFloorTile(map, state.player);
      if (!pos) break;

      // Pick enemy type based on floor
      const maxTier = Math.min(ENEMY_TYPES.length - 1, Math.floor(state.floor / 2));
      const minTier = Math.max(0, maxTier - 2);
      const tier = minTier + Math.floor(Math.random() * (maxTier - minTier + 1));
      const template = ENEMY_TYPES[tier];

      // Scale slightly with floor
      const scale = 1 + (state.floor - 1) * 0.08;
      state.enemies.push({
        x: pos.x, y: pos.y,
        name: template.name,
        icon: template.icon,
        hp: Math.ceil(template.hp * scale),
        maxHp: Math.ceil(template.hp * scale),
        atk: Math.ceil(template.atk * scale),
        xpGold: template.xpGold,
        color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
      });
    }

    // Place potions
    const numPotions = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numPotions; i++) {
      const pos = randomFloorTile(map, state.player);
      if (pos) map[pos.y][pos.x] = T.POTION;
    }

    // Place gold piles
    const numGold = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numGold; i++) {
      const pos = randomFloorTile(map, state.player);
      if (pos) map[pos.y][pos.x] = T.GOLD;
    }
  }

  function carveRooms(map, rooms, x, y, w, h, depth) {
    if (w < 5 || h < 5 || depth > 6) return;

    // Decide to carve a room or split
    if (w <= 10 && h <= 10 && Math.random() < 0.6 || depth >= 5) {
      // Carve a room
      const rw = 3 + Math.floor(Math.random() * Math.min(w - 2, 6));
      const rh = 3 + Math.floor(Math.random() * Math.min(h - 2, 5));
      const rx = x + Math.floor(Math.random() * (w - rw));
      const ry = y + Math.floor(Math.random() * (h - rh));

      for (let row = ry; row < ry + rh; row++) {
        for (let col = rx; col < rx + rw; col++) {
          if (row > 0 && row < MAP_H - 1 && col > 0 && col < MAP_W - 1) {
            map[row][col] = T.FLOOR;
          }
        }
      }

      rooms.push({
        x: rx, y: ry, w: rw, h: rh,
        cx: Math.floor(rx + rw / 2),
        cy: Math.floor(ry + rh / 2),
      });
      return;
    }

    // Split
    if (w > h) {
      const split = Math.floor(w * (0.35 + Math.random() * 0.3));
      carveRooms(map, rooms, x, y, split, h, depth + 1);
      carveRooms(map, rooms, x + split, y, w - split, h, depth + 1);
    } else {
      const split = Math.floor(h * (0.35 + Math.random() * 0.3));
      carveRooms(map, rooms, x, y, w, split, depth + 1);
      carveRooms(map, rooms, x, y + split, w, h - split, depth + 1);
    }
  }

  function connectRooms(map, a, b) {
    let x = a.cx, y = a.cy;
    const tx = b.cx, ty = b.cy;

    // L-shaped corridor
    while (x !== tx) {
      if (x > 0 && x < MAP_W - 1 && y > 0 && y < MAP_H - 1) {
        map[y][x] = T.FLOOR;
      }
      x += x < tx ? 1 : -1;
    }
    while (y !== ty) {
      if (x > 0 && x < MAP_W - 1 && y > 0 && y < MAP_H - 1) {
        map[y][x] = T.FLOOR;
      }
      y += y < ty ? 1 : -1;
    }
  }

  function randomFloorTile(map, avoid) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
      const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
      if (map[y][x] !== T.FLOOR) continue;
      if (avoid && x === avoid.x && y === avoid.y) continue;
      if (state.enemies.some(e => e.x === x && e.y === y)) continue;
      return { x, y };
    }
    return null;
  }

  // =====================
  // CANVAS
  // =====================
  function sizeCanvas() {
    const container = $('mapContainer');
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const dpr = window.devicePixelRatio || 1;

    // Calculate tile size to fit visible area nicely (show ~15x12 tiles)
    tileSize = Math.max(16, Math.floor(Math.min(cw / 15, ch / 12)));

    viewW = Math.ceil(cw / tileSize) + 2;
    viewH = Math.ceil(ch / tileSize) + 2;

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', () => {
    if (gameScreen.classList.contains('active') && state) {
      sizeCanvas();
      render();
    }
  });

  // =====================
  // CAMERA
  // =====================
  function updateCamera() {
    const cw = parseInt(canvas.style.width);
    const ch = parseInt(canvas.style.height);
    cameraX = state.player.x * tileSize - cw / 2 + tileSize / 2;
    cameraY = state.player.y * tileSize - ch / 2 + tileSize / 2;
  }

  // =====================
  // RENDERING
  // =====================
  function render() {
    if (!state) return;
    updateCamera();

    const cw = parseInt(canvas.style.width);
    const ch = parseInt(canvas.style.height);

    ctx.fillStyle = TILE_COLORS[T.VOID];
    ctx.fillRect(0, 0, cw, ch);

    const startCol = Math.max(0, Math.floor(cameraX / tileSize));
    const startRow = Math.max(0, Math.floor(cameraY / tileSize));
    const endCol = Math.min(MAP_W, startCol + viewW + 1);
    const endRow = Math.min(MAP_H, startRow + viewH + 1);

    // Compute visibility (simple distance-based fog of war)
    const px = state.player.x;
    const py = state.player.y;
    const sightRange = 7;

    // Draw tiles
    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const sx = Math.round(c * tileSize - cameraX);
        const sy = Math.round(r * tileSize - cameraY);
        const tile = state.map[r][c];

        const dist = Math.sqrt((c - px) ** 2 + (r - py) ** 2);
        if (dist > sightRange + 2) continue; // not visible at all

        const dimFactor = dist > sightRange ? 0.15 : Math.max(0.3, 1 - dist / (sightRange + 1));

        if (tile === T.WALL) {
          ctx.fillStyle = lerpColor('#2c3150', '#0a0c14', 1 - dimFactor);
          ctx.fillRect(sx, sy, tileSize, tileSize);
          // Top face highlight
          ctx.fillStyle = `rgba(255,255,255,${0.04 * dimFactor})`;
          ctx.fillRect(sx, sy, tileSize, 3);
        } else {
          ctx.fillStyle = lerpColor('#1a1e30', '#0a0c14', 1 - dimFactor * 0.8);
          ctx.fillRect(sx, sy, tileSize, tileSize);
          // Subtle grid line
          ctx.fillStyle = `rgba(255,255,255,${0.02 * dimFactor})`;
          ctx.fillRect(sx, sy, tileSize, 1);
          ctx.fillRect(sx, sy, 1, tileSize);
        }

        if (dist > sightRange) continue;

        // Draw items
        if (tile === T.STAIRS) {
          drawIcon(sx, sy, '>', STAIRS_COLOR, dimFactor);
        } else if (tile === T.POTION) {
          drawIcon(sx, sy, '+', POTION_COLOR, dimFactor);
        } else if (tile === T.GOLD) {
          drawIcon(sx, sy, '$', GOLD_COLOR, dimFactor);
        }
      }
    }

    // Draw enemies
    state.enemies.forEach(e => {
      const dist = Math.sqrt((e.x - px) ** 2 + (e.y - py) ** 2);
      if (dist > sightRange) return;

      const sx = Math.round(e.x * tileSize - cameraX);
      const sy = Math.round(e.y * tileSize - cameraY);
      const dim = Math.max(0.3, 1 - dist / (sightRange + 1));

      // Enemy body
      ctx.globalAlpha = dim;
      ctx.fillStyle = e.color;
      const pad = Math.floor(tileSize * 0.15);
      ctx.fillRect(sx + pad, sy + pad, tileSize - pad * 2, tileSize - pad * 2);

      // Icon
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(tileSize * 0.5)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.icon.toUpperCase(), sx + tileSize / 2, sy + tileSize / 2 + 1);

      // HP bar above
      if (e.hp < e.maxHp) {
        const barW = tileSize - 4;
        const barH = 3;
        const barX = sx + 2;
        const barY = sy - 1;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
      }
      ctx.globalAlpha = 1;
    });

    // Draw player
    {
      const sx = Math.round(px * tileSize - cameraX);
      const sy = Math.round(py * tileSize - cameraY);

      // Glow
      ctx.fillStyle = 'rgba(192, 132, 252, 0.15)';
      const glow = tileSize * 0.4;
      ctx.fillRect(sx - glow, sy - glow, tileSize + glow * 2, tileSize + glow * 2);

      // Body
      ctx.fillStyle = PLAYER_COLOR;
      const pad = Math.floor(tileSize * 0.1);
      ctx.fillRect(sx + pad, sy + pad, tileSize - pad * 2, tileSize - pad * 2);

      // Face
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(tileSize * 0.5)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('@', sx + tileSize / 2, sy + tileSize / 2 + 1);
    }
  }

  function drawIcon(sx, sy, char, color, dim) {
    ctx.globalAlpha = dim;
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.floor(tileSize * 0.55)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, sx + tileSize / 2, sy + tileSize / 2 + 1);
    ctx.globalAlpha = 1;
  }

  function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16);
    const bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return `rgb(${rr},${rg},${rb})`;
  }

  // =====================
  // INPUT
  // =====================
  function onKey(e) {
    if (!gameScreen.classList.contains('active')) return;
    if (menuOverlay.classList.contains('active') || deathOverlay.classList.contains('active')) return;

    const keyMap = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      ' ': 'wait',
    };
    const dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      handleDirection(dir);
    }
  }

  function handleTap(e) {
    if (!state) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const tx = Math.floor((mx + cameraX) / tileSize);
    const ty = Math.floor((my + cameraY) / tileSize);

    const dx = tx - state.player.x;
    const dy = ty - state.player.y;

    if (dx === 0 && dy === 0) {
      handleDirection('wait');
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      handleDirection(dx > 0 ? 'right' : 'left');
    } else {
      handleDirection(dy > 0 ? 'down' : 'up');
    }
  }

  function handleDirection(dir) {
    if (!state || !gameScreen.classList.contains('active')) return;
    if (menuOverlay.classList.contains('active') || deathOverlay.classList.contains('active')) return;

    let dx = 0, dy = 0;
    if (dir === 'up') dy = -1;
    else if (dir === 'down') dy = 1;
    else if (dir === 'left') dx = -1;
    else if (dir === 'right') dx = 1;
    // 'wait' = dx,dy = 0,0

    playerTurn(dx, dy);
  }

  // =====================
  // GAME LOGIC
  // =====================
  function playerTurn(dx, dy) {
    const p = state.player;
    const nx = p.x + dx;
    const ny = p.y + dy;

    if (dx === 0 && dy === 0) {
      // Wait — just let enemies move
      enemiesTurn();
      render();
      saveGame();
      return;
    }

    // Bounds check
    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return;

    // Wall check
    if (state.map[ny][nx] === T.WALL) return;

    // Enemy check — attack if there
    const enemy = state.enemies.find(e => e.x === nx && e.y === ny);
    if (enemy) {
      attackEnemy(enemy);
      enemiesTurn();
      render();
      checkDeath();
      saveGame();
      return;
    }

    // Move player
    p.x = nx;
    p.y = ny;

    // Pick up items
    const tile = state.map[ny][nx];
    if (tile === T.POTION) {
      const heal = 5 + Math.floor(state.floor * 1.5);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      state.map[ny][nx] = T.FLOOR;
      log(`Healed ${heal} HP!`, 'heal');
    } else if (tile === T.GOLD) {
      const amount = 3 + Math.floor(Math.random() * 5) + state.floor;
      state.gold += amount;
      state.map[ny][nx] = T.FLOOR;
      log(`Found ${amount} gold!`, 'gold');
    } else if (tile === T.STAIRS) {
      descend();
      return;
    }

    // Enemies move
    enemiesTurn();
    updateHUD();
    render();
    checkDeath();
    saveGame();
  }

  function attackEnemy(enemy) {
    const p = state.player;
    const dmg = p.atk + Math.floor(Math.random() * 2);
    enemy.hp -= dmg;

    if (enemy.hp <= 0) {
      state.enemies = state.enemies.filter(e => e !== enemy);
      state.kills++;
      state.gold += enemy.xpGold;

      // Level up: every 5 kills boost stats
      if (state.kills % 5 === 0) {
        p.atk += 1;
        p.maxHp += 3;
        p.hp = Math.min(p.maxHp, p.hp + 5);
        log(`Level up! ATK ${p.atk}, MaxHP ${p.maxHp}`, 'flash');
      } else {
        log(`Slain ${enemy.name}! +${enemy.xpGold}g`, 'gold');
      }
    } else {
      log(`Hit ${enemy.name} for ${dmg} (${enemy.hp}HP left)`, 'flash');
    }
    updateHUD();
  }

  function enemiesTurn() {
    const p = state.player;

    state.enemies.forEach(enemy => {
      const dist = Math.abs(enemy.x - p.x) + Math.abs(enemy.y - p.y);

      // Only chase if within range
      if (dist > 8) return;

      // Simple chase AI
      let dx = 0, dy = 0;
      if (Math.random() < 0.8) {
        // Move toward player
        const xDiff = p.x - enemy.x;
        const yDiff = p.y - enemy.y;

        if (Math.abs(xDiff) > Math.abs(yDiff)) {
          dx = xDiff > 0 ? 1 : -1;
        } else {
          dy = yDiff > 0 ? 1 : -1;
        }
      } else {
        // Random move
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        [dx, dy] = dirs[Math.floor(Math.random() * 4)];
      }

      const nx = enemy.x + dx;
      const ny = enemy.y + dy;

      // Attack player if adjacent
      if (nx === p.x && ny === p.y) {
        const dmg = enemy.atk + Math.floor(Math.random() * 2);
        p.hp -= dmg;
        log(`${enemy.name} hits you for ${dmg}!`, 'damage');
        updateHUD();
        return;
      }

      // Move if valid and no collision
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return;
      if (state.map[ny][nx] === T.WALL || state.map[ny][nx] === T.STAIRS) return;
      if (state.enemies.some(e => e !== enemy && e.x === nx && e.y === ny)) return;
      if (nx === p.x && ny === p.y) return;

      enemy.x = nx;
      enemy.y = ny;
    });
  }

  function descend() {
    state.floor++;

    // Boost player slightly on descent
    state.player.maxHp += 2;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
    state.player.atk += 1;

    generateFloor();
    updateHUD();
    log(`Descended to Floor ${state.floor}`, 'flash');
    render();
    saveGame();
  }

  function checkDeath() {
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      updateHUD();
      setTimeout(showDeath, 500);
    }
  }

  // =====================
  // HUD
  // =====================
  function updateHUD() {
    const p = state.player;
    $('hpBar').style.width = (p.hp / p.maxHp * 100) + '%';
    $('hpText').textContent = `${p.hp}/${p.maxHp}`;
    $('atkText').textContent = p.atk;
    $('goldText').textContent = state.gold;
    $('floorText').textContent = `F${state.floor}`;
  }

  // =====================
  // LOG
  // =====================
  function log(text, type) {
    const el = $('logText');
    el.textContent = text;
    el.className = 'log-text' + (type ? ` ${type}` : '');
  }

  // =====================
  // SAVE / LOAD
  // =====================
  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function loadBest() {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{"floor":0,"gold":0,"kills":0}');
  }

  function saveBest(data) {
    localStorage.setItem(BEST_KEY, JSON.stringify(data));
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
