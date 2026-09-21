import { World } from '../sim/world';
import { Factory, MACHINE_DEFS, machineSize, normalizeRotation, type Machine, type MachineKind } from '../sim/machines';
import { Mat, materials } from '../sim/materials';
import { acceptsFluid, isPipeMachine, PIPE_CAPACITY } from '../sim/pipes';
import { Player } from './player';
import { RESEARCH } from './progression';
import { Exploration } from './exploration';
import { regionAt, surfaceLevel, chambers, legacyTerrainData } from '../sim/terrain';
import { restoreTerrainData } from '../sim/terrain-persistence';

export const SAVE_KEY = 'prismara.world.v1';
export const SAVE_VERSION = 4;
export interface Progress { mined: number; mixed: number; crystalsMade: number; tier: number; ruins: boolean; won: boolean; elapsed: number; mission: number; researched?:string[]; discovered?:number[]; solved?:string[]; chamberFeed?:number; visited?:string[] }
export interface Preferences { volume: number; shake: boolean; zoom: number; uiScale?:number }
export interface Saveable { world: World; factory: Factory; player: Player; inventory: number[]; progress: Progress; preferences: Preferences; exploration?:Exploration }

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

function unrle(source: unknown, length: number, min: number, max: number): Int32Array {
  if (!Array.isArray(source) || source.length % 2 || source.length > length * 2) throw new Error('Dados de partículas inválidos');
  const out = new Int32Array(length);let cursor=0;
  for (let i = 0; i < source.length; i += 2) {
    const value = source[i], count = source[i + 1];
    if (!integer(value, min, max) || !integer(count, 1, 65535) || cursor + count > length) throw new Error('Partículas fora dos limites');
    out.fill(value,cursor,cursor+count);cursor+=count;
  }
  if (cursor !== length) throw new Error('Mundo incompleto');
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
  const knowledge=game.exploration??new Exploration(w);
  if(!game.exploration)knowledge.migrate(player.x,player.y,game.factory.machines);
  return JSON.stringify({
    version: SAVE_VERSION, savedAt: Date.now(),
    world: { width: w.width, height: w.height, seed: w.seed, tick: w.tick, rngState: w.rngState,
      cells: rle(w.cells), temperature: rle(w.temperature), fall: rle(w.fall), active: rle(w.active), reactionCounts: w.reactionCounts,
      consolidated:rle(w.consolidated),velocityX:rle(w.velocityX),velocityY:rle(w.velocityY),visualVariant:rle(w.visualVariant),backdrop:rle(w.backdrop),generation:w.generation??legacyTerrainData(w) },
    exploration:{width:w.width,height:w.height,discoveredCells:rle(knowledge.discoveredCells),rememberedMaterial:rle(knowledge.rememberedMaterial),points:knowledge.points,map:knowledge.map},
    machines: game.factory.machines, nextId: game.factory.nextId,
    energy: { value: game.factory.energy.value, capacity: game.factory.energy.capacity },
    counters: game.factory.counters,
    credits:{gold:game.factory.gold,crystals:game.factory.crystals},
    player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, facing: player.facing,
      fuel: player.fuel, grounded: player.grounded, thrust: player.thrust,propulsion:player.propulsion },
    inventory: game.inventory, progress: game.progress, preferences: game.preferences,
  });
}

export function deserialize(raw: string): Saveable {
  const data: unknown = JSON.parse(raw);
  if (!record(data) || ![1,2,3,SAVE_VERSION].includes(data.version)) throw new Error('Este salvamento pertence a outra versão de Prismara.');
  const legacy=data.version===1;
  const w = data.world;
  if (!record(w) || !integer(w.width, 32, 1024) || !integer(w.height, 32, 2048)) throw new Error('Dimensão inválida');
  if (!integer(w.seed, 0, 0xffffffff) || !integer(w.tick, 0, 0xffffffff) || !integer(w.rngState, 0, 0xffffffff)) throw new Error('Semente inválida');
  const world = new World(w.width, w.height, w.seed), length = w.width * w.height;
  world.generation=data.version>=4?restoreTerrainData(w.generation,world):legacyTerrainData(world);
  world.cells.set(unrle(w.cells, length, 0, materials.length - 1));
  world.temperature.set(unrle(w.temperature, length, -32768, 32767));
  world.fall.set(unrle(w.fall, length, 0, 65535));
  if(!legacy)for(const [key,min,max] of [['consolidated',0,1],['velocityX',-8,8],['velocityY',-8,8]] as const) {
    world[key].set(unrle(w[key],length,min,max));
  }
  if(legacy)for(let i=0;i<length;i++)if(materials[world.cells[i]].state==='terrain')world.consolidated[i]=1;
  if(data.version>=3){world.visualVariant.set(unrle(w.visualVariant,length,0,255));world.backdrop.set(unrle(w.backdrop,length,0,6));}
  else for(let i=0;i<length;i++) {
    world.visualVariant[i]=world.cells[i]===Mat.Air?0:world.variantAt(i);
    const y=Math.floor(i/world.width);if(y>=surfaceLevel(world))world.backdrop[i]=regionAt(world,i%world.width,y)+1;
  }
  world.tick = w.tick; world.rngState = w.rngState;
  world.rebuildActivity();
  // Early v1 files did not retain sleeping chunks. New files resume the identical scan order.
  if (w.active !== undefined) world.active.set(unrle(w.active, world.active.length, 0, 1));
  if (w.reactionCounts !== undefined) {
    if (!record(w.reactionCounts)) throw new Error('Contadores de reação inválidos');
    for (const key of Object.keys(w.reactionCounts)) {
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
    const kind = m.kind as MachineKind, def = machineSize(kind,legacy?normalizeRotation(kind,m.rotation):m.rotation);
    if (!integer(m.id, 1, 0x7ffffffe) || ids.has(m.id) || !integer(m.x, 0, world.width - def.w) ||
      !integer(m.y, 0, world.height - def.h) || m.w !== def.w || m.h !== def.h ||
      !integer(m.rotation, 0, 3) || typeof m.enabled !== 'boolean' || typeof m.signal !== 'boolean' ||
      typeof m.status !== 'string' || m.status.length > 200 || !integer(m.filter, 0, materials.length - 1) ||
      !finite(m.densityMin, 0, 65535) || !finite(m.densityMax, m.densityMin, 65535) ||
      !['material', 'density'].includes(m.mode) || !finite(m.flash, 0, 1000) ||
      (m.targetId !== undefined && !integer(m.targetId, 1, 0x7ffffffe))) throw new Error('Configuração de máquina inválida');
    const machine: Machine = { id: m.id, kind, x: m.x, y: m.y, w: def.w, h: def.h,
      rotation: legacy?normalizeRotation(kind,m.rotation):m.rotation, enabled: m.enabled, signal: m.signal, status: m.status, filter: m.filter,
      densityMin: m.densityMin, densityMax: m.densityMax, mode: m.mode, flash: m.flash };
    if (m.targetId !== undefined) machine.targetId = m.targetId;
    if(m.force!==undefined){if(!finite(m.force,1,8))throw new Error('Força inválida');machine.force=m.force;}
    if(m.angle!==undefined){if(!finite(m.angle,0,80))throw new Error('Ângulo inválido');machine.angle=m.angle;}
    if(m.interval!==undefined){if(!integer(m.interval,1,120))throw new Error('Vazão inválida');machine.interval=m.interval;}
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
  if(data.credits!==undefined) {
    if(!record(data.credits)||!integer(data.credits.gold,0,1e9)||!integer(data.credits.crystals,0,1e9))throw new Error('Créditos inválidos');
    factory.gold=data.credits.gold;factory.crystals=data.credits.crystals;
  }

  const player = new Player(), p = data.player;
  if (!record(p) || !finite(p.x, 0, world.width) || !finite(p.y, 0, world.height) || !finite(p.fuel, 0, 100) ||
    (p.vx !== undefined && !finite(p.vx, -1000, 1000)) || (p.vy !== undefined && !finite(p.vy, -1000, 1000)) ||
    (p.facing !== undefined && p.facing !== -1 && p.facing !== 1) ||
    (p.grounded !== undefined && typeof p.grounded !== 'boolean') ||
    (p.thrust !== undefined && typeof p.thrust !== 'boolean')) throw new Error('Explorador inválido');
  player.x = p.x; player.y = p.y; player.fuel = p.fuel;
  player.vx = p.vx ?? 0; player.vy = p.vy ?? 0; player.facing = p.facing ?? 1;
  player.grounded = p.grounded ?? false; player.thrust = p.thrust ?? false;
  if(p.propulsion!==undefined){if(!integer(p.propulsion,0,3))throw new Error('Propulsor inválido');player.propulsion=p.propulsion;}
  if (!Array.isArray(data.inventory) || (data.inventory.length !== materials.length && !(legacy&&[16,17].includes(data.inventory.length))) ||
    data.inventory.some(value => !integer(value, 0, 1e8))) throw new Error('Mochila inválida');
  const progress = data.progress;
  if (!record(progress) || !integer(progress.tier, 1, 4) || !finite(progress.elapsed, 0, 1e9) ||
    !integer(progress.mission, 0, 11) || !finite(progress.mined, 0, 1e9) || !finite(progress.mixed, 0, 1e9) ||
    !finite(progress.crystalsMade, 0, 1e9) || typeof progress.ruins !== 'boolean' || typeof progress.won !== 'boolean') throw new Error('Progresso inválido');
  const progressState: Progress = { mined: progress.mined, mixed: progress.mixed, crystalsMade: progress.crystalsMade,
    tier: progress.tier, ruins: progress.ruins, won: progress.won, elapsed: progress.elapsed, mission: progress.mission };
  if(legacy) {
    progressState.researched=RESEARCH.filter(r=>(progress.tier>=2&&['processing','heat','transport'].includes(r.id))||(progress.tier>=3&&['liquids','glass'].includes(r.id))||(progress.tier>=4&&r.id==='automation')).map(r=>r.id);
    progressState.discovered=[0];progressState.solved=[];progressState.visited=[];progressState.chamberFeed=0;progressState.mission=0;
  } else {
    const lists:[string,(v:any)=>boolean][]=[['researched',v=>typeof v==='string'&&RESEARCH.some(r=>r.id===v)],['discovered',v=>integer(v,0,5)],['solved',v=>['drain','thaw','feed'].includes(v)],['visited',v=>['drain','thaw','feed'].includes(v)]];
    for(const [key,valid] of lists)if(progress[key]!==undefined){const list=progress[key];if(!Array.isArray(list)||list.length>30||!list.every(valid)||new Set(list).size!==list.length)throw new Error('Descobertas inválidas');(progressState as any)[key]=[...list];}
    if(progress.chamberFeed!==undefined){if(!integer(progress.chamberFeed,0,12))throw new Error('Mecanismo inválido');progressState.chamberFeed=progress.chamberFeed;}
    for(const id of progressState.researched??[])if(!RESEARCH.find(r=>r.id===id)!.requires.every(dep=>progressState.researched!.includes(dep)))throw new Error('Dependência de pesquisa inválida');
  }
  const preferences: Preferences = { volume: 0.18, shake: true, zoom: 3 };
  if (data.preferences !== undefined) {
    const prefs = data.preferences;
    if (!record(prefs) || !finite(prefs.volume, 0, 1) || !finite(prefs.zoom, 1.5, 6) || typeof prefs.shake !== 'boolean') throw new Error('Preferências inválidas');
    preferences.volume = prefs.volume; preferences.shake = prefs.shake; preferences.zoom = prefs.zoom;
    if(prefs.uiScale!==undefined){if(!finite(prefs.uiScale,.85,1.4))throw new Error('Escala inválida');preferences.uiScale=prefs.uiScale;}
  }
  // Restore occupancy and networks without spending energy, processing inputs or advancing time.
  factory.rebuildBlocks(); factory.pipes.rebuild(factory.machines);
  if(!legacy)for(let i=0;i<length;i++) {
    if(world.consolidated[i]&&world.cells[i]===Mat.Air)throw new Error('Depósito sem material');
    if(world.blocked[i]&&world.cells[i]!==Mat.Air&&!world.accepts(i%world.width,Math.floor(i/world.width),world.cells[i]))throw new Error('Material sobreposto à estrutura');
  }
  const exploration=new Exploration(world);
  if(data.version>=3){
    const e=data.exploration;
    if(!record(e)||e.width!==world.width||e.height!==world.height||!Array.isArray(e.points)||e.points.length>3||new Set(e.points).size!==e.points.length||!e.points.every((id:unknown)=>['drain','thaw','feed'].includes(id as string)))throw new Error('Cartografia inválida');
    exploration.discoveredCells.set(unrle(e.discoveredCells,length,0,1));exploration.rememberedMaterial.set(unrle(e.rememberedMaterial,length,0,materials.length-1));
    for(let i=0;i<length;i++)if(!exploration.discoveredCells[i]&&exploration.rememberedMaterial[i]!==Mat.Air)throw new Error('Material cartográfico sem descoberta');
    exploration.points=[...e.points];
    if(!record(e.map)||!finite(e.map.x,0,world.width)||!finite(e.map.y,0,world.height)||!finite(e.map.zoom,.5,8))throw new Error('Posição do mapa inválida');
    exploration.map={x:e.map.x,y:e.map.y,zoom:e.map.zoom};
    for(const c of chambers(world))if(exploration.points.includes(c.id)&&!exploration.knows(c.x,c.y-20))throw new Error('Marcador de câmara oculta');
  }else exploration.migrate(player.x,player.y,machines);
  return { world, factory, player, exploration, inventory: Array.from({length:materials.length},(_,i)=>data.inventory[i]??0), progress: progressState, preferences };
}

const DATABASE='prismara.saves';
let encoder:Worker|undefined,encodingId=0;
const pending=new Map<number,{resolve:(raw:string)=>void;reject:(error:Error)=>void}>();
/** Snapshot cloning is atomic; compression runs off the presentation thread. */
export function serializeAsync(game:Saveable):Promise<string> {
  if(typeof Worker==='undefined')return Promise.resolve(serialize(game));
  if(!encoder){
    encoder=new Worker(new URL('./save-worker.ts',import.meta.url),{type:'module'});
    encoder.onmessage=(event:MessageEvent<{id:number;raw?:string;error?:string}>)=>{
      const p=pending.get(event.data.id);if(!p)return;pending.delete(event.data.id);
      if(event.data.error)p.reject(new Error(event.data.error));else p.resolve(event.data.raw!);
    };
    encoder.onerror=()=>{for(const p of pending.values())p.reject(new Error('Falha ao comprimir a partida'));pending.clear();encoder?.terminate();encoder=undefined;};
  }
  const w=game.world,id=++encodingId;
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    encoder!.postMessage({id,game:{world:{width:w.width,height:w.height,seed:w.seed,tick:w.tick,rngState:w.rngState,cells:w.cells,temperature:w.temperature,fall:w.fall,active:w.active,reactionCounts:w.reactionCounts,consolidated:w.consolidated,velocityX:w.velocityX,velocityY:w.velocityY,visualVariant:w.visualVariant,backdrop:w.backdrop,generation:w.generation??legacyTerrainData(w)},
      exploration:game.exploration?{discoveredCells:game.exploration.discoveredCells,rememberedMaterial:game.exploration.rememberedMaterial,points:game.exploration.points,map:game.exploration.map}:undefined,
      factory:{machines:game.factory.machines,nextId:game.factory.nextId,energy:game.factory.energy,counters:game.factory.counters,gold:game.factory.gold,crystals:game.factory.crystals},
      player:game.player,inventory:game.inventory,progress:game.progress,preferences:game.preferences}});
  });
}
async function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('worlds');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
/** Atomic async storage. Legacy localStorage remains readable until v2 is committed. */
export async function readSave():Promise<string|null> {
  const db=await database();
  try{return await new Promise<string|null>((resolve,reject)=>{const r=db.transaction('worlds').objectStore('worlds').get('current');r.onsuccess=()=>resolve(r.result??localStorage.getItem(SAVE_KEY));r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function writeSave(raw:string):Promise<void> {
  const db=await database();
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('worlds','readwrite');tx.objectStore('worlds').put(raw,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
