import { state } from '../state.js';
import { events } from './events.js';

const DRAG_THRESHOLD = 5; // px before a click becomes a drag

class Selector {
  constructor() {
    this.active = false;
    this.dragStart = null;    // screen {x,y}
    this.dragCurrent = null;  // screen {x,y}
    this.isDragging = false;
  }

  startDrag(screenX, screenY) {
    this.active = true;
    this.dragStart = { x: screenX, y: screenY };
    this.dragCurrent = { x: screenX, y: screenY };
    this.isDragging = false;
  }

  updateDrag(screenX, screenY) {
    if (!this.active) return;
    this.dragCurrent = { x: screenX, y: screenY };
    const dx = screenX - this.dragStart.x;
    const dy = screenY - this.dragStart.y;
    if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
      this.isDragging = true;
    }
  }

  // builderActive: if true, forward click as TILE_CLICKED for building placement
  endDrag(screenX, screenY, camera, tileSize, builderActive) {
    if (!this.active) return;
    this.active = false;

    if (builderActive) {
      if (!this.isDragging) {
        const world = camera.screenToWorld(screenX, screenY);
        const tileX = Math.floor(world.x / tileSize);
        const tileY = Math.floor(world.y / tileSize);
        events.emit('TILE_CLICKED', { x: tileX, y: tileY });
      }
    } else if (this.isDragging) {
      this._boxSelect(camera, tileSize);
    } else {
      this._pointSelect(screenX, screenY, camera, tileSize);
    }

    this.isDragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
  }

  _pointSelect(screenX, screenY, camera, tileSize) {
    const world = camera.screenToWorld(screenX, screenY);
    const tileX = Math.floor(world.x / tileSize);
    const tileY = Math.floor(world.y / tileSize);

    const hit = state.units.find(u => u.gridX === tileX && u.gridY === tileY);

    if (hit) {
      this._setSelection([hit.id]);
    } else if (state.selection.ids.length > 0) {
      events.emit('MOVE_SELECTED', { tileX, tileY });
    } else {
      this._setSelection([]);
    }
  }

  _boxSelect(camera, tileSize) {
    const wa = camera.screenToWorld(this.dragStart.x, this.dragStart.y);
    const wb = camera.screenToWorld(this.dragCurrent.x, this.dragCurrent.y);
    const x1 = Math.min(wa.x, wb.x);
    const y1 = Math.min(wa.y, wb.y);
    const x2 = Math.max(wa.x, wb.x);
    const y2 = Math.max(wa.y, wb.y);

    const ids = state.units
      .filter(u => {
        const cx = u.gridX * tileSize + tileSize / 2;
        const cy = u.gridY * tileSize + tileSize / 2;
        return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
      })
      .map(u => u.id);

    this._setSelection(ids);
  }

  _setSelection(ids) {
    const idSet = new Set(ids);
    state.units.forEach(u => { u.selected = idSet.has(u.id); });
    state.selection.ids = ids;
    state.selection.type = ids.length > 0 ? 'UNIT' : null;
    events.emit('SELECTION_CHANGED', { ids });
  }

  clearSelection() {
    this._setSelection([]);
  }

  // Screen-space rect for the marching-ants box, or null when not dragging
  getSelectionRect() {
    if (!this.isDragging || !this.dragStart || !this.dragCurrent) return null;
    return {
      x: Math.min(this.dragStart.x, this.dragCurrent.x),
      y: Math.min(this.dragStart.y, this.dragCurrent.y),
      w: Math.abs(this.dragCurrent.x - this.dragStart.x),
      h: Math.abs(this.dragCurrent.y - this.dragStart.y),
    };
  }
}

export const selector = new Selector();
