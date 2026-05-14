import { state } from '../state.js';
import { config } from '../config.js';

export class Grid {
  constructor(width, height, tileSize) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.cells = [];
    this.init();
  }

  init() {
    for (let x = 0; x < this.width; x++) {
      this.cells[x] = [];
      for (let y = 0; y < this.height; y++) {
        this.cells[x][y] = {
          type: 'grass',
          walkable: true,
          buildingId: null,
          resource: null, // { type: 'TREE'|'STONE', amount: Number }
        };
      }
    }
  }

  // Scatter resource nodes, keeping a clear radius around the spawn center
  placeResources(treeCount = 80, stoneCount = 25, clearRadius = 6) {
    const cx = Math.floor(this.width / 2);
    const cy = Math.floor(this.height / 2);

    const place = (type, amount) => {
      for (let attempts = 0; attempts < 100; attempts++) {
        const x = Math.floor(Math.random() * this.width);
        const y = Math.floor(Math.random() * this.height);
        const dx = x - cx, dy = y - cy;
        if (Math.sqrt(dx * dx + dy * dy) >= clearRadius && this.cells[x][y].walkable) {
          this.cells[x][y].walkable = false;
          this.cells[x][y].resource = { type, amount };
          return;
        }
      }
    };

    for (let i = 0; i < treeCount; i++)  place('TREE',  10);
    for (let i = 0; i < stoneCount; i++) place('STONE', 15);
  }

  screenToGrid(pixelX, pixelY) {
    return {
      x: Math.floor(pixelX / this.tileSize),
      y: Math.floor(pixelY / this.tileSize)
    };
  }

  draw(ctx) {
    const s = this.tileSize;

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const cell = this.cells[x][y];
        const px = x * s;
        const py = y * s;

        // Terrain background
        ctx.fillStyle = '#2d4a22';
        ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
        ctx.strokeStyle = '#1e3318';
        ctx.strokeRect(px, py, s, s);

        // Building
        if (cell.buildingId) {
          const bCfg = config.buildings[cell.buildingId];
          if (bCfg) {
            ctx.fillStyle = '#5a3010';
            ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
            ctx.font = `${s * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(bCfg.icon, px + s / 2, py + s / 2);
          }
        }

        // Resource node
        if (cell.resource) {
          const icon = cell.resource.type === 'TREE' ? '🌲' : '🪨';
          ctx.font = `${s * 0.7}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, px + s / 2, py + s / 2);
        }
      }
    }
  }
}
