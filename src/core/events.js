class EventBus {
    constructor() {
      this.listeners = {};
    }
  
    // Register a listener for an event
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }
  
    // Fire an event and pass data to all listeners
    emit(event, data) {
      if (!this.listeners[event]) return;
      this.listeners[event].forEach(callback => callback(data));
    }
  
    // Remove a listener (useful for cleaning up deleted units)
    off(event, callback) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(l => l !== callback);
    }
  }
  
  export const events = new EventBus(); 