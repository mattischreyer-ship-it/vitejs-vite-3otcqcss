import { events } from '../core/events.js';
import { findPath } from '../map/pathfind.js';

export class Enemy {
  constructor(gridX, gridY) {
    this.id = Date.now() + Math.random();
    this.gridX = gridX;
    this.gridY = gridY;
    this.health    = 10;
    this.maxHealth = 10;

    // Movement
    this.path      = [];
    this.moveTimer = 0;
    this.moveInterval = 450;

    // State: 'IDLE' | 'MOVING' | 'ATTACKING'
    this.unitState = 'IDLE';

    // Attack
    this.attackTargetId   = null;
    this.attackTargetType = null; // 'UNIT' | 'BUILDING'
    this.attackTimer      = 0;
    this.attackInterval   = 1000; // ms between attacks
    this.attackDamage     = 2;
  }

  moveTo(targetX, targetY, grid) {
    const path = findPath(grid, this.gridX, this.gridY, targetX, targetY);
    if (path.length > 1) {
      this.path      = path.slice(1);
      this.unitState = 'MOVING';
      this.moveTimer = 0;
    }
  }

  startAttacking(targetId, targetType) {
    this.attackTargetId   = targetId;
    this.attackTargetType = targetType;
    this.attackTimer      = 0;
    this.unitState        = 'ATTACKING';
    this.path             = []; // stop moving
  }

  stopAttacking() {
    this.attackTargetId   = null;
    this.attackTargetType = null;
    this.unitState        = 'IDLE';
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) events.emit('ENEMY_DIED', { enemyId: this.id });
  }

  update(deltaMs) {
    if (this.unitState === 'MOVING') {
      this.moveTimer += deltaMs;
      if (this.moveTimer >= this.moveInterval) {
        this.moveTimer -= this.moveInterval;
        const next = this.path.shift();
        this.gridX = next.x;
        this.gridY = next.y;
        if (this.path.length === 0) this.unitState = 'IDLE';
      }
    } else if (this.unitState === 'ATTACKING') {
      this.attackTimer += deltaMs;
      if (this.attackTimer >= this.attackInterval) {
        this.attackTimer -= this.attackInterval;
        events.emit('ENEMY_ATTACKED', {
          enemyId:    this.id,
          targetId:   this.attackTargetId,
          targetType: this.attackTargetType,
          damage:     this.attackDamage,
        });
      }
    }
  }

  draw(ctx, tileSize) {
    const px = this.gridX * tileSize + tileSize / 2;
    const py = this.gridY * tileSize + tileSize / 2;
    const bw = tileSize - 6;
    const pct = this.health / this.maxHealth;

    // Health bar
    ctx.fillStyle = '#111';
    ctx.fillRect(px - bw / 2, py - tileSize * 0.5, bw, 4);
    ctx.fillStyle = pct > 0.5 ? '#44dd44' : pct > 0.25 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(px - bw / 2, py - tileSize * 0.5, bw * pct, 4);

    // Attacking flash
    if (this.unitState === 'ATTACKING') {
      ctx.strokeStyle = 'rgba(255,60,60,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, tileSize * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = `${tileSize * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👹', px, py);
  }
}
