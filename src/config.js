// Static constants and balance data for the RTS game
export const config = {
  // Grid and World Settings
  world: {
    gridSize: 32,        // Size of each tile in pixels
    mapWidth: 50,        // Number of tiles horizontally
    mapHeight: 50,       // Number of tiles vertically
  },
  
  // Game Loop Timing
  timing: {
    renderFPS: 60,       // Render loop target FPS
    simulationTick: 1000, // Simulation tick interval in ms
  },
  
  // Resource Balance
  resources: {
    starting: {
      wood: 500,
      stone: 200,
      gold: 100,
      food: 50,
    }
  },
  
  // Unit Stats (for future expansion)
  units: {
    peasant: {
      speed: 2,
      health: 50,
      gatherRate: 1,
    }
  },
  
  // Building Costs (for future expansion)
  buildings: {
    WOODCUTTER: {
      name: 'Woodcutter',
      cost: { gold: 20 },
      production: { wood: 2 }, // Produces 2 wood per tick
      width: 1, height: 1, icon: '🪓'
    },
    HOVEL: {
      name: 'Hovel',
      cost: { wood: 6 },
      production: { population: 8 }, // Adds to capacity
      width: 1, height: 1, icon: '🏠'
    },
    QUARRY: {
      name: 'Quarry',
      cost: { gold: 50 },
      production: { stone: 1 },
      width: 2, height: 2, icon: '🧱'
    }
  }
  }
};