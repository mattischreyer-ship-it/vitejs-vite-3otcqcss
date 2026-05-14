export const BUILDING_TYPES = {
  WOODCUTTER: {
    name: 'Woodcutter',
    width: 1,
    height: 1,
    cost: { wood: 0, gold: 20 },
    icon: '🪓',
    description: 'Gathers wood from nearby trees'
  },
  HOVEL: {
    name: 'Hovel',
    width: 1,
    height: 1,
    cost: { wood: 6, gold: 0 },
    capacity: 8,
    icon: '🏠',
    description: 'Houses peasants'
  },
  GRANARY: {
    name: 'Granary',
    width: 1,
    height: 1,
    cost: { wood: 10, gold: 0 },
    icon: '🌾',
    description: 'Stores food'
  },
  QUARRY: {
    name: 'Quarry',
    width: 2,
    height: 2,
    cost: { wood: 20, gold: 0 },
    icon: '⛏️',
    description: 'Gathers stone'
  },
  BARRACKS: {
    name: 'Barracks',
    width: 2,
    height: 2,
    cost: { wood: 20, stone: 10 },
    icon: '⚔️',
    description: 'Trains soldiers'
  }
};