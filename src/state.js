export const state = {
  resources: {
    wood: 500,
    stone: 200,
    gold: 100,
    food: 50,
  },
  population: {
    current: 0,
    max: 10,
  },
  selection: {
    type: null, // 'UNIT' or 'BUILDING'
    ids: [],    // Array of selected entity IDs
  },
  game: {
    tick: 0,
    isPaused: false,
    gridSize: 32, // Size of a single tile in pixels
  },
  // Main entity arrays
  units: [],
  buildings: [],
}; 