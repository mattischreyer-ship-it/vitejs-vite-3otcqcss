import { findPath } from '../map/pathfind.js';

export class Unit {
  constructor(gridX, gridY, type = 'PEASANT') {
    this.id = Date.now() + Math.random();
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.path = [];
    this.unitState = 'IDLE'; // 'IDLE' | 'MOVING'
    this.moveTimer = 0;
    this.moveInterval = 250; // ms per tile step
    this.selected = false;
  }

  moveTo(targetX, targetY, grid) {
    const path = findPath(grid, this.gridX, this.gridY, targetX, targetY);
    if (path.length > 1) {
      this.path = path.slice(1); // skip the tile we're already on
      this.unitState = 'MOVING';
      this.moveTimer = 0;
    }
  }

  update(deltaMs) {
    if (this.unitState !== 'MOVING' || this.path.length === 0) return;
    this.moveTimer += deltaMs;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer -= this.moveInterval;
      const next = this.path.shift();
      this.gridX = next.x;
      this.gridY = next.y;
      if (this.path.length === 0) this.unitState = 'IDLE';
    }
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

    // Moving dot
    if (this.unitState === 'MOVING') {
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(px + tileSize * 0.25, py - tileSize * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
