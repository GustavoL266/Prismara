import { Mat, MATERIALS } from './materials';
import { CHUNK_SIZE, World } from './world';
import { Energy, ENERGY } from './energy';
import { PipeSystem, isPipeMachine, type FluidBuffer } from './pipes';
import { updateSignals } from './signals';
import { REACTIONS } from './reactions';

export type MachineKind = 'belt' | 'lift' | 'filter' | 'separator' | 'kiln' | 'crucible' | 'mist' | 'press' | 'crusher' | 'pump' | 'pipe' | 'valve' | 'vault' | 'sensor' | 'fastbelt';
export interface MachineDef { name: string; w: number; h: number; tier: number; cost: number; description: string; input: string; output: string; color: string }
export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  belt: { name: 'Esteira de Placas', w: 16, h: 3, tier: 1, cost: 2, description: 'Carrega a camada que toca as placas. R inverte o sentido.', input: 'Sólidos sobre a superfície', output: 'Lateral na direção das placas', color: '#438391' },
  separator: { name: 'Tambor Separador', w: 16, h: 12, tier: 1, cost: 8, description: 'Polpa → argila + 22% de quartzo adicional.', input: 'Polpa por cima', output: 'Argila lateral · quartzo embaixo', color: '#559fac' },
  vault: { name: 'Cofre Prismático', w: 16, h: 14, tier: 1, cost: 5, description: 'Cristais físicos na cavidade contam para pesquisa.', input: 'Cristal por cima', output: 'Reserva de pesquisa', color: '#c87bea' },
  kiln: { name: 'Forno Cerâmico', w: 14, h: 12, tier: 2, cost: 7, description: 'Argila → pelota. Aquecimento solar lento quando falta energia.', input: 'Argila por cima', output: 'Pelota pela lateral', color: '#e88854' },
  lift: { name: 'Elevador Magnético', w: 6, h: 26, tier: 2, cost: 5, description: 'Sobe sólidos pelo eixo aberto e lança pelo topo.', input: 'Sólidos na base', output: 'Topo lateral · R inverte', color: '#66a5b5' },
  press: { name: 'Prensa Piezoelétrica', w: 16, h: 4, tier: 2, cost: 8, description: 'Pelotas após 18 células de queda geram 32 E e cacos.', input: 'Pelotas em queda livre', output: 'Energia + caco cerâmico', color: '#dcc572' },
  crusher: { name: 'Triturador', w: 12, h: 10, tier: 2, cost: 5, description: 'Recicla cacos e vidro. Consome 0,2 E por grão.', input: 'Caco ou fragmento por cima', output: 'Areia ou quartzo embaixo', color: '#9da7a6' },
  crucible: { name: 'Cadinho de Vidro', w: 14, h: 12, tier: 3, cost: 10, description: 'Quartzo + 3 E → vidro fundido a 1100 °C.', input: 'Quartzo por cima', output: 'Vidro líquido embaixo', color: '#ffc26a' },
  mist: { name: 'Gerador de Névoa', w: 8, h: 8, tier: 3, cost: 6, description: 'Água + 0,35 E → névoa fria. R gira a saída.', input: 'Água por cima', output: 'Névoa na direção selecionada', color: '#8de8ed' },
  pump: { name: 'Bomba', w: 6, h: 6, tier: 3, cost: 4, description: 'Aspira água ou polpa na borda. Conecte peças pelos lados.', input: 'Líquido em contato', output: 'Rede de tubos', color: '#699da7' },
  pipe: { name: 'Tubo', w: 4, h: 4, tier: 3, cost: 1, description: 'Rede em camada secundária. Cada peça armazena 48 pixels.', input: 'Bomba ou tubo conectado', output: 'Tubo ou válvula conectada', color: '#547b91' },
  valve: { name: 'Válvula de Saída', w: 4, h: 4, tier: 3, cost: 2, description: 'Devolve o líquido da rede ao mundo. R gira a saída.', input: 'Tubo conectado', output: 'Líquido físico', color: '#87d0d1' },
  filter: { name: 'Portão de Densidade', w: 16, h: 4, tier: 4, cost: 6, description: 'Aceitos caem; rejeitados seguem pela superfície. Configure no inspetor.', input: 'Mistura por cima', output: 'Filtro embaixo · rejeitos lateral', color: '#c7aa74' },
  sensor: { name: 'Sensor de Presença', w: 5, h: 5, tier: 4, cost: 5, description: 'Lê uma área acima e controla a máquina próxima.', input: 'Material na área de detecção', output: 'Sinal verde ou vermelho', color: '#8fc795' },
  fastbelt: { name: 'Esteira Rápida', w: 16, h: 3, tier: 4, cost: 5, description: 'Placas de avanço duplo. R inverte o sentido.', input: 'Sólidos sobre a superfície', output: 'Lateral', color: '#b6d979' },
};
export const RECIPES = {
  separator: { every: 5, quartzChance: REACTIONS.separator.bonusChance }, kiln: { every: 7, solarEvery: 40 },
  crucible: { every: 8, temperature: REACTIONS.melting.outputTemperature }, mist: { every: 1, temperature: -45 },
  press: { minimumFall: REACTIONS.piezo.minimumFall }, crusher: { every: 4, quartzChance: REACTIONS.crusher.quartzChance },
};
export interface Machine {
  id: number; kind: MachineKind; x: number; y: number; w: number; h: number; rotation: number;
  enabled: boolean; signal: boolean; status: string; filter: Mat; densityMin: number; densityMax: number;
  mode: 'material' | 'density'; targetId?: number; buffer?: FluidBuffer; flash: number;
}
export function feedPoint(m: Machine): { x: number; y: number } {
  return { x: m.x + Math.floor(m.w / 2), y: m.kind === 'lift' ? m.y + m.h - 3 : m.y - 3 };
}
const granular = (m: Mat): boolean => [Mat.Sand, Mat.Clay, Mat.Quartz, Mat.Pellet, Mat.Shard, Mat.Crystal, Mat.Glass].includes(m);
const secondary = (kind: MachineKind) => ['pipe', 'pump', 'valve', 'sensor'].includes(kind);

export class Factory {
  machines: Machine[] = [];
  energy = new Energy();
  nextId = 1;
  counters: Record<string, number> = { pulp: 0, clay: 0, quartz: 0, pellet: 0, impacts: 0, energy: 0, molten: 0, crystal: 0, stored: 0, recycled: 0 };
  pipes: PipeSystem;
  constructor(public world: World) { this.pipes = new PipeSystem(world); }
  canPlace(kind: MachineKind, x: number, y: number, _rotation = 0): boolean {
    const { w, h } = MACHINE_DEFS[kind];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y < 2 || x + w >= this.world.width - 1 || y + h >= this.world.height - 1) return false;
    for (const other of this.machines) {
      if (secondary(kind) !== secondary(other.kind)) continue;
      if (x < other.x + other.w && x + w > other.x && y < other.y + other.h && y + h > other.y) return false;
    }
    if (!secondary(kind)) for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
      const m = this.world.get(px, py);
      if (m !== Mat.Air && m !== Mat.Steam && m !== Mat.Mist) return false;
    }
    return true;
  }
  add(kind: MachineKind, x: number, y: number, rotation = 0): Machine | null {
    if (!this.canPlace(kind, x, y, rotation)) return null;
    const d = MACHINE_DEFS[kind];
    const machine: Machine = { id: this.nextId++, kind, x, y, w: d.w, h: d.h, rotation: ((rotation % 4) + 4) % 4,
      enabled: true, signal: true, status: 'Sem entrada', filter: Mat.Quartz, densityMin: 180, densityMax: 260, mode: 'material', flash: 0 };
    this.machines.push(machine);
    this.rebuildBlocks(); this.wakeFootprint(machine); this.pipes.rebuild(this.machines);
    return machine;
  }
  /** Removal returns every buffered fluid cell; refuses if the surrounding world is full. */
  remove(id: number): boolean {
    const machine = this.machines.find(m => m.id === id);
    if (!machine) return false;
    const spots: [number, number][] = [];
    const needed = machine.buffer?.count ?? 0;
    for (let radius = 0; radius < 30 && spots.length < needed; radius++) {
      for (let y = machine.y - radius; y < machine.y + machine.h + radius && spots.length < needed; y++) for (let x = machine.x - radius; x < machine.x + machine.w + radius && spots.length < needed; x++) {
        if (!this.world.inBounds(x, y) || this.world.get(x, y) !== Mat.Air || this.world.blocked[this.world.index(x, y)]) continue;
        if (!spots.some(([sx, sy]) => sx === x && sy === y)) spots.push([x, y]);
      }
    }
    if (spots.length < needed) { machine.status = 'Libere espaço para drenar'; return false; }
    this.machines = this.machines.filter(m => m.id !== id);
    this.rebuildBlocks();
    this.wakeFootprint(machine);
    for (const [x, y] of spots) this.world.set(x, y, machine.buffer!.material, machine.buffer!.temperature);
    this.pipes.rebuild(this.machines);
    return true;
  }
  private wakeFootprint(m: Machine): void {
    // Building/removing support wakes settled matter, while ordinary machine steps
    // can rebuild the collision mask without keeping the whole factory awake.
    for (let y = m.y - 1; y <= m.y + m.h; y += CHUNK_SIZE)
      for (let x = m.x - 1; x <= m.x + m.w; x += CHUNK_SIZE) this.world.markDirty(x, y);
    this.world.markDirty(m.x + m.w, m.y + m.h);
  }
  rebuildBlocks(): void {
    this.world.blocked.fill(0);
    for (const m of this.machines) {
      if (secondary(m.kind)) continue;
      for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
        let solid = true;
        if (m.kind === 'vault') solid = x === m.x || x === m.x + m.w - 1 || y === m.y + m.h - 1;
        if (m.kind === 'lift') solid = x === m.x || x === m.x + m.w - 1;
        if (solid) this.world.blocked[this.world.index(x, y)] = m.id;
      }
    }
  }
  private empty(x: number, y: number): boolean {
    return this.world.inBounds(x, y) && this.world.get(x, y) === Mat.Air && this.world.blocked[this.world.index(x, y)] === 0;
  }
  private input(m: Machine, material: Mat): { x: number; y: number } | null {
    for (let x = m.x + 1; x < m.x + m.w - 1; x++) if (this.world.get(x, m.y - 1) === material) return { x, y: m.y - 1 };
    return null;
  }
  private emit(x: number, y: number, material: Mat, temperature?: number): boolean {
    if (!this.empty(x, y)) return false;
    this.world.set(x, y, material, temperature); return true;
  }
  private displacedGasDestination(x: number, y: number): { x: number; y: number } | null {
    if (!this.world.inBounds(x, y) || this.world.blocked[this.world.index(x, y)]) return null;
    const material = this.world.get(x, y);
    if (material !== Mat.Mist && material !== Mat.Steam) return null;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (this.empty(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    return null;
  }
  private convey(m: Machine, filter = false): void {
    const direction = m.rotation % 2 ? -1 : 1;
    const speed = m.kind === 'fastbelt' ? 2 : 1;
    let moved = false, occupied = false;
    for (let t = 0; t < speed; t++) for (let n = 0; n < m.w; n++) {
      const x = direction > 0 ? m.x + m.w - 1 - n : m.x + n;
      const y = m.y - 1, material = this.world.get(x, y);
      if (!granular(material)) continue;
      occupied = true;
      const density = MATERIALS[material].density;
      const accepted = filter && (m.mode === 'material' ? material === m.filter : density >= m.densityMin && density <= m.densityMax);
      if (accepted) {
        if (this.empty(x, m.y + m.h)) { this.world.swap(this.world.index(x, y), this.world.index(x, m.y + m.h)); moved = true; }
      } else if (this.empty(x + direction, y)) {
        this.world.swap(this.world.index(x, y), this.world.index(x + direction, y)); moved = true;
      }
    }
    m.status = moved ? 'Ativa' : occupied ? 'Saída bloqueada' : 'Sem entrada';
  }
  step(): void {
    this.rebuildBlocks(); updateSignals(this.world, this.machines);
    const tick = this.world.tick;
    for (const m of this.machines) {
      m.flash = Math.max(0, m.flash - 1);
      if (m.kind === 'sensor') continue;
      if (!m.enabled || !m.signal) { m.status = 'Desligada'; continue; }
      if (isPipeMachine(m)) continue;
      if (m.kind === 'vault') { this.vault(m); continue; }
      if (m.kind === 'belt' || m.kind === 'fastbelt' || m.kind === 'filter') { this.convey(m, m.kind === 'filter'); continue; }
      if (m.kind === 'lift') { this.lift(m); continue; }
      if (m.kind === 'press') { this.press(m); continue; }
      const cx = m.x + Math.floor(m.w / 2), sideX = m.rotation % 2 ? m.x - 1 : m.x + m.w;
      m.status = 'Sem entrada';
      if (m.kind === 'separator') {
        const input = this.input(m, Mat.Pulp); if (!input) continue;
        if (!this.empty(sideX, m.y + m.h - 3) || !this.empty(cx, m.y + m.h)) { m.status = 'Saída bloqueada'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.separator.every) continue;
        this.world.set(input.x, input.y, Mat.Air); this.emit(sideX, m.y + m.h - 3, Mat.Clay);
        this.counters.pulp++; this.counters.clay++;
        if (this.world.rng() < RECIPES.separator.quartzChance) { this.emit(cx, m.y + m.h, Mat.Quartz); this.counters.quartz++; }
        m.flash = 6;
      } else if (m.kind === 'kiln') {
        const input = this.input(m, Mat.Clay); if (!input) continue;
        if (!this.empty(sideX, m.y + m.h - 3)) { m.status = 'Saída bloqueada'; continue; }
        const solar = this.energy.value < ENERGY.kiln;
        m.status = solar ? 'Aquecimento solar' : 'Ativa';
        if (tick % (solar ? RECIPES.kiln.solarEvery : RECIPES.kiln.every)) continue;
        if (!solar) this.energy.spend(ENERGY.kiln);
        this.world.set(input.x, input.y, Mat.Air); this.emit(sideX, m.y + m.h - 3, Mat.Pellet, 180);
        this.counters.pellet++; m.flash = 10;
      } else if (m.kind === 'crucible') {
        const input = this.input(m, Mat.Quartz); if (!input) continue;
        const gasDestination = this.displacedGasDestination(cx, m.y + m.h);
        if (!this.empty(cx, m.y + m.h) && !gasDestination) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.melt) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.crucible.every) continue;
        this.energy.spend(ENERGY.melt); this.world.set(input.x, input.y, Mat.Air);
        // A dense liquid pushes gas out of its outlet without deleting the coolant.
        if (gasDestination) this.world.swap(this.world.index(cx, m.y + m.h), this.world.index(gasDestination.x, gasDestination.y));
        this.emit(cx, m.y + m.h, Mat.Molten, RECIPES.crucible.temperature); this.counters.molten++; m.flash = 10;
      } else if (m.kind === 'mist') {
        const input = this.input(m, Mat.Water); if (!input) continue;
        const d = m.rotation % 4;
        const ox = d === 1 ? m.x + m.w : d === 3 ? m.x - 1 : cx;
        // Side nozzles sit at the upper corner, keeping coolant beside a falling stream.
        const oy = d === 0 ? m.y + m.h : d === 2 ? m.y - 2 : m.y;
        if (!this.empty(ox, oy)) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.mist) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.mist.every) continue;
        this.energy.spend(ENERGY.mist); this.world.set(input.x, input.y, Mat.Air);
        this.emit(ox, oy, Mat.Mist, RECIPES.mist.temperature); m.flash = 5;
      } else if (m.kind === 'crusher') {
        const shard = this.input(m, Mat.Shard), glass = this.input(m, Mat.Glass), input = shard ?? glass;
        if (!input) { this.reject(m, [Mat.Shard, Mat.Glass]); continue; }
        if (!this.empty(cx, m.y + m.h)) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.crush) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.crusher.every) continue;
        this.energy.spend(ENERGY.crush); this.world.set(input.x, input.y, Mat.Air);
        this.emit(cx, m.y + m.h, !shard && this.world.rng() < RECIPES.crusher.quartzChance ? Mat.Quartz : Mat.Sand);
        this.counters.recycled++; m.flash = 4;
      }
    }
    this.pipes.step(this.machines);
    const stored = this.countCrystals(); this.counters.stored = Math.max(this.counters.stored, stored);
    this.counters.crystal = Math.max(this.counters.crystal, stored);
  }
  private reject(m: Machine, accepts: Mat[]): void {
    for (let x = m.x + 1; x < m.x + m.w - 1; x++) {
      const material = this.world.get(x, m.y - 1);
      if (material === Mat.Air || accepts.includes(material)) continue;
      if (this.empty(m.x + m.w, m.y + m.h)) {
        this.world.swap(this.world.index(x, m.y - 1), this.world.index(m.x + m.w, m.y + m.h)); m.status = 'Material rejeitado'; return;
      }
      m.status = 'Entrada incompatível';
    }
  }
  private lift(m: Machine): void {
    let moved = false, occupied = false;
    const direction = m.rotation % 2 ? -1 : 1;
    const exitX = direction > 0 ? m.x + m.w : m.x - 1;
    // Snapshot prevents a grain being carried repeatedly in the same tick.
    for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) {
      if (!granular(this.world.get(x, y))) continue;
      occupied = true;
      const tx = y === m.y ? exitX : x, ty = y === m.y ? m.y - 1 : y - 2;
      if (this.empty(tx, ty)) { this.world.swap(this.world.index(x, y), this.world.index(tx, ty)); this.world.fall[this.world.index(tx, ty)] = 0; moved = true; }
    }
    m.status = moved ? 'Ativa' : occupied ? 'Saída bloqueada' : 'Sem entrada';
  }
  private press(m: Machine): void {
    m.status = 'Sem entrada';
    for (let x = m.x; x < m.x + m.w; x++) {
      if (this.world.get(x, m.y - 1) !== Mat.Pellet) continue;
      const index = this.world.index(x, m.y - 1);
      if (this.world.fall[index] < RECIPES.press.minimumFall) { m.status = 'Impacto fraco · mínimo 18 células'; continue; }
      if (this.energy.capacity - this.energy.value < ENERGY.impact) { m.status = 'Bateria cheia'; continue; }
      const outputX = m.rotation % 2 ? m.x - 1 : m.x + m.w;
      if (!this.empty(outputX, m.y + m.h - 1)) { m.status = 'Saída bloqueada'; continue; }
      this.world.set(x, m.y - 1, Mat.Air); this.emit(outputX, m.y + m.h - 1, Mat.Shard);
      this.counters.impacts++; this.counters.energy += this.energy.add(ENERGY.impact);
      m.flash = 14; m.status = '+32 E · impacto';
    }
  }
  private vault(m: Machine): void {
    this.reject(m, [Mat.Crystal]);
    // Reject foreign grains inside the cavity as well; physical crystals stay put.
    for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) {
      const material = this.world.get(x, y);
      if (material !== Mat.Air && material !== Mat.Crystal && this.empty(m.x + m.w, m.y + m.h))
        this.world.swap(this.world.index(x, y), this.world.index(m.x + m.w, m.y + m.h));
    }
    let count = 0;
    for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) if (this.world.get(x, y) === Mat.Crystal) count++;
    m.status = count >= (m.w - 2) * (m.h - 1) ? 'Cofre cheio' : count ? `${count} cristais armazenados` : 'Aguardando cristais';
  }
  countCrystals(): number {
    let count = 0;
    for (const m of this.machines.filter(m => m.kind === 'vault')) for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) if (this.world.get(x, y) === Mat.Crystal) count++;
    return count;
  }
  spendCrystals(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0 || this.countCrystals() < amount) return false;
    let remaining = amount;
    for (const m of this.machines.filter(m => m.kind === 'vault')) for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) {
      if (remaining > 0 && this.world.get(x, y) === Mat.Crystal) { this.world.set(x, y, Mat.Air); remaining--; }
    }
    return true;
  }
}
