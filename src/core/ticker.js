Rendering (drawing) should happen as fast as possible (60fps), but your economy logic (peasants eating food, wood being gathered) should happen on a Fixed Tick.

Why: It makes the game predictable and saves performance.

Expansion: Create a "Ticker" that fires an event every 500ms or 1000ms. Your economy logic only listens to this, not the main game loop.