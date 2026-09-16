import { Mat, materials } from './materials';
import { CONTACT_REACTIONS, REACTIONS } from './reactions';

export const CHUNK_SIZE = 16;
export const DEFAULT_TEMPERATURE = REACTIONS.physics.ambientTemperature;
export const SIMULATION_HZ = 30;

/** Cellular material simulation; no per-particle objects or per-frame cell allocations. */
export class World {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  tick = 0;
  rngState: number;
  reactionCounts: Record<string, number> = { pulp: 0, crystal: 0, glass: 0 };
  readonly cells: Uint8Array;
  readonly temperature: Int16Array;
  /** Vertical distance since emission. Kept on a blocked cell for machine impact detection. */
  readonly fall: Uint16Array;
  /** Machine id occupying each cell; zero means the cell accepts particles. */
  readonly blocked: Int32Array;
  readonly chunksX: number;
  readonly chunksY: number;
  readonly active: Uint8Array;
  readonly dirty: Uint8Array;
  private readonly scanning: Uint8Array;
  private readonly visited: Uint32Array;

  constructor(width = 640, height = 320, seed = 73417) {
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    this.rngState = this.seed || 1;
    const size = width * height;
    this.cells = new Uint8Array(size);
    this.temperature = new Int16Array(size).fill(DEFAULT_TEMPERATURE);
    this.fall = new Uint16Array(size);
    this.blocked = new Int32Array(size);
    this.visited = new Uint32Array(size);
    this.chunksX = Math.ceil(width / CHUNK_SIZE);
    this.chunksY = Math.ceil(height / CHUNK_SIZE);
    this.active = new Uint8Array(this.chunksX * this.chunksY);
    this.dirty = new Uint8Array(this.active.length).fill(1);
    this.scanning = new Uint8Array(this.active.length);
  }

  rng(): number {
    let value = this.rngState += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    this.rngState >>>= 0;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  index(x: number, y: number): number { return y * this.width + x; }
  inBounds(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  get(x: number, y: number): Mat { return this.inBounds(x, y) ? this.cells[this.index(x, y)] : Mat.Rock; }

  set(x: number, y: number, mat: Mat, temperature = materials[mat].temperature): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.index(x, y);
    this.cells[i] = mat;
    this.temperature[i] = temperature;
    this.fall[i] = 0;
    this.markDirty(x, y);
    return true;
  }

  clear(): void {
    this.cells.fill(Mat.Air);
    this.temperature.fill(DEFAULT_TEMPERATURE);
    this.fall.fill(0);
    this.blocked.fill(0);
    this.visited.fill(0);
    this.active.fill(0);
    this.dirty.fill(1);
    this.tick = 0;
    this.rngState = this.seed || 1;
    this.reactionCounts = { pulp: 0, crystal: 0, glass: 0 };
  }

  /** Wake this chunk and its neighbors, including cells unsupported by a dig. */
  markDirty(x: number, y: number): void {
    const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE);
    for (let yy = Math.max(0, cy - 1); yy <= Math.min(this.chunksY - 1, cy + 1); yy++) {
      for (let xx = Math.max(0, cx - 1); xx <= Math.min(this.chunksX - 1, cx + 1); xx++) {
        this.active[yy * this.chunksX + xx] = 1;
      }
    }
    if (cx >= 0 && cy >= 0 && cx < this.chunksX && cy < this.chunksY) this.dirty[cy * this.chunksX + cx] = 1;
  }

  rebuildActivity(): void {
    this.active.fill(1);
    this.dirty.fill(1);
    this.visited.fill(0);
  }

  swap(i: number, j: number): void {
    const m = this.cells[i], t = this.temperature[i], f = this.fall[i];
    this.cells[i] = this.cells[j]; this.temperature[i] = this.temperature[j]; this.fall[i] = this.fall[j];
    this.cells[j] = m; this.temperature[j] = t; this.fall[j] = f;
    this.visited[i] = this.tick; this.visited[j] = this.tick;
    this.markDirty(i % this.width, Math.floor(i / this.width));
    this.markDirty(j % this.width, Math.floor(j / this.width));
  }

  count(mat: Mat): number {
    let count = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === mat) count++;
    return count;
  }

  /** Emit into nearby air only. Returns actual emitted count; never overwrites resources. */
  emit(x: number, y: number, mat: Mat, count = 1, temperature = materials[mat].temperature): number {
    let emitted = 0;
    for (let radius = 0; radius <= 5 && emitted < count; radius++) {
      for (let dy = -radius; dy <= radius && emitted < count; dy++) {
        for (let dx = -radius; dx <= radius && emitted < count; dx++) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const xx = x + dx, yy = y + dy;
          if (this.inBounds(xx, yy) && this.get(xx, yy) === Mat.Air && !this.blocked[this.index(xx, yy)]) {
            this.set(xx, yy, mat, temperature); emitted++;
          }
        }
      }
    }
    return emitted;
  }

  private wakeIndex(i: number): void { this.markDirty(i % this.width, Math.floor(i / this.width)); }

  private replace(i: number, mat: Mat, temperature?: number): void {
    this.cells[i] = mat;
    if (temperature !== undefined) this.temperature[i] = temperature;
    this.fall[i] = 0;
    this.visited[i] = this.tick;
    this.wakeIndex(i);
  }

  private contact(i: number, j: number): boolean {
    const a = this.cells[i], b = this.cells[j];
    for (const rule of CONTACT_REACTIONS) {
      const forward = a === rule.first && b === rule.second;
      if (!forward && !(a === rule.second && b === rule.first)) continue;
      const first = forward ? i : j, second = forward ? j : i;
      if ('probability' in rule) {
        const output = this.rng() < rule.probability ? rule.firstOutput : rule.alternate;
        this.replace(first, output, REACTIONS.quench.outputTemperature);
        this.reactionCounts[output === Mat.Crystal ? 'crystal' : 'glass']++;
        this.replace(second, rule.secondOutput, REACTIONS.quench.outputTemperature);
      } else {
        const average = Math.round((this.temperature[i] + this.temperature[j]) / 2);
        this.replace(first, rule.firstOutput, average);
        this.replace(second, rule.secondOutput, average);
        this.reactionCounts.pulp += 2;
      }
      return true;
    }
    return false;
  }

  private thermal(i: number, x: number, y: number): boolean {
    const mat = this.cells[i];
    // Inspect four contacts: reactions should never depend on random movement direction.
    for (let n = 0; n < 4; n++) {
      const side = (n + this.tick) & 3;
      const j = side === 0 ? (y > 0 ? i - this.width : -1) :
        side === 1 ? (x + 1 < this.width ? i + 1 : -1) :
        side === 2 ? (y + 1 < this.height ? i + this.width : -1) : (x > 0 ? i - 1 : -1);
      if (j < 0 || this.cells[j] === Mat.Air) continue;
      if (this.contact(i, j)) return true;
      if (mat === Mat.Steam && this.temperature[j] <= REACTIONS.condensation.coldSurface) {
        this.replace(i, Mat.Water, 38); return true;
      }
      // One edge per tick keeps heat work bounded and avoids directional bias.
      if (n === 0 && Math.abs(this.temperature[i] - this.temperature[j]) > 3) {
        const transfer = Math.trunc((this.temperature[i] - this.temperature[j]) *
          Math.min(materials[mat].conductivity, materials[this.cells[j]].conductivity) * REACTIONS.physics.heatExchange);
        if (transfer !== 0) {
          this.temperature[i] -= transfer;
          this.temperature[j] += transfer;
          this.wakeIndex(i); this.wakeIndex(j);
        }
      }
    }
    const temperature = this.temperature[i];
    if (materials[mat].flammability > 0 && mat === REACTIONS.ignition.input && temperature >= REACTIONS.ignition.temperature) {
      this.replace(i, REACTIONS.ignition.output, REACTIONS.ignition.outputTemperature); return true;
    }
    if (mat === Mat.Water && temperature > REACTIONS.boiling.temperature) {
      this.replace(i, Mat.Steam, Math.max(temperature, 105)); return true;
    }
    if (mat === Mat.Steam && temperature < REACTIONS.condensation.temperature) {
      this.replace(i, Mat.Water, temperature); return true;
    }
    if (mat === Mat.Molten && temperature < REACTIONS.glassCooling.temperature) {
      this.replace(i, Mat.Glass, temperature); return true;
    }
    if (mat === Mat.Quartz && temperature >= REACTIONS.melting.temperature) {
      this.replace(i, Mat.Molten, temperature); return true;
    }
    if (mat === Mat.Clay && temperature >= REACTIONS.ceramic.temperature) {
      this.replace(i, Mat.Pellet, temperature); return true;
    }
    if (temperature !== DEFAULT_TEMPERATURE) {
      this.active[Math.floor(y / CHUNK_SIZE) * this.chunksX + Math.floor(x / CHUNK_SIZE)] = 1;
      if ((this.tick + i) % REACTIONS.physics.ambientCoolingPeriod === 0) {
        this.temperature[i] += temperature < DEFAULT_TEMPERATURE ? 1 : -1;
      }
    }
    return false;
  }

  private canMove(i: number, x: number, y: number, vertical: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const j = this.index(x, y);
    if (this.blocked[j]) return false;
    const target = this.cells[j];
    if (target === Mat.Air) return true;
    const moving = materials[this.cells[i]], other = materials[target];
    if (this.visited[j] === this.tick || other.state === 'terrain' || other.state === 'structure') return false;
    if (moving.state === 'gas' || moving.state === 'floating') return false;
    if (other.state === 'gas' || other.state === 'floating') return true;
    if (vertical <= 0) return false;
    if (other.state === 'liquid' || other.state === 'paste') return moving.density > other.density;
    return moving.state === 'granular' && other.state === 'granular' &&
      moving.density - other.density >= REACTIONS.physics.granularDensityGap &&
      this.rng() < REACTIONS.physics.granularSiftingChance;
  }

  private move(i: number, x: number, y: number, originalY: number): boolean {
    if (!this.canMove(i, x, y, y - originalY)) return false;
    const j = this.index(x, y);
    this.swap(i, j);
    if (y > originalY) this.fall[j] = Math.min(65535, this.fall[j] + y - originalY);
    else if (y < originalY) this.fall[j] = 0;
    return true;
  }

  step(): void {
    this.tick = (this.tick + 1) >>> 0;
    if (this.tick === 0) { this.visited.fill(0); this.tick = 1; }
    this.scanning.set(this.active);
    this.active.fill(0);
    const reverse = (this.tick & 1) === 1;
    // Alternating complete vertical and horizontal scans; visited prevents double updates.
    for (let row = 0; row < this.height; row++) {
      const y = reverse ? this.height - 1 - row : row;
      const chunkRow = Math.floor(y / CHUNK_SIZE) * this.chunksX;
      for (let col = 0; col < this.width; col++) {
        const x = reverse ? this.width - 1 - col : col;
        if (!this.scanning[chunkRow + Math.floor(x / CHUNK_SIZE)]) continue;
        const i = this.index(x, y), mat = this.cells[i];
        if (mat === Mat.Air || this.visited[i] === this.tick) continue;
        const def = materials[mat];
        if (def.movement === 'none' && this.temperature[i] === DEFAULT_TEMPERATURE) continue;
        this.visited[i] = this.tick;
        if (this.thermal(i, x, y)) continue;
        if (def.movement === 'none') continue;
        if ((def.movement === 'viscous' && this.tick % REACTIONS.physics.pastePeriod !== 0) ||
            (def.movement === 'drift' && this.tick % REACTIONS.physics.mistPeriod !== 0)) {
          this.active[chunkRow + Math.floor(x / CHUNK_SIZE)] = 1; continue;
        }
        const direction = this.rng() < 0.5 ? -1 : 1;
        const vertical = def.state === 'gas' ? -1 : 1;
        if (this.move(i, x, y + vertical, y)) continue;
        if (this.move(i, x + direction, y + vertical, y)) continue;
        if (this.move(i, x - direction, y + vertical, y)) continue;
        // A landing on terrain or another grain dissipates impact. Machine floors retain
        // the incoming distance until the factory can inspect it on the next fixed step.
        if (def.state === 'granular' && (y + 1 >= this.height || !this.blocked[i + this.width])) this.fall[i] = 0;
        if (def.movement === 'flow' || def.movement === 'rise' || def.movement === 'drift' ||
            (def.movement === 'viscous' && this.tick % (REACTIONS.physics.pastePeriod * 3) === 0)) {
          const spread = def.movement === 'flow' ? REACTIONS.physics.liquidSpread :
            def.movement === 'rise' ? REACTIONS.physics.gasSpread : 1;
          let destination = x;
          for (let distance = 1; distance <= spread; distance++) {
            if (!this.canMove(i, x + direction * distance, y, 0)) break;
            destination = x + direction * distance;
          }
          if (destination !== x) this.move(i, destination, y, y);
          else this.move(i, x - direction, y, y);
        }
        // Density sifting is stochastic; keep mixed grains awake until they separate.
        if (def.state === 'granular' && y + 1 < this.height) {
          const below = materials[this.cells[i + this.width]];
          if (below.state === 'granular' && def.density - below.density >= REACTIONS.physics.granularDensityGap)
            this.active[chunkRow + Math.floor(x / CHUNK_SIZE)] = 1;
        }
      }
    }
  }
}
