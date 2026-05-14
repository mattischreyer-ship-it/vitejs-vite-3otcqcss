import { events } from '../core/events.js';
import { findPath } from '../map/pathfind.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Unit {
  constructor(gridX, gridY, type = 'PEASANT') {
    this.id = Date.now() + Math.random();
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.path = [];
    this.unitState = 'IDLE'; // 'IDLE' | 'MOVING' | 'GATHERING'
    this.moveTimer = 0;
    this.moveInterval = 250;   // ms per tile step
    this.selected = false;
    this.gatherTarget = null;  // { x, y } tile of resource
    this.gatherTimer = 0;
    this.gatherInterval = 800; // ms per resource unit gathered
    this._pendingGather = false;
  }

  moveTo(targetX, targetY, grid) {
    const path = findPath(grid, this.gridX, this.gridY, targetX, targetY);
    if (path.length > 1) {
      this.path = path.slice(1);
      this.unitState = 'MOVING';
      this.moveTimer = 0;
      this._pendingGather = false;
    }
  }

  gatherFrom(resX, resY, grid) {
    // Find the nearest walkable adjacent tile to stand on while gathering
    let adjacent = null;
    for (const [dx, dy] of DIRS) {
      const nx = resX + dx, ny = resY + dy;
      if (nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height) {
        if (grid.cells[nx][ny].walkable && !grid.cells[nx][ny].buildingId) {
          adjacent = { x: nx, y: ny };
          break;
        }
      }
    }
    if (!adjacent) return; // resource is completely blocked

    this.gatherTarget = { x: resX, y: resY };
    this._pendingGather = true;
    this.moveTo(adjacent.x, adjacent.y, grid);
  }

  update(deltaMs) {
    if (this.unitState === 'MOVING') {
      if (this.path.length === 0) {
        this.unitState = this._pendingGather ? 'GATHERING' : 'IDLE';
        this._pendingGather = false;
        this.gatherTimer = 0;
        return;
      }
      this.moveTimer += deltaMs;
      if (this.moveTimer >= this.moveInterval) {
        this.moveTimer -= this.moveInterval;
        const next = this.path.shift();
        this.gridX = next.x;
        this.gridY = next.y;
        if (this.path.length === 0) {
          this.unitState = this._pendingGather ? 'GATHERING' : 'IDLE';
          this._pendingGather = false;
          this.gatherTimer = 0;
        }
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
    }
  }

  stopGathering() {
    this.unitState = 'IDLE';
    this.gatherTarget = null;
    this._pendingGather = false;
  }

  draw(ctx, tileSize) {
    const px = this.gridX * tileSize + tileSize / 2;
    const py = this.gridY * tileSize + tileSize / 2;
    const r = tileSize * 0.42;

    // Selection ring
    if (this.selected) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + tileSize * 0.3, tileSize * 0.3, tileSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Unit emoji
    ctx.font = `${tileSize * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧑', px, py);

    // State indicator (top-right corner)
    if (this.unitState === 'MOVING') {
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(px + tileSize * 0.28, py - tileSize * 0.28, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.unitState === 'GATHERING') {
      ctx.font = `${tileSize * 0.38}px Arial`;
      ctx.fillText('⛏', px + tileSize * 0.28, py - tileSize * 0.22);
    }
  }
}
