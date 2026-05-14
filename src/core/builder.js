import { events } from './events.js';
import { state } from '../state.js';
import { BUILDING_TYPES } from '../config/buildings.js';

export class Builder {
  constructor(grid) {
    this.grid = grid;
    this.activeType = null;   // The key from BUILDING_TYPES (e.g., 'WOODCUTTER')
    this.ghostPos = { x: 0, y: 0 };
    this.isValid = false;

    this.init();
  }

  init() {
    // 1. Listen for the HUD selection
    events.on('UI_SELECT_BUILDING', (type) => {
      this.activeType = type;
      console.log(`Builder: Selected ${type}`);
    });

    // 2. Track mouse movement to update the "ghost" position
    events.on('MOUSE_TILE_CHANGE', (pos) => {
      if (!this.activeType) return;
      this.ghostPos = pos;
      this.validate();
    });

    // 3. Listen for clicks to finalize placement
    events.on('TILE_CLICKED', (pos) => {
      if (this.activeType) {
        this.placeBuilding(pos);
      }
    });

    // 4. Cancel placement (e.g., on right click or Escape)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancel();
    });
    
    // Optional: Right-click to cancel building mode
    this.grid.canvas?.addEventListener('contextmenu', (e) => {
      if (this.activeType) {
        e.preventDefault();
        this.cancel();
      }
    });
  }

  /**
   * Checks if the current ghost position is a valid spot for the building.
   */
  validate() {
    if (!this.activeType) {
      this.isValid = false;
      return;
    }

    const bData = BUILDING_TYPES[this.activeType];
    const { x: startX, y: startY } = this.ghostPos;

    // Boundary Check
    if (startX < 0 || startY < 0 || 
        startX + bData.width > this.grid.width || 
        startY + bData.height > this.grid.height) {
      this.isValid = false;
      return;
    }

    // Occupancy & Walkability Check
    let canPlace = true;
    for (let x = startX; x < startX + bData.width; x++) {
      for (let y = startY; y < startY + bData.height; y++) {
        const tile = this.grid.cells[x][y];
        if (!tile.walkable || tile.buildingId) {
          canPlace = false;
          break;
        }
      }
    }

    this.isValid = canPlace;
  }

  /**
   * Finalizes the placement, deducts resources, and updates the grid state.
   */
  placeBuilding(pos) {
    if (!this.isValid) {
      console.warn("Invalid placement location!");
      return;
    }

    const bData = BUILDING_TYPES[this.activeType];

    // Resource Validation
    const hasWood = state.resources.wood >= (bData.cost.wood || 0);
    const hasGold = state.resources.gold >= (bData.cost.gold || 0);

    if (hasWood && hasGold) {
      // Deduct Resources
      state.resources.wood -= (bData.cost.wood || 0);
      state.resources.gold -= (bData.cost.gold || 0);

      const id = Date.now();

      // Mark grid cells with numeric ID so grid.draw() can look up the object
      for (let x = pos.x; x < pos.x + bData.width; x++) {
        for (let y = pos.y; y < pos.y + bData.height; y++) {
          this.grid.cells[x][y].buildingId = id;
        }
      }

      state.buildings.push({
        id,
        type: this.activeType,
        x: pos.x,
        y: pos.y,
        w: bData.width,
        h: bData.height,
        status: 'BLUEPRINT',
        buildProgress: 0,
        buildRequired: 5,
      });

      events.emit('BUILDING_PLACED', { type: this.activeType, pos });
      
      // Auto-cancel if you want to place only one, or keep active for "multi-place"
      // this.cancel(); 
    } else {
      console.log("Insufficient resources to build!");
      events.emit('NOT_ENOUGH_RESOURCES', bData.cost);
    }
  }

  cancel() {
    this.activeType = null;
    this.isValid = false;
    console.log("Builder: Selection cleared.");
  }
}