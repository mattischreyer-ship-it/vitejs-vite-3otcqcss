import { events } from '../core/events.js';
import { findPath } from '../map/pathfind.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Unit {
  constructor(gridX, gridY, type = 'PEASANT') {
    this.id = Date.now() + Math.random();
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.selected = false;

    // Movement
    this.path = [];
    this.moveTimer = 0;
    this.moveInterval = 250; // ms per tile

    // State machine: 'IDLE' | 'MOVING' | 'GATHERING' | 'BUILDING'
    this.unitState = 'IDLE';
    this._pendingState = null; // state to enter once movement ends

    // Gathering
    this.gatherTarget = null;  // { x, y }
    this.gatherTimer = 0;
    this.gatherInterval = 800;

    // Building
    this.buildTarget = null;   // building.id
    this.buildTimer = 0;
    this.buildInterval = 1200;
  }

  // ─── Movement ────────────────────────────────────────────────

  moveTo(targetX, targetY, grid) {
    const path = findPath(grid, this.gridX, this.gridY, targetX, targetY);
    if (path.length > 1) {
      this.path = path.slice(1);
      this.unitState = 'MOVING';
      this.moveTimer = 0;
    }
  }

  // ─── Tasks ───────────────────────────────────────────────────

  gatherFrom(resX, resY, grid) {
    const adj = this._findAdjacent(resX, resY, 1, 1, grid);
    if (!adj) return;
    this.gatherTarget = { x: resX, y: resY };
    this._pendingState = 'GATHERING';
    this.moveTo(adj.x, adj.y, grid);
  }

  buildAt(building, grid) {
    const adj = this._findAdjacent(building.x, building.y, building.w || 1, building.h || 1, grid);
    if (!adj) return;
    this.buildTarget = building.id;
    this._pendingState = 'BUILDING';
    this.moveTo(adj.x, adj.y, grid);
  }

  stopGathering() {
    this.unitState = 'IDLE';
    this.gatherTarget = null;
    this._pendingState = null;
  }

  stopBuilding() {
    this.unitState = 'IDLE';
    this.buildTarget = null;
    this._pendingState = null;
  }

  // ─── Update ──────────────────────────────────────────────────

  update(deltaMs) {
    if (this.unitState === 'MOVING') {
      this.moveTimer += deltaMs;
      if (this.moveTimer >= this.moveInterval) {
        this.moveTimer -= this.moveInterval;
        const next = this.path.shift();
        this.gridX = next.x;
        this.gridY = next.y;
      }
      if (this.path.length === 0) {
        this.unitState = this._pendingState || 'IDLE';
        this._pendingState = null;
        this.gatherTimer = 0;
        this.buildTimer = 0;
      }

    } else if (this.unitState === 'GATHERING') {
      this.gatherTimer += deltaMs;
      if (this.gatherTimer >= this.gatherInterval) {
        this.gatherTimer -= this.gatherInterval;
        events.emit('UNIT_GATHERED', {
          unitId: this.id,
          tileX: this.gatherTarget.x,
          tileY: this.gatherTarget.y,
        });
      }

    } else if (this.unitState === 'BUILDING') {
      this.buildTimer += deltaMs;
      if (this.buildTimer >= this.buildInterval) {
        this.buildTimer -= this.buildInterval;
        events.emit('UNIT_BUILT', {
          unitId: this.id,
          buildingId: this.buildTarget,
        });
      }
    }
  }

  // ─── Draw ────────────────────────────────────────────────────

  draw(ctx, tileSize) {
    const px = this.gridX * tileSize + tileSize / 2;
    const py = this.gridY * tileSize + tileSize / 2;
    const r  = tileSize * 0.42;

    if (this.selected) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + tileSize * 0.3, tileSize * 0.3, tileSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${tileSize * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧑', px, py);

    // State indicator (top-right)
    const ix = px + tileSize * 0.28;
    const iy = py - tileSize * 0.28;
    if (this.unitState === 'MOVING') {
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(ix, iy, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.unitState === 'GATHERING') {
      ctx.font = `${tileSize * 0.38}px Arial`;
      ctx.fillText('⛏', ix, iy);
    } else if (this.unitState === 'BUILDING') {
      ctx.font = `${tileSize * 0.38}px Arial`;
      ctx.fillText('🔨', ix, iy);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  _findAdjacent(originX, originY, w, h, grid) {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (const [ox, oy] of DIRS) {
          const nx = originX + dx + ox;
          const ny = originY + dy + oy;
          if (nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height) {
            const cell = grid.cells[nx][ny];
            if (cell.walkable && !cell.buildingId) return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }
}
