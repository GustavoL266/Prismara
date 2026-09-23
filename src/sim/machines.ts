import type {PendingModule} from '../game/migrate-modules';
import { MODULE_SIZE, MODULE_CENTER, FLOW_ROW, globalCell, localCell, rotateVector } from './module-geometry';
export { MODULE_SIZE, globalCell, localCell } from './module-geometry';
import { Mat, MATERIALS } from './materials';
import { CHUNK_SIZE, World } from './world';
import { Energy, ENERGY } from './energy';
import { PipeSystem, isPipeMachine, type FluidBuffer } from './pipes';
import { updateSignals } from './signals';
import { REACTIONS } from './reactions';

export type MachineKind = 'belt' | 'lift' | 'filter' | 'separator' | 'kiln' | 'crucible' | 'mist' | 'press' | 'crusher' | 'pump' | 'pipe' | 'valve' | 'vault' | 'sensor' | 'fastbelt' | 'sieve' | 'collector' | 'block' | 'platform' | 'wall' | 'funnel' | 'gate' | 'launcher' | 'drill' | 'heater' | 'hauler' | 'lamp';
export interface MachineDef { name: string; w: number; h: number; tier: number; cost: number; description: string; input: string; output: string; color: string; rotation?: 'none'|'flip'|'quarter'; category?: string; research?: string }
export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  belt: { name: 'Esteira de Placas', w:MODULE_SIZE,h:MODULE_SIZE, tier: 1, cost: 2, description: 'Carrega a camada em contato. Pilhas congestionam. R gira o módulo.', input: 'Grãos sobre a superfície', output: 'Lateral', color: '#899096', category:'Transporte' },
  separator: { name: 'Tambor de Argila', w:MODULE_SIZE,h:MODULE_SIZE, tier: 2, cost: 8, research:'processing', description: 'Resíduo ou polpa → argila + 22% de quartzo adicional.', input: 'Resíduo ou polpa por cima', output: 'Argila lateral · quartzo embaixo', color: '#899096' },
  vault: { name: 'Cofre Prismático', w:MODULE_SIZE,h:MODULE_SIZE, tier: 1, cost: 5, description: 'Cristais físicos na cavidade contam para pesquisa.', input: 'Cristal por cima', output: 'Reserva de pesquisa', color: '#c87bea' },
  kiln: { name: 'Forno Cerâmico', w:MODULE_SIZE,h:MODULE_SIZE, tier: 2, cost: 7, description: 'Argila → pelota. Aquecimento solar lento quando falta energia.', input: 'Argila por cima', output: 'Pelota pela lateral', color: '#e88854' },
  lift: { name: 'Elevador Magnético', w:MODULE_SIZE,h:MODULE_SIZE, tier: 2, cost: 5, description: 'Sobe sólidos pelo eixo aberto e lança pelo topo.', input: 'Sólidos na base', output: 'Topo · R gira o módulo', color: '#66a5b5' },
  press: { name: 'Prensa Piezoelétrica', w:MODULE_SIZE,h:MODULE_SIZE, tier: 2, cost: 8, description: 'Pelotas após 18 células de queda geram 32 E e cacos.', input: 'Pelotas em queda livre', output: 'Energia + caco cerâmico', color: '#dcc572' },
  crusher: { name: 'Triturador', w:MODULE_SIZE,h:MODULE_SIZE, tier: 2, cost: 5, description: 'Recicla cacos e vidro. Consome 0,2 E por grão.', input: 'Caco ou fragmento por cima', output: 'Areia ou quartzo embaixo', color: '#9da7a6' },
  crucible: { name: 'Cadinho de Vidro', w:MODULE_SIZE,h:MODULE_SIZE, tier: 3, cost: 10, description: 'Quartzo + 3 E → vidro fundido a 1100 °C.', input: 'Quartzo por cima', output: 'Vidro líquido embaixo', color: '#ffc26a' },
  mist: { name: 'Gerador de Névoa', w:MODULE_SIZE,h:MODULE_SIZE, tier: 3, cost: 6, description: 'Água + 0,35 E → névoa fria. R gira a saída.', input: 'Água por cima', output: 'Névoa na direção selecionada', color: '#8de8ed' },
  pump: { name: 'Bomba', w:MODULE_SIZE,h:MODULE_SIZE, tier: 3, cost: 4, description: 'Aspira água ou polpa na borda. Conecte peças pelos lados.', input: 'Líquido em contato', output: 'Rede de tubos', color: '#699da7' },
  pipe: { name: 'Tubo', w:MODULE_SIZE,h:MODULE_SIZE, tier: 3, cost: 1, description: 'Rede em camada secundária. Cada peça armazena 48 pixels.', input: 'Bomba ou tubo conectado', output: 'Tubo ou válvula conectada', color: '#547b91' },
  valve: { name: 'Válvula de Saída', w:MODULE_SIZE,h:MODULE_SIZE, tier: 3, cost: 2, description: 'Devolve o líquido da rede ao mundo. R gira a saída.', input: 'Tubo conectado', output: 'Líquido físico', color: '#87d0d1' },
  filter: { name: 'Portão de Densidade', w:MODULE_SIZE,h:MODULE_SIZE, tier: 4, cost: 6, description: 'Aceitos caem; rejeitados seguem pela superfície. Configure no inspetor.', input: 'Mistura por cima', output: 'Filtro embaixo · rejeitos lateral', color: '#c7aa74' },
  sensor: { name: 'Sensor de Presença', w:MODULE_SIZE,h:MODULE_SIZE, tier: 4, cost: 5, description: 'Lê uma área acima e controla a máquina próxima.', input: 'Material na área de detecção', output: 'Sinal verde ou vermelho', color: '#8fc795' },
  fastbelt: { name: 'Esteira Rápida', w:MODULE_SIZE,h:MODULE_SIZE, tier: 4, cost: 5, description: 'Placas de avanço duplo. R gira o módulo.', input: 'Sólidos sobre a superfície', output: 'Lateral', color: '#b6d979' },
  sieve:{name:'Peneira Vibratória',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:6,description:'Areia úmida → resíduo sobre a grelha + 25% de ouro abaixo. Sem energia.',input:'Areia úmida sobre a grelha',output:'Resíduo lateral · ouro inferior',color:'#D69B32',category:'Processamento'},
  collector:{name:'Coletor de Minérios',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:4,description:'Abertura superior. Ouro e cristais físicos são creditados uma única vez.',input:'Ouro ou cristal por cima',output:'Moedas de pesquisa',color:'#F3CF4C',rotation:'none',category:'Processamento'},
  block:{name:'Bloco Estrutural',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:1,description:'Suporte sólido. Arraste para construir.',input:'Contém grãos e líquidos',output:'—',color:'#899096',rotation:'none',category:'Estruturas'},
  platform:{name:'Plataforma',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:2,description:'Piso fino para conduzir a gravidade.',input:'Suporte físico',output:'—',color:'#899096',rotation:'quarter',category:'Estruturas'},
  wall:{name:'Parede de Contenção',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:2,description:'Fecha reservatórios e desvios. R gira de verdade.',input:'Contém líquidos',output:'—',color:'#899096',rotation:'quarter',category:'Estruturas'},
  funnel:{name:'Funil de Gravidade',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:3,description:'Paredes inclinadas concentram o fluxo numa garganta de duas células.',input:'Abertura superior',output:'Garganta inferior',color:'#899096',rotation:'quarter',category:'Estruturas'},
  gate:{name:'Comporta',w:MODULE_SIZE,h:MODULE_SIZE,tier:1,cost:2,description:'Fechada contém materiais. Desligue para abrir. R gira.',input:'Reservatório acima',output:'Abertura controlada',color:'#D69B32',rotation:'quarter',category:'Estruturas'},
  launcher:{name:'Lançador de Impulso',w:MODULE_SIZE,h:MODULE_SIZE,tier:2,cost:5,research:'transport',description:'Lança o grão que toca o berço. Trajetória física com colisão.',input:'Grãos sobre o berço',output:'Boca na direção e força configuradas',color:'#D69B32',rotation:'flip',category:'Transporte'},
  drill:{name:'Sonda Escavadora',w:MODULE_SIZE,h:MODULE_SIZE,tier:4,cost:12,research:'automation',description:'Rompe depósitos abaixo de si. 0,15 E por célula liberada; nada vai à mochila.',input:'Terreno abaixo',output:'Grãos no mundo',color:'#D69B32',rotation:'none',category:'Automação'},
  heater:{name:'Câmara de Calcinação',w:MODULE_SIZE,h:MODULE_SIZE,tier:3,cost:8,research:'heat',description:'Resíduo + 0,6 E → resíduo calcinado quente.',input:'Resíduo por cima',output:'Calcinado pela lateral',color:'#d88854',category:'Processamento'},
  hauler:{name:'Transportador de Arraste',w:MODULE_SIZE,h:MODULE_SIZE,tier:4,cost:8,research:'automation',description:'Correia automatizada para sólidos e areia úmida. Duplo avanço.',input:'Grãos na superfície',output:'Lateral',color:'#D69B32',category:'Automação'},
  lamp:{name:'Luminária de Galeria',w:MODULE_SIZE,h:MODULE_SIZE,tier:2,cost:3,research:'exploration',description:'Ilumina a fábrica e registra um disco local de 38 células. Consome 0,002 E por passo.',input:'Energia',output:'Luz e descoberta local',color:'#F1BD4F',rotation:'none',category:'Exploração'},
};
for(const [kind,d] of Object.entries(MACHINE_DEFS)) {
  d.rotation=['block','pipe','lamp','collector','vault'].includes(kind)?'none':'quarter';
  d.category??=['pump','pipe','valve','mist'].includes(kind)?'Líquidos':['belt','lift','fastbelt','filter'].includes(kind)?'Transporte':['sensor'].includes(kind)?'Automação':'Processamento';
  d.research??=({kiln:'heat',press:'heat',crusher:'processing',crucible:'glass',mist:'glass',pump:'liquids',pipe:'liquids',valve:'liquids',filter:'transport',sensor:'automation',fastbelt:'transport',lift:'transport',vault:'glass'} as Record<string,string>)[kind];
}
export function normalizeRotation(kind:MachineKind,r:number):number {const mode=MACHINE_DEFS[kind].rotation;return mode==='none'?0:((r%(mode==='flip'?2:4))+(mode==='flip'?2:4))%(mode==='flip'?2:4);}
export function machineSize(_kind:MachineKind,_r=0):{w:number;h:number} {return {w:MODULE_SIZE,h:MODULE_SIZE};}
export function machineSolid(m:Machine,x:number,y:number):boolean {
  if(secondary(m.kind))return false;
  const p=localCell(m,x,y),n=MODULE_SIZE-1;
  if(p.x<0||p.y<0||p.x>n||p.y>n)return false;
  if(m.kind==='gate')return m.enabled&&m.signal!==false&&p.y===n;
  if(m.kind==='platform')return p.y===n;
  if(m.kind==='wall')return p.x===0;
  if(['vault','collector'].includes(m.kind))return p.x===0||p.x===n||p.y===n;
  if(m.kind==='funnel'){const inset=Math.min(Math.floor(p.y/2),2);return p.x===inset||p.x===n-inset;}
  if(m.kind==='lift')return p.x===0||p.x===n;
  if(['belt','fastbelt','hauler','launcher'].includes(m.kind))return p.y===FLOW_ROW+1||p.y===FLOW_ROW+2;
  if(['sieve','filter'].includes(m.kind))return p.y===FLOW_ROW+1||(p.y>FLOW_ROW+1&&(p.x===0||p.x===n));
  return true;
}
export const surfaceRow=(kind:MachineKind)=>['belt','fastbelt','hauler','sieve','filter','launcher'].includes(kind)?FLOW_ROW:-1;
export function machinePorts(m:Machine):{x:number;y:number;label:string}[] {
  if(['block','wall','platform','gate','lamp'].includes(m.kind))return [];
  if(m.kind==='pipe')return [[4,-1],[8,4],[4,8],[-1,4]].map(([x,y])=>({...globalCell(m,x,y),label:'Rede'}));
  if(m.kind==='pump')return [{...globalCell(m,4,-1),label:'Entrada'}, {...globalCell(m,4,8),label:'Rede'}];
  const ports=[{...feedPoint(m),label:'Entrada'}];
  if(['belt','fastbelt','hauler','sieve','filter','separator','heater','kiln','press','launcher'].includes(m.kind))ports.push({...globalCell(m,8,4),label:m.kind==='sieve'?'Resíduo':'Saída'});
  if(['sieve','separator','crucible','crusher','filter','funnel','mist','valve','lift'].includes(m.kind))ports.push(outlet(m));
  return ports;
}
export function outlet(m:Machine):{x:number;y:number;label:string} {return {...globalCell(m,MODULE_CENTER,m.kind==='lift'?-1:MODULE_SIZE),label:m.kind==='sieve'?'Ouro':'Saída'};}
export const RECIPES = {
  separator: { every: 5, quartzChance: REACTIONS.separator.bonusChance }, kiln: { every: 7, solarEvery: 40 },
  crucible: { every: 8, temperature: REACTIONS.melting.outputTemperature }, mist: { every: 1, temperature: -45 },
  press: { minimumFall: REACTIONS.piezo.minimumFall }, crusher: { every: 4, quartzChance: REACTIONS.crusher.quartzChance },
};
export interface Machine {
  id: number; kind: MachineKind; x: number; y: number; w: number; h: number; rotation: number;
  enabled: boolean; signal: boolean; status: string; filter: Mat; densityMin: number; densityMax: number;
  mode: 'material' | 'density'; targetId?: number; buffer?: FluidBuffer; flash: number;
  stockCost?:number; force?: number; angle?: number; interval?:number;
}
export function feedPoint(m:Machine){return globalCell(m,MODULE_CENTER,m.kind==='lift'?MODULE_SIZE-2:-1);}
const granular = (m: Mat): boolean => ['granular','paste'].includes(MATERIALS[m].state);
export const secondary = (kind: MachineKind) => ['pipe', 'pump', 'valve', 'sensor'].includes(kind);

export class Factory {
  machines: Machine[] = [];
  pendingModules:PendingModule[]=[];
  restorePending(id:number,x:number,y:number,rotation:number):Machine|null {
    const p=this.pendingModules.find(p=>p.machine.id===id);if(!p||!this.canPlace(p.machine.kind,x,y,rotation))return null;
    const m={...p.machine,x,y,rotation:normalizeRotation(p.machine.kind,rotation)};this.machines.push(m);this.pendingModules=this.pendingModules.filter(p=>p.machine.id!==id);this.rebuildBlocks();this.wakeFootprint(m);this.pipes.rebuild(this.machines);return m;
  }
  energy = new Energy();
  nextId = 1;
  gold=0; crystals=0;
  private collisionSignature='';private lifted=new Set<number>();
  counters: Record<string, number> = { pulp: 0, clay: 0, quartz: 0, pellet: 0, impacts: 0, energy: 0, molten: 0, crystal: 0, stored: 0, recycled: 0 };
  pipes: PipeSystem;
  constructor(public world: World) { this.pipes = new PipeSystem(world); }
  canPlace(kind: MachineKind, x: number, y: number, rotation = 0): boolean {
    const { w, h } = machineSize(kind,rotation);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y < 2 || x + w >= this.world.width - 1 || y + h >= this.world.height - 1) return false;
    for (const other of this.machines) {
      if (secondary(kind) !== secondary(other.kind)) continue;
      if (x < other.x + other.w && x + w > other.x && y < other.y + other.h && y + h > other.y) return false;
    }
    if (!secondary(kind)) for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
      const m = this.world.get(px, py);
      if (m !== Mat.Air || this.world.consolidated[this.world.index(px,py)]) return false;
    }
    return true;
  }
  add(kind: MachineKind, x: number, y: number, rotation = 0): Machine | null {
    if (!this.canPlace(kind, x, y, rotation)) return null;
    const d = machineSize(kind,rotation);
    const machine: Machine = { id: this.nextId++, kind, x, y, w: d.w, h: d.h, rotation: normalizeRotation(kind,rotation),
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
    this.world.blocked.fill(0);this.world.passage.fill(0);
    for (const m of this.machines) {
      if (secondary(m.kind)) continue;
      for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
        if (machineSolid(m,x,y)) {
          const i=this.world.index(x,y);this.world.blocked[i]=m.id;
          if(['sieve','filter','collector'].includes(m.kind)) {
            let pass=(1<<Mat.Water)|(1<<Mat.Steam)|(1<<Mat.Mist)|(1<<Mat.Lumen);
            if(m.kind==='sieve')pass|=1<<Mat.Gold;
            if(m.kind==='filter')for(const d of MATERIALS)if(m.mode==='material'?d.id===m.filter:granular(d.id)&&d.density>=m.densityMin&&d.density<=m.densityMax)pass|=1<<d.id;
            this.world.passage[i]=pass;
          }
        }
      }
    }
    this.collisionSignature=this.signature();
  }
  private signature(){return this.machines.map(m=>`${m.id}:${m.rotation}:${m.kind==='gate'?m.enabled+':'+m.signal:''}:${m.kind==='filter'?m.filter+':'+m.mode+':'+m.densityMin+':'+m.densityMax:''}`).join('|');}
  rotate(id:number):boolean {
    const m=this.machines.find(m=>m.id===id);if(!m)return false;
    const r=normalizeRotation(m.kind,m.rotation+1),size=machineSize(m.kind,r);
    if(size.w!==m.w||size.h!==m.h) {
      if(this.machines.some(o=>o.id!==id&&!secondary(o.kind)&&m.x<o.x+o.w&&m.x+size.w>o.x&&m.y<o.y+o.h&&m.y+size.h>o.y))return false;
      if(m.x+size.w>=this.world.width||m.y+size.h>=this.world.height)return false;
    }
    const probe={...m,...size,rotation:r};
    for(let y=m.y;y<m.y+size.h;y++)for(let x=m.x;x<m.x+size.w;x++)if(machineSolid(probe,x,y)&&this.world.get(x,y)!==Mat.Air)return false;
    Object.assign(m,size,{rotation:r});this.rebuildBlocks();this.wakeFootprint(m);this.pipes.rebuild(this.machines);return true;
  }
  setEnabled(id:number,enabled:boolean):boolean {
    const m=this.machines.find(m=>m.id===id);if(!m)return false;
    if(m.kind==='gate'&&enabled)for(let y=m.y;y<m.y+m.h;y++)for(let x=m.x;x<m.x+m.w;x++)if(machineSolid({...m,enabled:true,signal:true},x,y)&&this.world.get(x,y)!==Mat.Air){m.status='Comporta ocupada';return false;}
    m.enabled=enabled;this.rebuildBlocks();this.wakeFootprint(m);return true;
  }
  private empty(x: number, y: number): boolean {
    return this.world.inBounds(x, y) && this.world.get(x, y) === Mat.Air && this.world.blocked[this.world.index(x, y)] === 0;
  }
  private input(m:Machine,material:Mat):{x:number;y:number}|null {
    for(let x=0;x<MODULE_SIZE;x++){const p=globalCell(m,x,surfaceRow(m.kind));if(this.world.get(p.x,p.y)===material)return p;}return null;
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
  private convey(m:Machine,filter=false):void {
    if(m.kind==='sieve'&&this.world.tick%REACTIONS.sieve.residueEvery)return;
    let moved=false,occupied=false;
    for(let t=0;t<(['fastbelt','hauler'].includes(m.kind)?2:1);t++)for(let x=MODULE_SIZE-1;x>=0;x--){
      const p=globalCell(m,x,FLOW_ROW),mat=this.world.get(p.x,p.y);if(!granular(mat))continue;
      occupied=true;const density=MATERIALS[mat].density,accepted=filter&&(m.mode==='material'?mat===m.filter:density>=m.densityMin&&density<=m.densityMax);
      const dest=globalCell(m,accepted?x:x+1,accepted?FLOW_ROW+1:FLOW_ROW);
      if(this.world.get(dest.x,dest.y)===Mat.Air&&this.world.accepts(dest.x,dest.y,mat)){
        this.world.swap(this.world.index(p.x,p.y),this.world.index(dest.x,dest.y));moved=true;
      }
    }
    m.status=moved?'Ativa':occupied?'Saída bloqueada':'Sem entrada';
  }
  step(): void {
    this.lifted.clear();
    updateSignals(this.world, this.machines);
    // A rising signal may close a gate only after its physical aperture is empty.
    for(const m of this.machines)if(m.kind==='gate'&&m.enabled&&m.signal){
      for(let y=m.y;y<m.y+m.h&&m.signal;y++)for(let x=m.x;x<m.x+m.w;x++)if(machineSolid(m,x,y)&&this.world.get(x,y)!==Mat.Air){m.signal=false;break;}
    }
    if(this.signature()!==this.collisionSignature){this.rebuildBlocks();for(const m of this.machines)this.wakeFootprint(m);}
    const tick = this.world.tick;
    for (const m of this.machines) {
      m.flash = Math.max(0, m.flash - 1);
      if (m.kind === 'sensor') continue;
      if(m.kind==='gate'){m.status=m.enabled&&m.signal?'Fechada':'Aberta';continue;}
      if (!m.enabled || !m.signal) { m.status = 'Desligada'; continue; }
      if (isPipeMachine(m)) continue;
      if (m.kind === 'lamp') { m.status=this.energy.spend(.002)?'Ativa':'Sem energia';continue; }
      if (m.kind === 'vault') { this.vault(m); continue; }
      if (m.kind === 'collector') { this.collector(m);continue; }
      if (['block','platform','wall','funnel'].includes(m.kind)){m.status='Estrutura';continue;}
      if (m.kind==='sieve'){this.sieve(m);continue;}
      if (m.kind==='launcher'){this.launcher(m);continue;}
      if (m.kind==='drill'){this.drill(m);continue;}
      if (m.kind === 'belt' || m.kind === 'fastbelt' || m.kind === 'hauler' || m.kind === 'filter') { this.convey(m, m.kind === 'filter'); continue; }
      if (m.kind === 'lift') { this.lift(m); continue; }
      if (m.kind === 'press') { this.press(m); continue; }
      const side=globalCell(m,MODULE_SIZE,MODULE_CENTER),bottom=outlet(m);
      m.status = 'Sem entrada';
      if (m.kind === 'separator') {
        const input = this.input(m, Mat.Residue)??this.input(m, Mat.Pulp); if (!input) {this.reject(m,[Mat.Residue,Mat.Pulp]);continue;}
        if (!this.empty(side.x, side.y) || !this.empty(bottom.x, bottom.y)) { m.status = 'Saída bloqueada'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.separator.every) continue;
        this.world.set(input.x, input.y, Mat.Air); this.emit(side.x, side.y, Mat.Clay);
        this.counters.pulp++; this.counters.clay++;
        if (this.world.rng() < RECIPES.separator.quartzChance) { this.emit(bottom.x, bottom.y, Mat.Quartz); this.counters.quartz++; }
        m.flash = 6;
      } else if (m.kind === 'heater') {
        const input=this.input(m,Mat.Residue);if(!input)continue;
        if(!this.empty(side.x,side.y)){m.status='Saída bloqueada';continue;}
        if(this.energy.value<.6){m.status='Sem energia';continue;}m.status='Ativa';if(tick%8)continue;
        this.energy.spend(.6);this.world.set(input.x,input.y,Mat.Air);this.emit(side.x,side.y,Mat.Calcined,480);m.flash=8;
      } else if (m.kind === 'kiln') {
        const input = this.input(m, Mat.Clay); if (!input) {this.reject(m,[Mat.Clay]);continue;}
        if (!this.empty(side.x, side.y)) { m.status = 'Saída bloqueada'; continue; }
        const solar = this.energy.value < ENERGY.kiln;
        m.status = solar ? 'Aquecimento solar' : 'Ativa';
        if (tick % (solar ? RECIPES.kiln.solarEvery : RECIPES.kiln.every)) continue;
        if (!solar) this.energy.spend(ENERGY.kiln);
        this.world.set(input.x, input.y, Mat.Air); this.emit(side.x, side.y, Mat.Pellet, 180);
        this.counters.pellet++; m.flash = 10;
      } else if (m.kind === 'crucible') {
        const input = this.input(m, Mat.Quartz); if (!input) {this.reject(m,[Mat.Quartz]);continue;}
        const gasDestination = this.displacedGasDestination(bottom.x, bottom.y);
        if (!this.empty(bottom.x, bottom.y) && !gasDestination) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.melt) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.crucible.every) continue;
        this.energy.spend(ENERGY.melt); this.world.set(input.x, input.y, Mat.Air);
        // A dense liquid pushes gas out of its outlet without deleting the coolant.
        if (gasDestination) this.world.swap(this.world.index(bottom.x, bottom.y), this.world.index(gasDestination.x, gasDestination.y));
        this.emit(bottom.x, bottom.y, Mat.Molten, RECIPES.crucible.temperature); this.counters.molten++; m.flash = 10;
      } else if (m.kind === 'mist') {
        const input = this.input(m, Mat.Water); if (!input) continue;
        const {x:ox,y:oy}=outlet(m);
        if (!this.empty(ox, oy)) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.mist) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.mist.every) continue;
        this.energy.spend(ENERGY.mist); this.world.set(input.x, input.y, Mat.Air);
        this.emit(ox, oy, Mat.Mist, RECIPES.mist.temperature);const jet=rotateVector(m.rotation,0,2);this.world.launch(ox,oy,jet.x,jet.y); m.flash = 5;
      } else if (m.kind === 'crusher') {
        const shard = this.input(m, Mat.Shard), glass = this.input(m, Mat.Glass),cal=this.input(m,Mat.Calcined), input = shard ?? glass ?? cal;
        if (!input) { this.reject(m, [Mat.Shard, Mat.Glass,Mat.Calcined]); continue; }
        if (!this.empty(bottom.x, bottom.y)) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.crush) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.crusher.every) continue;
        this.energy.spend(ENERGY.crush); this.world.set(input.x, input.y, Mat.Air);
        this.emit(bottom.x, bottom.y, cal?(this.world.rng()<.3?Mat.Quartz:Mat.Clay):!shard && this.world.rng() < RECIPES.crusher.quartzChance ? Mat.Quartz : Mat.Sand);
        this.counters.recycled++; m.flash = 4;
      }
    }
    this.pipes.step(this.machines);
    const stored = this.countCrystals(); this.counters.stored = Math.max(this.counters.stored, stored);
    this.counters.crystal = Math.max(this.counters.crystal, stored);
  }
  private sieve(m:Machine) {
    m.status='Sem entrada';let occupied=false,processed=false,blocked=false;
    for(let x=1;x<MODULE_SIZE-1;x++) {
      const p=globalCell(m,x,FLOW_ROW),out=globalCell(m,x,MODULE_SIZE),mat=this.world.get(p.x,p.y);if(mat!==Mat.Air)occupied=true;
      if(mat!==Mat.WetSand)continue;
      if(!this.empty(out.x,out.y)){blocked=true;continue;}
      if(this.world.tick%REACTIONS.sieve.every)continue;
      this.world.set(p.x,p.y,Mat.Residue);
      if(this.world.rng()<REACTIONS.sieve.goldChance){this.emit(out.x,out.y,Mat.Gold);this.counters.gold=(this.counters.gold??0)+1;}
      this.counters.wet=(this.counters.wet??0)+1;processed=true;m.flash=5;
    }
    if(blocked){m.status='Saída bloqueada';return;}
    if(occupied)this.convey(m);
    if(processed)m.status='Ativa';
  }
  private collector(m:Machine) {
    let credited=0;
    for(let y=m.y-1;y<m.y+m.h-1;y++)for(let x=m.x+1;x<m.x+m.w-1;x++) {
      const mat=this.world.get(x,y);if(mat!==Mat.Gold&&mat!==Mat.Crystal)continue;
      this.world.set(x,y,Mat.Air);if(mat===Mat.Gold){this.gold++;this.counters.collectedGold=(this.counters.collectedGold??0)+1;}else {this.crystals++;this.counters.stored++;}credited++;
    }
    m.status=credited?'Ativa':'Aguardando minério';if(credited)m.flash=5;
  }
  private launcher(m:Machine) {
    m.status='Sem entrada';
    const input=MATERIALS.find(d=>granular(d.id)&&this.input(m,d.id));if(!input)return;
    const p=this.input(m,input.id)!,local=localCell(m,p.x,p.y),out=globalCell(m,local.x,local.y-1);
    if(!this.empty(out.x,out.y)){m.status='Saída bloqueada';return;}
    this.world.swap(this.world.index(p.x,p.y),this.world.index(out.x,out.y));
    const angle=(m.angle??35)*Math.PI/180,force=m.force??5,v=rotateVector(m.rotation,Math.cos(angle)*force,-Math.sin(angle)*force);
    this.world.launch(out.x,out.y,v.x,v.y);m.flash=4;m.status='Ativa';
  }

  private drill(m:Machine) {
    if(this.world.tick%20)return;m.status='Sem depósito';
    // Work from the underside, releasing one cell into the same physical world.
    for(let depth=MODULE_SIZE+47;depth>=MODULE_SIZE;depth--)for(let col=1;col<MODULE_SIZE-1;col++) {
      const {x,y}=globalCell(m,col,depth);if(!this.world.inBounds(x,y))continue;
      const i=this.world.index(x,y),mat=this.world.get(x,y);
      if(this.world.blocked[i])continue;
      if(!this.world.consolidated[i]&&MATERIALS[mat].state!=='terrain')continue;
      const next=globalCell(m,col,depth+1);
      if(this.world.get(next.x,next.y)!==Mat.Air && this.world.inBounds(next.x,next.y)&&this.world.consolidated[this.world.index(next.x,next.y)])continue;
      if(this.energy.value<.15){m.status='Sem energia';return;}
      if(this.world.excavate(x,y)){this.energy.spend(.15);m.status='Ativa';m.flash=5;this.counters.mined=(this.counters.mined??0)+1;return;}
    }
  }
  private reject(m:Machine,accepts:Mat[]):void {
    let found=false,moved=false;
    for(let x=0;x<MODULE_SIZE;x++){
      const p=globalCell(m,x,surfaceRow(m.kind)),dest=globalCell(m,x-1,surfaceRow(m.kind)),mat=this.world.get(p.x,p.y);
      if(mat===Mat.Air||accepts.includes(mat))continue;found=true;
      if(this.empty(dest.x,dest.y)){this.world.swap(this.world.index(p.x,p.y),this.world.index(dest.x,dest.y));moved=true;}
    }
    if(found)m.status=moved?'Material rejeitado':'Entrada incompatível';
  }
  private lift(m:Machine):void {
    let moved=false,occupied=false;
    for(let y=0;y<MODULE_SIZE;y++)for(let x=1;x<MODULE_SIZE-1;x++){
      const p=globalCell(m,x,y);if(!granular(this.world.get(p.x,p.y))||this.lifted.has(this.world.index(p.x,p.y)))continue;occupied=true;
      const mid=globalCell(m,x,y-1),dest=globalCell(m,x,y-2);
      if(!this.empty(mid.x,mid.y)||!this.empty(dest.x,dest.y))continue;
      this.world.swap(this.world.index(p.x,p.y),this.world.index(dest.x,dest.y));this.world.fall[this.world.index(dest.x,dest.y)]=0;this.lifted.add(this.world.index(dest.x,dest.y));moved=true;
      if(y<2){const above=globalCell(m,0,-MODULE_SIZE),connected=this.machines.some(o=>o.kind==='lift'&&o.rotation===m.rotation&&o.x===Math.min(above.x,globalCell(m,MODULE_SIZE-1,-1).x)&&o.y===Math.min(above.y,globalCell(m,MODULE_SIZE-1,-1).y));
        if(!connected){const v=rotateVector(m.rotation,2,-1);this.world.launch(dest.x,dest.y,v.x,v.y);}
      }
    }
    m.status=moved?'Ativa':occupied?'Saída bloqueada':'Sem entrada';
  }
  private press(m: Machine): void {
    m.status = 'Sem entrada';
    for(let col=0;col<MODULE_SIZE;col++) {
      const p=globalCell(m,col,-1);if(this.world.get(p.x,p.y)!==Mat.Pellet)continue;
      const index=this.world.index(p.x,p.y);
      if (this.world.fall[index] < RECIPES.press.minimumFall) { m.status = 'Impacto fraco · mínimo 18 células'; continue; }
      if (this.energy.capacity - this.energy.value < ENERGY.impact) { m.status = 'Bateria cheia'; continue; }
      const out=globalCell(m,MODULE_SIZE,MODULE_CENTER);
      if (!this.empty(out.x, out.y)) { m.status = 'Saída bloqueada'; continue; }
      this.world.set(p.x, p.y, Mat.Air); this.emit(out.x, out.y, Mat.Shard);
      this.counters.impacts++; this.counters.energy += this.energy.add(ENERGY.impact);
      m.flash = 14; m.status = '+32 E · impacto';
    }
  }
  private vault(m: Machine): void {
    this.reject(m, [Mat.Crystal]);
    // Foreign grains inside the cavity physically occupy it until the player clears them.
    let count = 0;
    for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) if (this.world.get(x, y) === Mat.Crystal) count++;
    m.status = count >= (m.w - 2) * (m.h - 1) ? 'Cofre cheio' : count ? `${count} cristais armazenados` : 'Aguardando cristais';
  }
  countCrystals(): number {
    let count = this.crystals;
    for (const m of this.machines.filter(m => m.kind === 'vault')) for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) if (this.world.get(x, y) === Mat.Crystal) count++;
    return count;
  }
  spendCrystals(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0 || this.countCrystals() < amount) return false;
    const credit=Math.min(amount,this.crystals);this.crystals-=credit;let remaining = amount-credit;
    for (const m of this.machines.filter(m => m.kind === 'vault')) for (let y = m.y; y < m.y + m.h - 1; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) {
      if (remaining > 0 && this.world.get(x, y) === Mat.Crystal) { this.world.set(x, y, Mat.Air); remaining--; }
    }
    return true;
  }
}
