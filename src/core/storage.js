import { state } from '../state.js';
import { Unit } from '../entities/units.js';
import { Enemy } from '../entities/enemies.js';

const KEY = 'rts_prime_v1';

export function save(grid) {
  const gridResources = [];
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const r = grid.cells[x][y].resource;
      if (r) gridResources.push({ x, y, resource: { ...r } });
    }
  }

  const data = {
    resources:    { ...state.resources },
    population:   { ...state.population },
    game:         { ...state.game },
    buildings:    state.buildings.map(b => ({ ...b })),
    units:        state.units.map(u => ({ id: u.id, type: u.type, gridX: u.gridX, gridY: u.gridY })),
    enemies:      state.enemies.map(e => ({ id: e.id, gridX: e.gridX, gridY: e.gridY, health: e.health })),
    gridResources,
  };

  localStorage.setItem(KEY, JSON.stringify(data));
  return true;
}

export function load(grid) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    Object.assign(state.resources,  data.resources);
    Object.assign(state.population, data.population);
    Object.assign(state.game,       data.game);
    state.buildings = data.buildings;

    state.units = data.units.map(d => {
      const u = new Unit(d.gridX, d.gridY, d.type);
      u.id = d.id;
      return u;
    });

    state.enemies = data.enemies.map(d => {
      const e = new Enemy(d.gridX, d.gridY);
      e.id = d.id; e.health = d.health;
      return e;
    });

    // Rebuild grid from saved data
    grid.init();
    state.buildings.forEach(b => {
      for (let x = b.x; x < b.x + (b.w || 1); x++) {
        for (let y = b.y; y < b.y + (b.h || 1); y++) {
          grid.cells[x][y].buildingId = b.id;
          grid.cells[x][y].walkable   = false;
        }
      }
    });
    data.gridResources.forEach(({ x, y, resource }) => {
      grid.cells[x][y].resource = resource;
      grid.cells[x][y].walkable = false;
    });

    return true;
  } catch (err) {
    console.error('RTS load failed:', err);
    return false;
  }
}

export function hasSave() {
  return !!localStorage.getItem(KEY);
}
