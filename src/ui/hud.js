import { state } from '/state.js';
import { events } from '/core/events.js';

export class HUD {
  constructor() {
    this.elements = {
      wood: document.getElementById('res-wood'),
      gold: document.getElementById('res-gold'),
      pop: document.getElementById('res-pop'),
      buttons: document.querySelectorAll('.build-btn')
    };

    this.init();
  }

  init() {
    // 1. Listen for clicks on the build buttons
    this.elements.buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const buildingType = e.target.dataset.type;
        events.emit('UI_SELECT_BUILDING', buildingType);
        console.log(`UI: Selected ${buildingType}`);
      });
    });

    // 2. Start the update loop (Sync HTML with State)
    this.update();
  }

  update() {
    // We update the numbers every frame or every tick
    this.elements.wood.innerText = Math.floor(state.resources.wood);
    this.elements.gold.innerText = Math.floor(state.resources.gold);
    this.elements.pop.innerText = `${state.resources.population}/${state.resources.maxPopulation}`;

    requestAnimationFrame(() => this.update());
  }
}