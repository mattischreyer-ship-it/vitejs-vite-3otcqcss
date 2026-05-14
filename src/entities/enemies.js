import { events } from '../core/events.js';
import { findPath } from '../map/pathfind.js';

export class Enemy {
  constructor(gridX, gridY) {
    this.id = Date.now() + Math.random();
    this.gridX = gridX;
    this.gridY = gridY;
    this.health = 10;
    this.maxHealth = 10;
    this.path = [];
    this.moveTimer = 0;
    this.moveInterval = 450;
    this.unitState = 'IDLE'; // 'IDLE' | 'MOVING'
  }

  moveTo(targetX, targetY, grid) {
    const path = findPath(grid, this.gridX, this.gridY, targetX, targetY);
    if (path.length > 1) {
      this.path = path.slice(1);
      this.unitState = 'MOVING';
      this.moveTimer = 0;
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      events.emit('ENEMY_DIED', { enemyId: this.id });
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

    // Health bar
    const bw = tileSize - 6;
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = '#222';
    ctx.fillRect(px - bw / 2, py - tileSize * 0.48, bw, 3);
    ctx.fillStyle = pct > 0.5 ? '#44dd44' : pct > 0.25 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(px - bw / 2, py - tileSize * 0.48, bw * pct, 3);

    ctx.font = `${tileSize * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👹', px, py);
  }
}
