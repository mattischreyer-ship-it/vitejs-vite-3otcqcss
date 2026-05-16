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

    this.maxHealth = type === 'SOLDIER' ? 50 : 20;
    this.health    = this.maxHealth;

    this.path = [];
    this.moveTimer = 0;
    this.moveInterval = type === 'SOLDIER' ? 220 : 250;

    // State machine: 'IDLE' | 'MOVING' | 'GATHERING' | 'BUILDING' | 'ATTACKING'
    this.unitState = 'IDLE';
    this._pendingState = null;

    // Gathering
    this.gatherTarget  = null;
    this.gatherTimer   = 0;
    this.gatherInterval = 800;

    // Building
    this.buildTarget   = null;
    this.buildTimer    = 0;
    this.buildInterval = 1200;

    // Attacking (soldiers only)
    this.attackTarget   = null; // enemy id
    this.attackTimer    = 0;
    this.attackInterval = type === 'SOLDIER' ? 800 : 1200;
    this.attackDamage   = type === 'SOLDIER' ? 3 : 1;
  }

  // ─── Movement ────────────────────────────────────────────────

  // clearPending=true for direct move commands; false when called from a task setter
  moveTo(targetX, targetY, grid, clearPending = true) {
    const path = findPath(grid, this.gridX, this.gridY, targetX, targetY);
    if (path.length > 1) {
      this.path = path.slice(1);
      this.unitState = 'MOVING';
      this.moveTimer = 0;
      if (clearPending) this._pendingState = null;
    }
  }

  // ─── Tasks ───────────────────────────────────────────────────

  gatherFrom(resX, resY, grid) {
    const adj = this._findAdjacent(resX, resY, 1, 1, grid);
    if (!adj) return;
    this.gatherTarget    = { x: resX, y: resY };
    this._pendingState   = 'GATHERING';
    this.moveTo(adj.x, adj.y, grid, false);
  }

  buildAt(building, grid) {
    const adj = this._findAdjacent(building.x, building.y, building.w || 1, building.h || 1, grid);
    if (!adj) return;
    this.buildTarget   = building.id;
    this._pendingState = 'BUILDING';
    this.moveTo(adj.x, adj.y, grid, false);
  }

  attackEnemy(enemy, grid) {
    const adj = this._findAdjacent(enemy.gridX, enemy.gridY, 1, 1, grid);
    if (!adj) return;
    this.attackTarget  = enemy.id;
    this._pendingState = 'ATTACKING';
    this.moveTo(adj.x, adj.y, grid, false);
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) events.emit('UNIT_DIED', { unitId: this.id });
  }

  stopGathering()  { this._resetTask(); this.gatherTarget = null; }
  stopBuilding()   { this._resetTask(); this.buildTarget  = null; }
  stopAttacking()  { this._resetTask(); this.attackTarget = null; }

  _resetTask() {
    this.unitState    = 'IDLE';
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
        this.unitState  = this._pendingState || 'IDLE';
        this._pendingState = null;
        this.gatherTimer = this.buildTimer = this.attackTimer = 0;
      }

    } else if (this.unitState === 'GATHERING') {
      this.gatherTimer += deltaMs;
      if (this.gatherTimer >= this.gatherInterval) {
        this.gatherTimer -= this.gatherInterval;
        events.emit('UNIT_GATHERED', { unitId: this.id, tileX: this.gatherTarget.x, tileY: this.gatherTarget.y });
      }

    } else if (this.unitState === 'BUILDING') {
      this.buildTimer += deltaMs;
      if (this.buildTimer >= this.buildInterval) {
        this.buildTimer -= this.buildInterval;
        events.emit('UNIT_BUILT', { unitId: this.id, buildingId: this.buildTarget });
      }

    } else if (this.unitState === 'ATTACKING') {
      this.attackTimer += deltaMs;
      if (this.attackTimer >= this.attackInterval) {
        this.attackTimer -= this.attackInterval;
        events.emit('UNIT_ATTACKED', { unitId: this.id, enemyId: this.attackTarget, damage: this.attackDamage });
      }
    }
  }

  // ─── Draw ────────────────────────────────────────────────────

  draw(ctx, tileSize) {
    const px = this.gridX * tileSize + tileSize / 2;
    const py = this.gridY * tileSize + tileSize / 2;

    // Health bar (only when damaged)
    if (this.health < this.maxHealth) {
      const bw = tileSize - 6, pct = this.health / this.maxHealth;
      ctx.fillStyle = '#111';
      ctx.fillRect(px - bw / 2, py - tileSize * 0.5, bw, 3);
      ctx.fillStyle = pct > 0.5 ? '#44dd44' : pct > 0.25 ? '#ffaa00' : '#ff3333';
      ctx.fillRect(px - bw / 2, py - tileSize * 0.5, bw * pct, 3);
    }

    if (this.selected) {
      ctx.strokeStyle = this.type === 'SOLDIER' ? '#88aaff' : '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, tileSize * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + tileSize * 0.3, tileSize * 0.3, tileSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${tileSize * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.type === 'SOLDIER' ? '🗡️' : '🧑', px, py);

    const ix = px + tileSize * 0.28, iy = py - tileSize * 0.28;
    if (this.unitState === 'MOVING') {
      ctx.fillStyle = '#00ff88';
      ctx.beginPath(); ctx.arc(ix, iy, 3, 0, Math.PI * 2); ctx.fill();
    } else if (this.unitState === 'GATHERING') {
      ctx.font = `${tileSize * 0.38}px Arial`; ctx.fillText('⛏', ix, iy);
    } else if (this.unitState === 'BUILDING') {
      ctx.font = `${tileSize * 0.38}px Arial`; ctx.fillText('🔨', ix, iy);
    } else if (this.unitState === 'ATTACKING') {
      ctx.font = `${tileSize * 0.38}px Arial`; ctx.fillText('⚔️', ix, iy);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  _findAdjacent(originX, originY, w, h, grid) {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (const [ox, oy] of DIRS) {
          const nx = originX + dx + ox, ny = originY + dy + oy;
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
