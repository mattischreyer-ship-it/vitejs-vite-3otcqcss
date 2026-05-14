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
import { selector } from './core/selector.js';

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

// Unit spawning
events.on('SPAWN_UNIT', ({ type }) => {
  const spawnX = Math.floor(config.world.mapWidth / 2);
  const spawnY = Math.floor(config.world.mapHeight / 2);
  state.units.push(new Unit(spawnX, spawnY, type));
});

// Move, gather, or build depending on what's at the target tile
events.on('MOVE_SELECTED', ({ tileX, tileY }) => {
  const cell = worldMap.cells[tileX]?.[tileY];
  const selected = state.units.filter(u => u.selected);
  if (cell?.resource) {
    selected.forEach(u => u.gatherFrom(tileX, tileY, worldMap));
  } else if (cell?.buildingId) {
    const blueprint = state.buildings.find(b => b.id === cell.buildingId && b.status === 'BLUEPRINT');
    if (blueprint) selected.forEach(u => u.buildAt(blueprint, worldMap));
  } else {
    selected.forEach(u => u.moveTo(tileX, tileY, worldMap));
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

let lastSimulationTime = 0;
let lastFrameTime = 0;

// 3. Simulation Logic (1-second ticks)
function updateSimulation(currentTime) {
  if (currentTime - lastSimulationTime >= config.timing.simulationTick) {
    state.game.tick++;
    
    // This event triggers the EconomyManager to process production
    events.emit('simulation:tick', { tick: state.game.tick });
    
    lastSimulationTime = currentTime;
  }
}

// 4. Rendering Logic (60fps)
function updateRender(currentTime) {
  const deltaMs = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Enter World Space (Apply Camera Transform)
  ctx.save();
  camera.applyTransform(ctx);

  worldMap.draw(ctx);

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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(10, 10, 240, 140);

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Tick: ${state.game.tick}`, 20, 30);
  ctx.fillText(`Wood: ${Math.floor(state.resources.wood)}  Stone: ${Math.floor(state.resources.stone)}`, 20, 50);
  ctx.fillText(`Gold: ${Math.floor(state.resources.gold)}`, 20, 70);
  ctx.fillText(`Units: ${state.units.length}  sel:${state.selection.ids.length}  [P]=spawn`, 20, 90);
  ctx.fillText(`Mode: ${builder.activeType || 'Select'}`, 20, 110);
  ctx.fillText(`[1]Hovel [2]Wood [3]Quarry`, 20, 130);
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
  if (e.key === 'p' || e.key === 'P') events.emit('SPAWN_UNIT', { type: 'PEASANT' });
  if (e.key === 'Escape') { builder.cancel(); selector.clearSelection(); }
});

// Left mouse: drive selector (selection box + click-to-select/move)
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) selector.startDrag(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
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

// Initialization Call
window.dispatchEvent(new Event('resize'));
requestAnimationFrame(gameLoop);