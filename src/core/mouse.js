import { events } from './events.js';

class MouseManager {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.isDown = false;
    this.button = null;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const canvas = document.getElementById('gameCanvas');
    
    canvas.addEventListener('mousemove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
      
      events.emit('mouse:move', { x: this.x, y: this.y });
    });
    
    canvas.addEventListener('mousedown', (e) => {
      this.isDown = true;
      this.button = e.button;
      
      events.emit('mouse:down', { 
        x: this.x, 
        y: this.y, 
        button: this.button 
      });
    });
    
    canvas.addEventListener('mouseup', (e) => {
      this.isDown = false;
      
      events.emit('mouse:up', { 
        x: this.x, 
        y: this.y, 
        button: e.button 
      });
      
      this.button = null;
    });
    
    canvas.addEventListener('click', (e) => {
      events.emit('mouse:click', { 
        x: this.x, 
        y: this.y, 
        button: e.button 
      });
    });
  }
  
  getPosition() {
    return { x: this.x, y: this.y };
  }
}

export const mouse = new MouseManager();