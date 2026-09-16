import { Mat } from './materials';
import { DEFAULT_TEMPERATURE, World } from './world';

export const START_POSITION = { x: 130, y: 154 } as const;
export const SURFACE_LEVEL = 170;
export const REGIONS = [
  { id: 'surface', name: 'Deserto da Superfície', x: 0, y: 0, width: 640, height: 205 },
  { id: 'caverns', name: 'Cavernas Minerais', x: 0, y: 205, width: 640, height: 115 },
  { id: 'ruin', name: 'Ruína Prismática', x: 500, y: 85, width: 115, height: 120 },
] as const;

/** Seeded terrain and a hand-shaped welcoming build shelf; no prebuilt player factory. */
export function generateTerrain(world: World): void {
  world.clear();
  const { width, height, cells, temperature } = world;
  const scaleX = width / 640, scaleY = height / 320;
  for (let x = 0; x < width; x++) {
    const xx = x / scaleX;
    let surface = SURFACE_LEVEL + Math.sin(xx * 0.025) * 9 + Math.sin(xx * 0.067) * 3;
    if (xx >= 72 && xx <= 303) surface = SURFACE_LEVEL + 2;
    if (xx > 308 && xx < 363) surface = 181 + Math.sin((xx - 308) / 55 * Math.PI) * 14;
    if (xx > 505 && xx < 600) surface = 173;
    const top = Math.round(surface * scaleY);
    for (let y = top; y < height; y++) {
      const yy = y / scaleY, depth = y - top;
      let mat = depth < 9 * scaleY ? Mat.Sand : yy > 220 && world.rng() < 0.56 ? Mat.Rock : Mat.Earth;
      const cave = yy > 210 && yy < 302 && (Math.sin(xx * 0.037) + Math.sin(yy * 0.105) +
        Math.sin((xx + yy) * 0.031)) > 0.73;
      const passage = xx > 383 && xx < 407 && yy > 174 && yy < 271;
      if (cave || passage) mat = Mat.Air;
      else if (yy > 213 && world.rng() < 0.014 && depth > 12 * scaleY) mat = Mat.Quartz;
      if (y >= height - 3 || x < 2 || x >= width - 2) mat = Mat.Rock;
      cells[world.index(x, y)] = mat;
    }
    // Accessible surface pool with a clay-colored earth basin.
    if (xx > 313 && xx < 358) {
      for (let y = Math.round(180 * scaleY); y < top; y++) cells[world.index(x, y)] = Mat.Water;
    }
  }
  // Low cave reservoirs sit in carved basins; the connecting shafts can be excavated.
  for (const pool of [{ x: 185, y: 263, r: 23 }, { x: 454, y: 276, r: 20 }]) {
    for (let y = Math.round((pool.y - 18) * scaleY); y <= Math.round((pool.y + 7) * scaleY); y++) {
      for (let x = Math.round((pool.x - pool.r) * scaleX); x <= Math.round((pool.x + pool.r) * scaleX); x++) {
        if (!world.inBounds(x, y)) continue;
        const dx = (x / scaleX - pool.x) / pool.r;
        if (Math.abs(dx) < 1 && y / scaleY < pool.y + 6 * (1 - dx * dx)) {
          cells[world.index(x, y)] = y / scaleY > pool.y - 2 ? Mat.Water : Mat.Air;
        }
      }
    }
  }
  // A compact earth basin keeps starter water available until the explorer adds sand.
  // The lip also closes lateral air gaps created by the sloping original shoreline.
  const poolTop = Math.round(180 * scaleY);
  for (let y = poolTop; y < Math.min(height, Math.round(202 * scaleY)); y++) {
    for (let x = Math.round(309 * scaleX); x < Math.min(width, Math.round(362 * scaleX)); x++) {
      if (world.get(x, y) !== Mat.Water) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (ny < poolTop || !world.inBounds(nx, ny)) continue;
        const neighbor = world.get(nx, ny);
        if (neighbor === Mat.Sand || neighbor === Mat.Air) cells[world.index(nx, ny)] = Mat.Earth;
      }
    }
  }
  // Raised natural banks prevent the adjacent dunes from avalanching into the pond.
  for (const bank of [{ x: 312, top: 168 }, { x: 358, top: 158 }]) {
    for (let x = Math.round(bank.x * scaleX); x <= Math.round((bank.x + 1) * scaleX); x++) {
      for (let y = Math.round(bank.top * scaleY); y < Math.round(201 * scaleY); y++) {
        if (world.inBounds(x, y)) cells[world.index(x, y)] = Mat.Earth;
      }
    }
  }
  // A pale symmetrical ruin chamber: pillar silhouettes are rendered in the background.
  const ruinLeft = Math.round(518 * scaleX), ruinRight = Math.round(586 * scaleX);
  const ruinFloor = Math.round(169 * scaleY);
  for (let y = Math.round(119 * scaleY); y <= ruinFloor; y++) {
    for (let x = ruinLeft; x <= ruinRight; x++) {
      if (!world.inBounds(x, y)) continue;
      if (y === ruinFloor || (y < 151 * scaleY && (x === ruinLeft || x === ruinRight))) {
        cells[world.index(x, y)] = Mat.Rock;
      } else if (y < ruinFloor) cells[world.index(x, y)] = Mat.Air;
    }
  }
  // A recoverable physical reward on the ancient dais.
  for (let n = 0; n < 16; n++) {
    const x = Math.round((546 + n % 8) * scaleX), y = Math.round((165 - Math.floor(n / 8)) * scaleY);
    if (world.inBounds(x, y)) cells[world.index(x, y)] = Mat.Crystal;
  }
  // Sparse mineral pollen gives the local flora a physical, heat-sensitive trace.
  for (const x of [30, 34, 70, 74, 370, 442, 491]) {
    const xx=Math.round(x*scaleX), yy=Math.round((148-(x%5))*scaleY);
    if(world.inBounds(xx,yy)&&world.get(xx,yy)===Mat.Air) cells[world.index(xx,yy)]=Mat.Lumen;
  }
  temperature.fill(DEFAULT_TEMPERATURE);
  world.rebuildActivity();
}
