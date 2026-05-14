/**
 * A* pathfinding on the game grid.
 * Returns an array of {x, y} tile coords from start to end (inclusive),
 * or [] if the destination is unreachable.
 */
export function findPath(grid, startX, startY, endX, endY) {
  if (!isWalkable(grid, endX, endY)) return [];

  const key = (x, y) => `${x},${y}`;
  const h = (x, y) => Math.abs(x - endX) + Math.abs(y - endY);

  const open = new Map();
  const closed = new Set();
  const cameFrom = new Map();
  const g = new Map();

  const startKey = key(startX, startY);
  g.set(startKey, 0);
  open.set(startKey, { x: startX, y: startY, f: h(startX, startY) });

  while (open.size > 0) {
    // Pick node with lowest f
    let currentKey = null;
    let lowestF = Infinity;
    for (const [k, node] of open) {
      if (node.f < lowestF) { lowestF = node.f; currentKey = k; }
    }

    const current = open.get(currentKey);
    open.delete(currentKey);
    closed.add(currentKey);

    if (current.x === endX && current.y === endY) {
      return reconstructPath(cameFrom, currentKey);
    }

    for (const [nx, ny] of neighbors(grid, current.x, current.y)) {
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;

      const tentativeG = g.get(currentKey) + 1;
      if (!g.has(nk) || tentativeG < g.get(nk)) {
        g.set(nk, tentativeG);
        cameFrom.set(nk, { key: currentKey, x: current.x, y: current.y });
        open.set(nk, { x: nx, y: ny, f: tentativeG + h(nx, ny) });
      }
    }
  }

  return [];
}

function isWalkable(grid, x, y) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  const cell = grid.cells[x][y];
  return cell.walkable && !cell.buildingId;
}

function neighbors(grid, x, y) {
  return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]
    .filter(([nx, ny]) => isWalkable(grid, nx, ny));
}

function reconstructPath(cameFrom, endKey) {
  const path = [];
  let k = endKey;
  while (cameFrom.has(k)) {
    const node = cameFrom.get(k);
    const [x, y] = k.split(',').map(Number);
    path.unshift({ x, y });
    k = node.key;
  }
  const [sx, sy] = k.split(',').map(Number);
  path.unshift({ x: sx, y: sy });
  return path;
}
