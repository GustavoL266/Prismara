import { World } from '../sim/world';
import { Factory, MACHINE_DEFS, type Machine, type MachineKind } from '../sim/machines';
import { Mat, materials } from '../sim/materials';
import { acceptsFluid, isPipeMachine, PIPE_CAPACITY } from '../sim/pipes';
import { Player } from './player';

export const SAVE_KEY = 'prismara.world.v1';
export const SAVE_VERSION = 1;
export interface Progress { mined: number; mixed: number; crystalsMade: number; tier: number; ruins: boolean; won: boolean; elapsed: number; mission: number }
export interface Preferences { volume: number; shake: boolean; zoom: number }
export interface Saveable { world: World; factory: Factory; player: Player; inventory: number[]; progress: Progress; preferences: Preferences }

function rle(data: ArrayLike<number>): number[] {
  const out: number[] = [];
  let previous = data[0], count = 1;
  for (let i = 1; i < data.length; i++) {
    if (data[i] === previous && count < 65535) count++;
    else { out.push(previous, count); previous = data[i]; count = 1; }
  }
  if (data.length) out.push(previous, count);
  return out;
}

function unrle(source: unknown, length: number, min: number, max: number): number[] {
  if (!Array.isArray(source) || source.length % 2 || source.length > length * 2) throw new Error('Dados de partículas inválidos');
  const out: number[] = [];
  for (let i = 0; i < source.length; i += 2) {
    const value = source[i], count = source[i + 1];
    if (!integer(value, min, max) || !integer(count, 1, 65535) || out.length + count > length) throw new Error('Partículas fora dos limites');
    for (let k = 0; k < count; k++) out.push(value);
  }
  if (out.length !== length) throw new Error('Mundo incompleto');
  return out;
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function integer(value: unknown, min: number, max: number): value is number {
  return finite(value, min, max) && Number.isInteger(value);
}
function record(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function serialize(game: Saveable): string {
  const w = game.world, player = game.player;
  return JSON.stringify({
    version: SAVE_VERSION, savedAt: Date.now(),
    world: { width: w.width, height: w.height, seed: w.seed, tick: w.tick, rngState: w.rngState,
      cells: rle(w.cells), temperature: rle(w.temperature), fall: rle(w.fall), active: rle(w.active), reactionCounts: w.reactionCounts },
    machines: game.factory.machines, nextId: game.factory.nextId,
    energy: { value: game.factory.energy.value, capacity: game.factory.energy.capacity },
    counters: game.factory.counters,
    player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, facing: player.facing,
      fuel: player.fuel, grounded: player.grounded, thrust: player.thrust },
    inventory: game.inventory, progress: game.progress, preferences: game.preferences,
  });
}

export function deserialize(raw: string): Saveable {
  const data: unknown = JSON.parse(raw);
  if (!record(data) || data.version !== SAVE_VERSION) throw new Error('Este salvamento pertence a outra versão de Prismara.');
  const w = data.world;
  if (!record(w) || !integer(w.width, 32, 1024) || !integer(w.height, 32, 512)) throw new Error('Dimensão inválida');
  if (!integer(w.seed, 0, 0xffffffff) || !integer(w.tick, 0, 0xffffffff) || !integer(w.rngState, 0, 0xffffffff)) throw new Error('Semente inválida');
  const world = new World(w.width, w.height, w.seed), length = w.width * w.height;
  world.cells.set(unrle(w.cells, length, 0, materials.length - 1));
  world.temperature.set(unrle(w.temperature, length, -32768, 32767));
  world.fall.set(unrle(w.fall, length, 0, 65535));
  world.tick = w.tick; world.rngState = w.rngState;
  world.rebuildActivity();
  // Early v1 files did not retain sleeping chunks. New files resume the identical scan order.
  if (w.active !== undefined) world.active.set(unrle(w.active, world.active.length, 0, 1));
  if (w.reactionCounts !== undefined) {
    if (!record(w.reactionCounts)) throw new Error('Contadores de reação inválidos');
    for (const key of ['pulp', 'crystal', 'glass']) {
      if (!integer(w.reactionCounts[key], 0, Number.MAX_SAFE_INTEGER)) throw new Error('Contadores de reação inválidos');
      world.reactionCounts[key] = w.reactionCounts[key];
    }
  }

  const factory = new Factory(world);
  if (!Array.isArray(data.machines) || data.machines.length > 1000) throw new Error('Máquinas inválidas');
  const ids = new Set<number>();
  const machines: Machine[] = [];
  for (const m of data.machines) {
    if (!record(m) || typeof m.kind !== 'string' || !Object.hasOwn(MACHINE_DEFS, m.kind)) throw new Error('Estrutura de máquina inválida');
    const kind = m.kind as MachineKind, def = MACHINE_DEFS[kind];
    if (!integer(m.id, 1, 0x7ffffffe) || ids.has(m.id) || !integer(m.x, 0, world.width - def.w) ||
      !integer(m.y, 0, world.height - def.h) || m.w !== def.w || m.h !== def.h ||
      !integer(m.rotation, 0, 3) || typeof m.enabled !== 'boolean' || typeof m.signal !== 'boolean' ||
      typeof m.status !== 'string' || m.status.length > 200 || !integer(m.filter, 0, materials.length - 1) ||
      !finite(m.densityMin, 0, 65535) || !finite(m.densityMax, m.densityMin, 65535) ||
      !['material', 'density'].includes(m.mode) || !finite(m.flash, 0, 1000) ||
      (m.targetId !== undefined && !integer(m.targetId, 1, 0x7ffffffe))) throw new Error('Configuração de máquina inválida');
    const machine: Machine = { id: m.id, kind, x: m.x, y: m.y, w: def.w, h: def.h,
      rotation: m.rotation, enabled: m.enabled, signal: m.signal, status: m.status, filter: m.filter,
      densityMin: m.densityMin, densityMax: m.densityMax, mode: m.mode, flash: m.flash };
    if (m.targetId !== undefined) machine.targetId = m.targetId;
    if (m.buffer !== undefined) {
      const b = m.buffer;
      if (!isPipeMachine(machine) || !record(b) || !integer(b.count, 0, PIPE_CAPACITY) ||
        !integer(b.material, 0, materials.length - 1) || !finite(b.temperature, -32768, 32767) ||
        (b.count > 0 ? !acceptsFluid(b.material) : b.material !== Mat.Air)) throw new Error('Tubo inválido');
      machine.buffer = { material: b.material, count: b.count, temperature: b.temperature };
    }
    const secondLayer = ['pipe', 'pump', 'valve', 'sensor'].includes(kind);
    if (machines.some(other => secondLayer === ['pipe', 'pump', 'valve', 'sensor'].includes(other.kind) &&
      machine.x < other.x + other.w && machine.x + machine.w > other.x &&
      machine.y < other.y + other.h && machine.y + machine.h > other.y)) throw new Error('Máquinas sobrepostas');
    ids.add(machine.id); machines.push(machine);
  }
  factory.machines = machines;
  const minimumId = Math.max(0, ...ids) + 1;
  if (data.nextId !== undefined && !integer(data.nextId, minimumId, 0x7fffffff)) throw new Error('Identificador de máquina inválido');
  factory.nextId = data.nextId ?? minimumId;
  if (!record(data.energy) || !finite(data.energy.capacity, 1, 100000) || !finite(data.energy.value, 0, data.energy.capacity)) throw new Error('Energia inválida');
  factory.energy.capacity = data.energy.capacity; factory.energy.value = data.energy.value;
  if (!record(data.counters) || Object.keys(data.counters).length > 100 ||
    Object.values(data.counters).some(value => !finite(value, 0, Number.MAX_SAFE_INTEGER))) throw new Error('Contadores inválidos');
  factory.counters = { ...factory.counters, ...data.counters };

  const player = new Player(), p = data.player;
  if (!record(p) || !finite(p.x, 0, world.width) || !finite(p.y, 0, world.height) || !finite(p.fuel, 0, 100) ||
    (p.vx !== undefined && !finite(p.vx, -1000, 1000)) || (p.vy !== undefined && !finite(p.vy, -1000, 1000)) ||
    (p.facing !== undefined && p.facing !== -1 && p.facing !== 1) ||
    (p.grounded !== undefined && typeof p.grounded !== 'boolean') ||
    (p.thrust !== undefined && typeof p.thrust !== 'boolean')) throw new Error('Explorador inválido');
  player.x = p.x; player.y = p.y; player.fuel = p.fuel;
  player.vx = p.vx ?? 0; player.vy = p.vy ?? 0; player.facing = p.facing ?? 1;
  player.grounded = p.grounded ?? false; player.thrust = p.thrust ?? false;
  if (!Array.isArray(data.inventory) || (data.inventory.length !== materials.length && data.inventory.length !== Mat.Lumen) ||
    data.inventory.some(value => !integer(value, 0, 1e8))) throw new Error('Mochila inválida');
  const progress = data.progress;
  if (!record(progress) || !integer(progress.tier, 1, 4) || !finite(progress.elapsed, 0, 1e9) ||
    !integer(progress.mission, 0, 11) || !finite(progress.mined, 0, 1e9) || !finite(progress.mixed, 0, 1e9) ||
    !finite(progress.crystalsMade, 0, 1e9) || typeof progress.ruins !== 'boolean' || typeof progress.won !== 'boolean') throw new Error('Progresso inválido');
  const progressState: Progress = { mined: progress.mined, mixed: progress.mixed, crystalsMade: progress.crystalsMade,
    tier: progress.tier, ruins: progress.ruins, won: progress.won, elapsed: progress.elapsed, mission: progress.mission };
  const preferences: Preferences = { volume: 0.18, shake: true, zoom: 3 };
  if (data.preferences !== undefined) {
    const prefs = data.preferences;
    if (!record(prefs) || !finite(prefs.volume, 0, 1) || !finite(prefs.zoom, 1.5, 6) || typeof prefs.shake !== 'boolean') throw new Error('Preferências inválidas');
    preferences.volume = prefs.volume; preferences.shake = prefs.shake; preferences.zoom = prefs.zoom;
  }
  // Restore occupancy and networks without spending energy, processing inputs or advancing time.
  factory.rebuildBlocks(); factory.pipes.rebuild(factory.machines);
  return { world, factory, player, inventory: Array.from({length:materials.length},(_,i)=>data.inventory[i]??0), progress: progressState, preferences };
}
