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
    state.buildings.forEach(building => {
      if (building.status !== 'COMPLETE') return; // blueprints don't produce
      const bConfig = config.buildings[building.type];
      const prod = bConfig?.production;
      if (prod && Object.keys(prod).length > 0) {
        this.generateResources(prod);
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