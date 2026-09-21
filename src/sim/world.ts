import { Mat, materials } from './materials';
import { CONTACT_REACTIONS, REACTIONS } from './reactions';
import type { TerrainData } from './terrain-data';

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
  generation?:TerrainData;
  reactionCounts: Record<string, number> = { pulp: 0, crystal: 0, glass: 0, wet: 0, calcined: 0 };
  readonly cells: Uint8Array;
  readonly temperature: Int16Array;
  /** Vertical distance since emission. Kept on a blocked cell for machine impact detection. */
  readonly fall: Uint16Array;
  /** Machine id occupying each cell; zero means the cell accepts particles. */
  readonly blocked: Int32Array;
  /** Consolidated deposits stay attached until excavated; ids remain stable. */
  readonly consolidated: Uint8Array;
  /** Bits of material ids allowed through a machine footprint. Player still collides. */
  readonly passage: Uint32Array;
  readonly velocityX: Int8Array;
  readonly velocityY: Int8Array;
  readonly chunksX: number;
  readonly chunksY: number;
  readonly active: Uint8Array;
  readonly dirty: Uint8Array;
  readonly visualVariant: Uint8Array;
  readonly backdrop: Uint8Array;
  private readonly scanning: Uint8Array;
  private readonly visited: Uint32Array;

  constructor(width = 1024, height = 1536, seed = 73417) {
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    this.rngState = this.seed || 1;
    const size = width * height;
    this.cells = new Uint8Array(size);
    this.temperature = new Int16Array(size).fill(DEFAULT_TEMPERATURE);
    this.fall = new Uint16Array(size);
    this.blocked = new Int32Array(size);
    this.passage = new Uint32Array(size);
    this.consolidated = new Uint8Array(size);
    this.velocityX = new Int8Array(size);
    this.velocityY = new Int8Array(size);
    this.visited = new Uint32Array(size);
    this.visualVariant = new Uint8Array(size);
    this.backdrop = new Uint8Array(size);
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
  accepts(x: number, y: number, mat: Mat): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.index(x, y);
    return !this.blocked[i] || (this.passage[i] & (1 << mat)) !== 0;
  }
  /** Release a deposit in place, never send it to inventory. */
  excavate(x: number, y: number): boolean {
    if (!this.inBounds(x,y)) return false;
    const i=this.index(x,y), mat=this.cells[i];
    if (this.blocked[i] || mat===Mat.Air || mat===Mat.Wall) return false;
    if (!this.consolidated[i] && materials[mat].state!=='terrain') return false;
    const output=mat===Mat.Earth?Mat.Sand:mat===Mat.Rock?Mat.Residue:mat===Mat.Ice?Mat.Water:mat;
    this.set(x,y,output); return true;
  }

  set(x: number, y: number, mat: Mat, temperature = materials[mat].temperature): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.index(x, y);
    if (this.cells[i] === Mat.Air && mat !== Mat.Air) this.visualVariant[i] = this.variantAt(i);
    if (mat === Mat.Air) this.visualVariant[i] = 0;
    this.cells[i] = mat;
    this.temperature[i] = temperature;
    this.fall[i] = 0;
    this.consolidated[i] = 0;
    this.velocityX[i] = 0; this.velocityY[i] = 0;
    this.markDirty(x, y);
    return true;
  }

  clear(): void {
    this.generation=undefined;
    this.cells.fill(Mat.Air);
    this.visualVariant.fill(0); this.backdrop.fill(0);
    this.temperature.fill(DEFAULT_TEMPERATURE);
    this.fall.fill(0);
    this.blocked.fill(0);
    this.passage.fill(0); this.consolidated.fill(0);
    this.velocityX.fill(0); this.velocityY.fill(0);
    this.visited.fill(0);
    this.active.fill(0);
    this.dirty.fill(1);
    this.tick = 0;
    this.rngState = this.seed || 1;
    this.reactionCounts = { pulp: 0, crystal: 0, glass: 0, wet: 0, calcined: 0 };
  }

  /** Wake this chunk and its neighbors, including cells unsupported by a dig. */
  markDirty(x: number, y: number): void {
    const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE);
    for (let yy = Math.max(0, cy - 1); yy <= Math.min(this.chunksY - 1, cy + 1); yy++) {
      for (let xx = Math.max(0, cx - 1); xx <= Math.min(this.chunksX - 1, cx + 1); xx++) {
        this.active[yy * this.chunksX + xx] = 1;
      }
    }
    this.markVisualDirty(x,y);
  }
  /** Presentation changes do not wake physics. */
  markVisualDirty(x:number,y:number):void {
    // Borders are a visual dependency even when the adjacent chunk is asleep.
    for (let yy=Math.max(0,Math.floor((y-1)/CHUNK_SIZE));yy<=Math.min(this.chunksY-1,Math.floor((y+1)/CHUNK_SIZE));yy++)
      for (let xx=Math.max(0,Math.floor((x-1)/CHUNK_SIZE));xx<=Math.min(this.chunksX-1,Math.floor((x+1)/CHUNK_SIZE));xx++) this.dirty[yy*this.chunksX+xx]=1;
  }

  variantAt(i: number): number {
    let v = (Math.imul(i+1, 747796405) ^ this.seed ^ Math.imul(this.tick+1,2891336453)) >>> 0;
    v = Math.imul(v ^ v >>> 16, 2246822507); return (v ^ v >>> 13) & 255;
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
    const variant=this.visualVariant[i];this.visualVariant[i]=this.visualVariant[j];this.visualVariant[j]=variant;
    const vx=this.velocityX[i],vy=this.velocityY[i];
    this.velocityX[i]=this.velocityX[j];this.velocityY[i]=this.velocityY[j];
    this.velocityX[j]=vx;this.velocityY[j]=vy;
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
          if (this.accepts(xx, yy, mat) && this.get(xx, yy) === Mat.Air) {
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
    if (mat===Mat.Air) this.visualVariant[i]=0;
    if (temperature !== undefined) this.temperature[i] = temperature;
    this.fall[i] = 0;
    this.consolidated[i]=0;this.velocityX[i]=0;this.velocityY[i]=0;
    this.visited[i] = this.tick;
    this.wakeIndex(i);
  }

  private contact(i: number, j: number): boolean {
    const a = this.cells[i], b = this.cells[j];
    if (this.consolidated[i] || this.consolidated[j]) return false;
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
        this.reactionCounts.wet = (this.reactionCounts.wet ?? 0) + 1;
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
      const frozenEdge=mat===Mat.Ice||this.cells[j]===Mat.Ice;
      if (n === 0 && (!frozenEdge||Math.max(this.temperature[i],this.temperature[j])>50) && Math.abs(this.temperature[i] - this.temperature[j]) > 3) {
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
    if (mat === Mat.Residue && temperature >= REACTIONS.calcining.temperature) {
      this.replace(i,Mat.Calcined,temperature);this.reactionCounts.calcined=(this.reactionCounts.calcined??0)+1;return true;
    }
    if (mat === Mat.Ice && temperature > 0) { this.replace(i,Mat.Water,4);return true; }
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
    const ambient=mat===Mat.Ice?-20:DEFAULT_TEMPERATURE;
    if (temperature !== ambient) {
      this.active[Math.floor(y / CHUNK_SIZE) * this.chunksX + Math.floor(x / CHUNK_SIZE)] = 1;
      if ((this.tick + i) % REACTIONS.physics.ambientCoolingPeriod === 0) {
        this.temperature[i] += temperature < ambient ? 1 : -1;
        this.markVisualDirty(x,y);
      }
    }
    return false;
  }

  private canMove(i: number, x: number, y: number, vertical: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const j = this.index(x, y);
    if (!this.accepts(x,y,this.cells[i]) || this.consolidated[j]) return false;
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
  launch(x:number,y:number,vx:number,vy:number): void {
    const i=this.index(x,y);this.velocityX[i]=Math.max(-8,Math.min(8,Math.round(vx)));
    this.velocityY[i]=Math.max(-8,Math.min(8,Math.round(vy)));this.markDirty(x,y);
  }
  private ballistic(i:number,x:number,y:number): boolean {
    const vx=this.velocityX[i],vy=this.velocityY[i];
    if (!vx&&!vy) return false;
    const steps=Math.max(Math.abs(vx),Math.abs(vy));let current=i,cx=x,cy=y;
    for (let n=1;n<=steps;n++) {
      const tx=x+Math.round(vx*n/steps),ty=y+Math.round(vy*n/steps);
      if(tx===cx&&ty===cy)continue;
      // The intermediate grid cells are traversed; a collision ends flight here.
      if(!this.accepts(tx,ty,this.cells[current])||this.get(tx,ty)!==Mat.Air ||
         (tx!==cx&&ty!==cy && (!this.accepts(tx,cy,this.cells[current])||this.get(tx,cy)!==Mat.Air||!this.accepts(cx,ty,this.cells[current])||this.get(cx,ty)!==Mat.Air))) {
        this.velocityX[current]=0;this.velocityY[current]=0;return true;
      }
      const target=this.index(tx,ty);this.swap(current,target);this.fall[target]=ty>cy?this.fall[target]+1:0;
      current=target;cx=tx;cy=ty;
    }
    if(this.tick%3===0)this.velocityX[current]-=Math.sign(vx);
    this.velocityY[current]=Math.min(8,vy+1);this.markDirty(cx,cy);return true;
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
      for (let segment = 0; segment < this.chunksX; segment++) {
        const chunkX=reverse?this.chunksX-1-segment:segment;
        if(!this.scanning[chunkRow+chunkX])continue;
        const from=chunkX*CHUNK_SIZE,to=Math.min(this.width,from+CHUNK_SIZE);
        for(let col=0;col<to-from;col++) {
        const x=reverse?to-1-col:from+col;
        const i = this.index(x, y), mat = this.cells[i];
        if (mat === Mat.Air || this.visited[i] === this.tick) continue;
        const def = materials[mat];
        if (this.consolidated[i] && this.temperature[i] === def.temperature) continue;
        if (def.movement === 'none' && this.temperature[i] === DEFAULT_TEMPERATURE && mat!==Mat.Ice) continue;
        this.visited[i] = this.tick;
        if (this.thermal(i, x, y)) continue;
        if (this.consolidated[i]) continue;
        if (def.movement === 'none') continue;
        if (this.ballistic(i,x,y)) continue;
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
}
