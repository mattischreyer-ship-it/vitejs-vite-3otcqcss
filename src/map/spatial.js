File to add: src/map/spatial.js (or beef up your grid.js)
If you have 50 archers, and each archer checks the distance to 200 enemies 60 times a second to see who is in range, your game will freeze (50 x 200 x 60 = 600,000 calculations per second).

The Concept: The map is divided into chunks (or you just use your building grid). When a unit moves, it registers itself to that specific grid tile. When an archer looks for a target, it only checks the units inside its immediate neighbor tiles.

Vibecoding Advantage: You isolate this complex math. The AI just writes a function: SpatialMap.getUnitsInRadius(x, y, radius). The rest of your game never needs to know how it calculates it, just that it returns an array of targets quickly.