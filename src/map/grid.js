import { state } from '../state.js';

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
        };
      }
    }
  }

  // Convert Screen Pixel to Grid Coordinate
  screenToGrid(pixelX, pixelY) {
    return {
      x: Math.floor(pixelX / this.tileSize),
      y: Math.floor(pixelY / this.tileSize)
    };
  }

  draw(ctx) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        // Draw tile background
        ctx.strokeStyle = '#333'; // Dark grid lines
        ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        
        const cell = this.cells[x][y];
        
        // Draw terrain background
        if (cell.type === 'grass') {
          ctx.fillStyle = '#2d4a22'; 
          ctx.fillRect(x * this.tileSize + 1, y * this.tileSize + 1, this.tileSize - 2, this.tileSize - 2);
        }
        
        // Draw buildings
        if (cell.buildingId) {
          // Find the building in state
          const building = window.gameState?.buildings?.find(b => b.id === cell.buildingId);
          if (building && building.icon) {
            ctx.fillStyle = '#8B4513'; // Brown background for buildings
            ctx.fillRect(x * this.tileSize + 2, y * this.tileSize + 2, this.tileSize - 4, this.tileSize - 4);
            
            // Draw building icon
            ctx.font = `${this.tileSize * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(
              building.icon, 
              x * this.tileSize + this.tileSize / 2, 
              y * this.tileSize + this.tileSize / 2
            );
          }
        }
      }
    }
  }
} 