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

const builder = new Builder(worldMap);
const economy = new EconomyManager();

// Unit spawning
events.on('SPAWN_UNIT', ({ type }) => {
  const spawnX = Math.floor(config.world.mapWidth / 2);
  const spawnY = Math.floor(config.world.mapHeight / 2);
  state.units.push(new Unit(spawnX, spawnY, type));
});

// Click-to-move: when not in build mode, move all units to clicked tile
events.on('TILE_CLICKED', (pos) => {
  if (!builder.activeType) {
    state.units.forEach(u => u.moveTo(pos.x, pos.y, worldMap));
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

/**
 * Basic Screen-Space Debug Overlay
 */
function drawDebugInfo() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(10, 10, 220, 120);

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Tick: ${state.game.tick}`, 20, 30);
  ctx.fillText(`Wood: ${Math.floor(state.resources.wood)}`, 20, 50);
  ctx.fillText(`Gold: ${Math.floor(state.resources.gold)}`, 20, 70);
  ctx.fillText(`Units: ${state.units.length}  [P]=spawn`, 20, 90);
  ctx.fillText(`Mode: ${builder.activeType || 'Select'}`, 20, 110);
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
  if (e.key === 'Escape') builder.cancel();
});

// Translate canvas left-clicks into grid tile events
canvas.addEventListener('click', (e) => {
  const worldPos = camera.screenToWorld(e.clientX, e.clientY);
  const tileX = Math.floor(worldPos.x / config.world.gridSize);
  const tileY = Math.floor(worldPos.y / config.world.gridSize);
  if (tileX >= 0 && tileY >= 0 && tileX < config.world.mapWidth && tileY < config.world.mapHeight) {
    events.emit('TILE_CLICKED', { x: tileX, y: tileY });
  }
});

// Track mouse tile position for ghost preview
canvas.addEventListener('mousemove', (e) => {
  const worldPos = camera.screenToWorld(e.clientX, e.clientY);
  const tileX = Math.floor(worldPos.x / config.world.gridSize);
  const tileY = Math.floor(worldPos.y / config.world.gridSize);
  events.emit('MOUSE_TILE_CHANGE', { x: tileX, y: tileY });
});

// Initialization Call
window.dispatchEvent(new Event('resize'));
requestAnimationFrame(gameLoop);