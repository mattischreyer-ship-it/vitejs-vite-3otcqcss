In Stronghold, when you select a building, a "ghost" version follows your mouse to show where it could be placed.

Why: This logic is math-heavy (snapping mouse coordinates to the grid).

Expansion: Isolate this in its own file. It reads the mouse position from mouse.js and checks the grid in grid.js to see if the area is red (blocked) or green (clear).