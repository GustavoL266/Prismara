import { Mat } from './materials';
import type { World } from './world';
import type { Machine } from './machines';

export interface FluidBuffer { material: Mat; count: number; temperature: number }
export const PIPE_CAPACITY = 48;
export const PIPE_MATERIALS = [Mat.Water, Mat.Pulp] as const;
export const isPipeMachine = (m: Machine): boolean => ['pump', 'pipe', 'valve'].includes(m.kind);
export const acceptsFluid = (m: Mat): boolean => (PIPE_MATERIALS as readonly Mat[]).includes(m);

/** Buffers belong to physical pipe pieces: splitting a network never merges its contents. */
export class PipeSystem {
  private networks: Machine[][] = [];
  private ids = new Map<number, number>();
  constructor(private world: World) {}
  rebuild(machines: Machine[]): void {
    const pieces = machines.filter(isPipeMachine);
    const parent = pieces.map((_, i) => i);
    const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      const horizontal = Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w);
      const vertical = Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h);
      const touchX = a.x + a.w === b.x || b.x + b.w === a.x;
      const touchY = a.y + a.h === b.y || b.y + b.h === a.y;
      const overlap = horizontal && vertical;
      if ((horizontal && touchY) || (vertical && touchX) || overlap) parent[root(j)] = root(i);
    }
    const groups = new Map<number, Machine[]>();
    pieces.forEach((m, i) => {
      if (!m.buffer) m.buffer = { material: Mat.Air, count: 0, temperature: 22 };
      const k = root(i);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(m);
    });
    this.networks = [...groups.values()];
    this.ids.clear();
    this.networks.forEach((group, index) => group.forEach(m => this.ids.set(m.id, index)));
  }
  inspect(id: number) {
    const networkId = this.ids.get(id) ?? -1;
    const network = this.networks[networkId] ?? [];
    const filled = network.filter(m => (m.buffer?.count ?? 0) > 0);
    const count = filled.reduce((sum, m) => sum + m.buffer!.count, 0);
    const kinds = new Set(filled.map(m => m.buffer!.material));
    return { networkId, count, capacity: network.length * PIPE_CAPACITY,
      material: filled[0]?.buffer?.material ?? Mat.Air, mixed: kinds.size > 1,
      temperature: count ? Math.round(filled.reduce((sum, m) => sum + m.buffer!.temperature * m.buffer!.count, 0) / count) : 22 };
  }
  step(machines: Machine[]): void {
    for (const group of this.networks) {
      for (const pump of group.filter(m => m.kind === 'pump' && m.enabled && m.signal !== false)) {
        let didPump = false;
        const points: [number, number][] = [];
        for (let x = pump.x - 1; x <= pump.x + pump.w; x++) {
          points.push([x, pump.y - 1], [x, pump.y + pump.h]);
        }
        for (let y = pump.y; y < pump.y + pump.h; y++) points.push([pump.x - 1, y], [pump.x + pump.w, y]);
        for (const [x, y] of points) {
          const material = this.world.get(x, y);
          if (!acceptsFluid(material)) continue;
          const dest = group.find(m => m.buffer!.count < PIPE_CAPACITY && (m.buffer!.count === 0 || m.buffer!.material === material));
          if (!dest) { pump.status = 'Rede cheia'; break; }
          const temperature = this.world.temperature[this.world.index(x, y)];
          const b = dest.buffer!;
          b.temperature = (b.temperature * b.count + temperature) / (b.count + 1);
          b.material = material; b.count++;
          this.world.set(x, y, Mat.Air);
          didPump = true;
          break;
        }
        if (didPump) pump.status = 'Ativa';
        else if (pump.status !== 'Rede cheia') pump.status = 'Sem líquido';
      }
      for (const valve of group.filter(m => m.kind === 'valve' && m.enabled && m.signal !== false)) {
        if(this.world.tick%(valve.interval??20))continue;
        const source = group.find(m => m.buffer!.count > 0);
        if (!source) { valve.status = 'Rede vazia'; continue; }
        const d = valve.rotation % 4;
        const x = d === 1 ? valve.x + valve.w : d === 3 ? valve.x - 1 : valve.x + Math.floor(valve.w / 2);
        const y = d === 0 ? valve.y + valve.h : d === 2 ? valve.y - 1 : valve.y + Math.floor(valve.h / 2);
        if (!this.world.accepts(x,y,source.buffer!.material) || this.world.get(x, y) !== Mat.Air) { valve.status = 'Saída bloqueada'; continue; }
        this.world.set(x, y, source.buffer!.material, source.buffer!.temperature);
        source.buffer!.count--;
        if (!source.buffer!.count) source.buffer!.material = Mat.Air;
        valve.status = 'Ativa';
      }
    }
  }
}
