import { state } from './state.js';
import { config } from './config.js';
import { events } from './core/events.js';
import { mouse } from './core/mouse.js'; 
import { camera } from './core/camera.js'; 
import { Grid } from './map/grid.js';
import { Builder } from './core/builder.js';
import { HUD } from './ui/hud.js';
import { EconomyManager } from './core/economy.js';
import { Unit } from './entities/units.js';
import { Enemy } from './entities/enemies.js';
import { selector } from './core/selector.js';
import { save, load, hasSave } from './core/storage.js';

console.log("Stronghold RTS - Initializing Engine...");

// 1. Setup Canvas & Core UI
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ui = new HUD();

// Disable right-click context menu (essential for camera panning)
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 2. Initialize World & Systems
const worldMap = new Grid(
  config.world.mapWidth, 
  config.world.mapHeight, 
  config.world.gridSize
);

worldMap.placeResources();

const builder = new Builder(worldMap);
const economy = new EconomyManager();

// Unit spawning — checks population cap and resource costs
events.on('SPAWN_UNIT', ({ type }) => {
  if (state.population.current >= state.population.max) return;
  const cost = config.units[type]?.spawnCost || {};
  for (const [res, amt] of Object.entries(cost)) {
    if ((state.resources[res] ?? 0) < amt) return;
  }
  for (const [res, amt] of Object.entries(cost)) state.resources[res] -= amt;

  if (type === 'SOLDIER') {
    const barracks = state.buildings.find(b => b.type === 'BARRACKS' && b.status === 'COMPLETE');
    if (!barracks) return;
    const spawnX = barracks.x + Math.floor((barracks.w || 2) / 2);
    const spawnY = barracks.y + (barracks.h || 2);
    state.units.push(new Unit(spawnX, spawnY, 'SOLDIER'));
  } else {
    const spawnX = Math.floor(config.world.mapWidth / 2);
    const spawnY = Math.floor(config.world.mapHeight / 2);
    state.units.push(new Unit(spawnX, spawnY, type));
  }
  state.population.current++;
});

// Population and building effects on completion
events.on('BUILDING_COMPLETE', ({ buildingId }) => {
  const building = state.buildings.find(b => b.id === buildingId);
  if (!building) return;
  if (building.type === 'HOVEL') {
    state.population.max += config.buildings.HOVEL.production.population ?? 8;
  }
});

// Combat: deal damage to enemy
events.on('UNIT_ATTACKED', ({ unitId, enemyId, damage }) => {
  const enemy = state.enemies.find(e => e.id === enemyId);
  const unit  = state.units.find(u => u.id === unitId);
  if (!enemy) { if (unit) unit.stopAttacking(); return; }
  enemy.takeDamage(damage);
});

// Remove dead enemies
events.on('ENEMY_DIED', ({ enemyId }) => {
  state.enemies = state.enemies.filter(e => e.id !== enemyId);
});

// Enemy deals damage to a unit or building
events.on('ENEMY_ATTACKED', ({ enemyId, targetId, targetType, damage }) => {
  const enemy = state.enemies.find(e => e.id === enemyId);
  if (targetType === 'UNIT') {
    const unit = state.units.find(u => u.id === targetId);
    if (!unit) { if (enemy) enemy.stopAttacking(); return; }
    unit.takeDamage(damage);
  } else if (targetType === 'BUILDING') {
    const building = state.buildings.find(b => b.id === targetId);
    if (!building) { if (enemy) enemy.stopAttacking(); return; }
    building.health = Math.max(0, building.health - damage);
    if (building.health === 0) events.emit('BUILDING_DESTROYED', { buildingId: building.id });
  }
});

// Unit dies — remove from state, free population slot
events.on('UNIT_DIED', ({ unitId }) => {
  state.units = state.units.filter(u => u.id !== unitId);
  state.selection.ids = state.selection.ids.filter(id => id !== unitId);
  state.population.current = Math.max(0, state.population.current - 1);
});

// Building destroyed — clear grid, remove from state
events.on('BUILDING_DESTROYED', ({ buildingId }) => {
  const building = state.buildings.find(b => b.id === buildingId);
  if (!building) return;
  for (let x = building.x; x < building.x + (building.w || 1); x++) {
    for (let y = building.y; y < building.y + (building.h || 1); y++) {
      worldMap.cells[x][y].buildingId = null;
      worldMap.cells[x][y].walkable   = true;
    }
  }
  state.buildings = state.buildings.filter(b => b.id !== buildingId);
  // Stop any enemies that were targeting this building
  state.enemies.forEach(e => {
    if (e.attackTargetId === buildingId) e.stopAttacking();
  });
});

// Move, gather, or build — with formation spread for multi-unit moves
events.on('MOVE_SELECTED', ({ tileX, tileY }) => {
  const cell = worldMap.cells[tileX]?.[tileY];
  const selected = state.units.filter(u => u.selected);
  if (!selected.length) return;

  if (cell?.resource) {
    selected.forEach(u => u.gatherFrom(tileX, tileY, worldMap));
  } else if (cell?.buildingId) {
    const blueprint = state.buildings.find(b => b.id === cell.buildingId && b.status === 'BLUEPRINT');
    if (blueprint) selected.forEach(u => u.buildAt(blueprint, worldMap));
  } else {
    // Spread units across nearby walkable tiles so they don't all stack
    const positions = formationPositions(tileX, tileY, selected.length, worldMap);
    selected.forEach((u, i) => {
      const pos = positions[i] ?? positions.at(-1) ?? { x: tileX, y: tileY };
      u.moveTo(pos.x, pos.y, worldMap);
    });
  }
});

// Advance construction progress; complete when threshold reached
events.on('UNIT_BUILT', ({ unitId, buildingId }) => {
  const building = state.buildings.find(b => b.id === buildingId);
  const unit = state.units.find(u => u.id === unitId);
  if (!building || building.status !== 'BLUEPRINT') {
    if (unit) unit.stopBuilding();
    return;
  }
  building.buildProgress++;
  if (building.buildProgress >= building.buildRequired) {
    building.status = 'COMPLETE';
    events.emit('BUILDING_COMPLETE', { buildingId });
    if (unit) unit.stopBuilding();
  }
});

// Deduct resource from node, credit state, stop unit when depleted
events.on('UNIT_GATHERED', ({ unitId, tileX, tileY }) => {
  const cell = worldMap.cells[tileX]?.[tileY];
  const unit = state.units.find(u => u.id === unitId);

  if (!cell?.resource) {
    if (unit) unit.stopGathering();
    return;
  }

  if (cell.resource.type === 'TREE')  state.resources.wood++;
  if (cell.resource.type === 'STONE') state.resources.stone++;

  cell.resource.amount--;
  if (cell.resource.amount <= 0) {
    cell.resource = null;
    cell.walkable = true;
    if (unit) unit.stopGathering();
  }
});

// BFS outward from target — returns N distinct walkable positions
function formationPositions(cx, cy, count, grid) {
  const out = [], visited = new Set([`${cx},${cy}`]);
  const queue = [{ x: cx, y: cy }];
  const dirs  = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  while (queue.length && out.length < count) {
    const { x, y } = queue.shift();
    if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) {
      const c = grid.cells[x][y];
      if (c.walkable && !c.buildingId && !c.resource) out.push({ x, y });
      for (const [dx, dy] of dirs) {
        const k = `${x+dx},${y+dy}`;
        if (!visited.has(k)) { visited.add(k); queue.push({ x: x+dx, y: y+dy }); }
      }
    }
  }
  return out;
}

let lastSimulationTime = 0;
let lastFrameTime = 0;
let mouseScreenPos = { x: 0, y: 0 };

// 3. Simulation Logic (1-second ticks)
function updateSimulation(currentTime) {
  if (currentTime - lastSimulationTime >= config.timing.simulationTick) {
    state.game.tick++;
    events.emit('simulation:tick', { tick: state.game.tick });

    // Spawn an enemy wave every N ticks
    if (state.game.tick % config.enemySpawnInterval === 0) spawnEnemy();

    // Enemy AI: attack adjacent targets or re-path toward nearest building/center
    const cx = Math.floor(config.world.mapWidth / 2);
    const cy = Math.floor(config.world.mapHeight / 2);
    const adjDirs = [[0,0],[1,0],[-1,0],[0,1],[0,-1]];

    state.enemies.forEach(enemy => {
      // Validate existing attack target
      if (enemy.unitState === 'ATTACKING') {
        const alive =
          (enemy.attackTargetType === 'UNIT'     && state.units.find(u => u.id === enemy.attackTargetId)) ||
          (enemy.attackTargetType === 'BUILDING'  && state.buildings.find(b => b.id === enemy.attackTargetId));
        if (!alive) enemy.stopAttacking();
        else return;
      }
      if (enemy.unitState !== 'IDLE') return;

      // Priority 1: adjacent unit
      const adjUnit = state.units.find(u =>
        Math.abs(u.gridX - enemy.gridX) + Math.abs(u.gridY - enemy.gridY) <= 1
      );
      if (adjUnit) { enemy.startAttacking(adjUnit.id, 'UNIT'); return; }

      // Priority 2: adjacent completed building
      for (const [dx, dy] of adjDirs) {
        const cell = worldMap.cells[enemy.gridX + dx]?.[enemy.gridY + dy];
        if (cell?.buildingId) {
          const bld = state.buildings.find(b => b.id === cell.buildingId && b.status === 'COMPLETE');
          if (bld) { enemy.startAttacking(bld.id, 'BUILDING'); return; }
        }
      }

      // Priority 3: path toward nearest completed building, or map center
      const completedBuildings = state.buildings.filter(b => b.status === 'COMPLETE');
      if (completedBuildings.length > 0) {
        const nearest = nearestEntity(enemy, completedBuildings.map(b => ({ ...b, gridX: b.x, gridY: b.y })));
        if (nearest) { enemy.moveTo(nearest.gridX, nearest.gridY, worldMap); return; }
      }
      enemy.moveTo(cx, cy, worldMap);
    });

    // Idle soldiers auto-target nearest enemy
    if (state.enemies.length > 0) {
      state.units.forEach(u => {
        if (u.type === 'SOLDIER' && u.unitState === 'IDLE') {
          const nearest = nearestEntity(u, state.enemies);
          if (nearest) u.attackEnemy(nearest, worldMap);
        }
      });
    }

    lastSimulationTime = currentTime;
  }
}

function spawnEnemy() {
  const w = config.world.mapWidth, h = config.world.mapHeight;
  const edges = [
    [0,                         Math.floor(Math.random() * h)],
    [w - 1,                     Math.floor(Math.random() * h)],
    [Math.floor(Math.random() * w), 0                        ],
    [Math.floor(Math.random() * w), h - 1                    ],
  ];
  const [ex, ey] = edges[Math.floor(Math.random() * edges.length)];
  if (!worldMap.cells[ex]?.[ey]?.walkable) return;
  const enemy = new Enemy(ex, ey);
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  enemy.moveTo(cx, cy, worldMap);
  state.enemies.push(enemy);
}

function nearestEntity(from, list) {
  let best = null, bestDist = Infinity;
  for (const e of list) {
    const d = Math.abs(e.gridX - from.gridX) + Math.abs(e.gridY - from.gridY);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

// 4. Rendering Logic (60fps)
function updateRender(currentTime) {
  const deltaMs = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  // Edge scrolling
  const EDGE = 24, scrollSpeed = Math.max(2, 6 / camera.zoom);
  if (mouseScreenPos.x < EDGE)                    camera.x -= scrollSpeed;
  if (mouseScreenPos.x > canvas.width  - EDGE)    camera.x += scrollSpeed;
  if (mouseScreenPos.y < EDGE)                     camera.y -= scrollSpeed;
  if (mouseScreenPos.y > canvas.height - EDGE)     camera.y += scrollSpeed;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Enter World Space (Apply Camera Transform)
  ctx.save();
  camera.applyTransform(ctx);

  worldMap.draw(ctx);

  // Update and draw enemies
  state.enemies.forEach(e => {
    e.update(deltaMs);
    e.draw(ctx, config.world.gridSize);
  });

  // Update and draw units
  state.units.forEach(u => {
    u.update(deltaMs);
    u.draw(ctx, config.world.gridSize);
  });

  // Draw the placement preview if the player is in "Build Mode"
  if (builder.activeType) {
    renderGhost(ctx);
  }

  ctx.restore(); // Return to Screen Space (UI Layer)

  drawSelectionBox();
  drawDebugInfo();
}

/**
 * Renders the semi-transparent "ghost" of the building following the mouse
 */
function renderGhost(ctx) {
  const bData = config.buildings[builder.activeType];
  const size = config.world.gridSize;

  // Green if placement is valid, Red if blocked
  ctx.fillStyle = builder.isValid ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
  
  ctx.fillRect(
    builder.ghostPos.x * size, 
    builder.ghostPos.y * size, 
    size * (bData?.width || 1), 
    size * (bData?.height || 1)
  );
  
  // Draw Building Icon
  if (bData?.icon) {
    ctx.font = `${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(
      bData.icon,
      (builder.ghostPos.x * size) + (size * (bData.width || 1)) / 2,
      (builder.ghostPos.y * size) + (size * (bData.height || 1)) / 2
    );
  }
}

function drawSelectionBox() {
  const rect = selector.getSelectionRect();
  if (!rect) return;
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(0, 255, 136, 0.06)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setLineDash([]);
}

/**
 * Basic Screen-Space Debug Overlay
 */
function drawDebugInfo() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(10, 10, 260, 180);

  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(`Tick: ${state.game.tick}  Enemies: ${state.enemies.length}`, 20, 30);
  ctx.fillText(`Wood:${Math.floor(state.resources.wood)}  Stone:${Math.floor(state.resources.stone)}`, 20, 48);
  ctx.fillText(`Gold:${Math.floor(state.resources.gold)}  Food:${Math.floor(state.resources.food)}`, 20, 66);
  ctx.fillText(`Pop: ${state.population.current}/${state.population.max}`, 20, 84);
  ctx.fillText(`Sel: ${state.selection.ids.length}  Mode: ${builder.activeType || 'Select'}`, 20, 102);
  ctx.fillStyle = '#aaa';
  ctx.fillText(`Zoom: ${camera.zoom.toFixed(2)}x  [scroll to zoom]`, 20, 122);
  ctx.fillText(`[P]Peasant [S]Soldier [Ctrl+S/L]Save/Load`, 20, 140);
  ctx.fillText(`[1]Hovel [2]Lumber [3]Quarry [4]Barracks [5]Farm`, 20, 158);
}

// 5. Main Loop
function gameLoop(currentTime) {
  updateSimulation(currentTime);
  updateRender(currentTime);
  requestAnimationFrame(gameLoop);
}

// 6. Global Event Handlers
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

document.addEventListener('keydown', (e) => {
  if (e.key === '1') events.emit('UI_SELECT_BUILDING', 'HOVEL');
  if (e.key === '2') events.emit('UI_SELECT_BUILDING', 'WOODCUTTER');
  if (e.key === '3') events.emit('UI_SELECT_BUILDING', 'QUARRY');
  if (e.key === '4') events.emit('UI_SELECT_BUILDING', 'BARRACKS');
  if (e.key === '5') events.emit('UI_SELECT_BUILDING', 'FARM');
  if (e.key === 'p' || e.key === 'P') events.emit('SPAWN_UNIT', { type: 'PEASANT' });
  if (e.key === 's' || e.key === 'S') {
    if (e.ctrlKey) { e.preventDefault(); save(worldMap); }
    else events.emit('SPAWN_UNIT', { type: 'SOLDIER' });
  }
  if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) {
    e.preventDefault();
    load(worldMap);
  }
  if (e.key === 'Escape') { builder.cancel(); selector.clearSelection(); }
});

// Left mouse: drive selector (selection box + click-to-select/move)
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) selector.startDrag(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
  mouseScreenPos = { x: e.clientX, y: e.clientY };
  // Selector drag tracking
  selector.updateDrag(e.clientX, e.clientY);

  // Ghost preview tile tracking
  const world = camera.screenToWorld(e.clientX, e.clientY);
  const tileX = Math.floor(world.x / config.world.gridSize);
  const tileY = Math.floor(world.y / config.world.gridSize);
  events.emit('MOUSE_TILE_CHANGE', { x: tileX, y: tileY });
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    selector.endDrag(e.clientX, e.clientY, camera, config.world.gridSize, !!builder.activeType);
  }
});

// Scroll wheel: zoom toward cursor
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
}, { passive: false });

// Initialization Call
window.dispatchEvent(new Event('resize'));
requestAnimationFrame(gameLoop);