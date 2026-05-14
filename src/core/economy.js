import { state } from '../state.js';
import { events } from './events.js';
import { config } from '../config.js';

export class EconomyManager {
  constructor() {
    this.init();
  }

  init() {
    // Listen for the 1-second tick we defined in main.js
    events.on('simulation:tick', () => {
      this.processProduction();
    });
  }

  processProduction() {
    // 1. Loop through every building currently in the game state
    state.buildings.forEach(building => {
      const type = building.type;
      
      // 2. Check if this building type produces anything
      // (Assumes your config.buildings has a 'production' object)
      const bConfig = config.buildings[type];
      
      if (bConfig && bConfig.production) {
        this.generateResources(bConfig.production);
      }
    });

    // 3. Optional: Passive gold generation from population (taxes!)
    if (state.population.current > 0) {
      state.resources.gold += (state.population.current * 0.1);
    }
  }

  generateResources(production) {
    // production looks like: { wood: 2 } or { food: 5 }
    for (const [resource, amount] of Object.entries(production)) {
      if (state.resources[resource] !== undefined) {
        state.resources[resource] += amount;
      }
    }
  }
}