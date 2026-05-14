import { state } from './state.js';
import { config } from './config.js';
import { events } from './core/events.js';
import { mouse } from './core/mouse.js'; 
import { camera } from './core/camera.js'; 
import { Grid } from './map/grid.js';
import { Builder } from './core/builder.js';
import { HUD } from './src/ui/hud.js';
import { EconomyManager } from './src/core/economy.js'; // Added Economy Manager

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
const economy = new EconomyManager(); // Step 3: Initialize the Economy logic

let lastSimulationTime = 0;

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
function updateRender() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Enter World Space (Apply Camera Transform)
  ctx.save();
  camera.apply(ctx); 
  
  worldMap.draw(ctx);
  
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
  ctx.fillRect(10, 10, 220, 100);
  
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Tick: ${state.game.tick}`, 20, 30);
  ctx.fillText(`Wood: ${Math.floor(state.resources.wood)}`, 20, 50);
  ctx.fillText(`Gold: ${Math.floor(state.resources.gold)}`, 20, 70);
  ctx.fillText(`Mode: ${builder.activeType || 'Selection'}`, 20, 90);
}

// 5. Main Loop
function gameLoop(currentTime) {
  updateSimulation(currentTime);
  updateRender();
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
  if (e.key === 'Escape') builder.cancel(); 
});

// Initialization Call
window.dispatchEvent(new Event('resize'));
requestAnimationFrame(gameLoop);