import { events } from './events.js';

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Camera panning with middle mouse or right mouse
    events.on('mouse:down', (data) => {
      if (data.button === 1 || data.button === 2) { // Middle or right mouse
        this.isDragging = true;
        this.lastMouseX = data.x;
        this.lastMouseY = data.y;
      }
    });
    
    events.on('mouse:up', (data) => {
      if (data.button === 1 || data.button === 2) {
        this.isDragging = false;
      }
    });
    
    events.on('mouse:move', (data) => {
      if (this.isDragging) {
        const deltaX = data.x - this.lastMouseX;
        const deltaY = data.y - this.lastMouseY;
        
        this.x -= deltaX / this.zoom;
        this.y -= deltaY / this.zoom;
        
        this.lastMouseX = data.x;
        this.lastMouseY = data.y;
        
        events.emit('camera:moved', { x: this.x, y: this.y });
      }
    });
  }
  
  // Convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX / this.zoom) + this.x,
      y: (screenY / this.zoom) + this.y
    };
  }
  
  // Convert world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.zoom,
      y: (worldY - this.y) * this.zoom
    };
  }
  
  // Apply camera transform to canvas context
  applyTransform(ctx) {
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
  
  // Restore canvas context
  restoreTransform(ctx) {
    ctx.restore();
  }
}

export const camera = new Camera();