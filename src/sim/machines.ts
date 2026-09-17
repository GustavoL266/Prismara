import { Mat, MATERIALS } from './materials';
import { CHUNK_SIZE, World } from './world';
import { Energy, ENERGY } from './energy';
import { PipeSystem, isPipeMachine, type FluidBuffer } from './pipes';
import { updateSignals } from './signals';
import { REACTIONS } from './reactions';

export type MachineKind = 'belt' | 'lift' | 'filter' | 'separator' | 'kiln' | 'crucible' | 'mist' | 'press' | 'crusher' | 'pump' | 'pipe' | 'valve' | 'vault' | 'sensor' | 'fastbelt' | 'sieve' | 'collector' | 'block' | 'platform' | 'wall' | 'funnel' | 'gate' | 'launcher' | 'drill' | 'heater' | 'hauler';
export interface MachineDef { name: string; w: number; h: number; tier: number; cost: number; description: string; input: string; output: string; color: string; rotation?: 'none'|'flip'|'quarter'; category?: string; research?: string }
export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  belt: { name: 'Esteira de Placas', w: 16, h: 3, tier: 1, cost: 2, description: 'Carrega a camada em contato. Pilhas congestionam. R inverte.', input: 'Grãos sobre a superfície', output: 'Lateral', color: '#899096', category:'Transporte' },
  separator: { name: 'Tambor de Argila', w: 16, h: 12, tier: 2, cost: 8, research:'processing', description: 'Resíduo ou polpa → argila + 22% de quartzo adicional.', input: 'Resíduo ou polpa por cima', output: 'Argila lateral · quartzo embaixo', color: '#899096' },
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
  sieve:{name:'Peneira Vibratória',w:24,h:5,tier:1,cost:6,description:'Areia úmida → resíduo sobre a grelha + 25% de ouro abaixo. Sem energia.',input:'Areia úmida sobre a grelha',output:'Resíduo lateral · ouro inferior',color:'#D69B32',category:'Processamento'},
  collector:{name:'Coletor de Minérios',w:18,h:12,tier:1,cost:4,description:'Abertura superior. Ouro e cristais físicos são creditados uma única vez.',input:'Ouro ou cristal por cima',output:'Moedas de pesquisa',color:'#F3CF4C',rotation:'none',category:'Processamento'},
  block:{name:'Bloco Estrutural',w:4,h:4,tier:1,cost:1,description:'Suporte sólido. Arraste para construir.',input:'Contém grãos e líquidos',output:'—',color:'#899096',rotation:'none',category:'Estruturas'},
  platform:{name:'Plataforma',w:16,h:2,tier:1,cost:2,description:'Piso fino para conduzir a gravidade.',input:'Suporte físico',output:'—',color:'#899096',rotation:'quarter',category:'Estruturas'},
  wall:{name:'Parede de Contenção',w:2,h:16,tier:1,cost:2,description:'Fecha reservatórios e desvios. R gira de verdade.',input:'Contém líquidos',output:'—',color:'#899096',rotation:'quarter',category:'Estruturas'},
  funnel:{name:'Funil de Gravidade',w:18,h:12,tier:1,cost:3,description:'Paredes inclinadas concentram o fluxo numa garganta de quatro células.',input:'Abertura superior',output:'Garganta inferior',color:'#899096',rotation:'quarter',category:'Estruturas'},
  gate:{name:'Comporta',w:12,h:2,tier:1,cost:2,description:'Fechada contém materiais. Desligue para abrir. R gira.',input:'Reservatório acima',output:'Abertura controlada',color:'#D69B32',rotation:'quarter',category:'Estruturas'},
  launcher:{name:'Lançador de Impulso',w:10,h:6,tier:2,cost:5,research:'transport',description:'Lança o grão que toca o berço. Trajetória física com colisão.',input:'Grãos sobre o berço',output:'Boca na direção e força configuradas',color:'#D69B32',rotation:'flip',category:'Transporte'},
  drill:{name:'Sonda Escavadora',w:12,h:8,tier:4,cost:12,research:'automation',description:'Rompe depósitos abaixo de si. 0,15 E por célula liberada; nada vai à mochila.',input:'Terreno abaixo',output:'Grãos no mundo',color:'#D69B32',rotation:'none',category:'Automação'},
  heater:{name:'Câmara de Calcinação',w:14,h:10,tier:3,cost:8,research:'heat',description:'Resíduo + 0,6 E → resíduo calcinado quente.',input:'Resíduo por cima',output:'Calcinado pela lateral',color:'#d88854',category:'Processamento'},
  hauler:{name:'Transportador de Arraste',w:24,h:3,tier:4,cost:8,research:'automation',description:'Correia automatizada para sólidos e areia úmida. Duplo avanço.',input:'Grãos na superfície',output:'Lateral',color:'#D69B32',category:'Automação'},
};
for(const [kind,d] of Object.entries(MACHINE_DEFS)) {
  d.rotation??=['mist','valve'].includes(kind)?'quarter':['vault','sensor','pipe','pump'].includes(kind)?'none':'flip';
  d.category??=['pump','pipe','valve','mist'].includes(kind)?'Líquidos':['belt','lift','fastbelt','filter'].includes(kind)?'Transporte':['sensor'].includes(kind)?'Automação':'Processamento';
  d.research??=({kiln:'heat',press:'heat',crusher:'processing',crucible:'glass',mist:'glass',pump:'liquids',pipe:'liquids',valve:'liquids',filter:'transport',sensor:'automation',fastbelt:'transport',lift:'transport',vault:'glass'} as Record<string,string>)[kind];
}
export function normalizeRotation(kind:MachineKind,r:number):number {const mode=MACHINE_DEFS[kind].rotation;return mode==='none'?0:((r%(mode==='flip'?2:4))+(mode==='flip'?2:4))%(mode==='flip'?2:4);}
export function machineSize(kind:MachineKind,r=0):{w:number;h:number} {const d=MACHINE_DEFS[kind],rotate=d.rotation==='quarter'&&normalizeRotation(kind,r)%2;return {w:rotate?d.h:d.w,h:rotate?d.w:d.h};}
export function localCell(m:Machine,x:number,y:number):{x:number;y:number} {
  const d=MACHINE_DEFS[m.kind],xx=x-m.x,yy=y-m.y;
  if(d.rotation!=='quarter')return {x:xx,y:yy};
  return m.rotation===1?{x:yy,y:d.h-1-xx}:m.rotation===2?{x:d.w-1-xx,y:d.h-1-yy}:m.rotation===3?{x:d.w-1-yy,y:xx}:{x:xx,y:yy};
}
function globalCell(m:Machine,x:number,y:number):{x:number;y:number} {
  const d=MACHINE_DEFS[m.kind];
  return m.rotation===1?{x:m.x+d.h-1-y,y:m.y+x}:m.rotation===2?{x:m.x+d.w-1-x,y:m.y+d.h-1-y}:m.rotation===3?{x:m.x+y,y:m.y+d.w-1-x}:{x:m.x+x,y:m.y+y};
}
export function machineSolid(m:Machine,x:number,y:number):boolean {
  if(secondary(m.kind))return false;
  const p=localCell(m,x,y),d=MACHINE_DEFS[m.kind];
  if(m.kind==='gate')return m.enabled && m.signal!==false;
  if(['vault','collector'].includes(m.kind))return p.x===0||p.x===d.w-1||p.y===d.h-1;
  if(m.kind==='funnel'){const inset=Math.min(Math.floor(p.y/2),Math.floor(d.w/2)-3);return p.x===inset||p.x===d.w-1-inset;}
  if(m.kind==='lift')return p.x===0||p.x===d.w-1;
  return true;
}
export function machinePorts(m:Machine):{x:number;y:number;label:string}[] {
  const cx=m.x+Math.floor(m.w/2),side=m.rotation%2?m.x-1:m.x+m.w;
  if(['block','wall','platform','gate','sensor','pipe'].includes(m.kind))return [];
  const ports=[{...feedPoint(m),label:'Entrada'}];
  if(['sieve','separator','heater','kiln','press'].includes(m.kind))ports.push({x:side,y:m.kind==='sieve'?m.y-1:m.y+m.h-3,label:m.kind==='sieve'?'Resíduo':'Saída'});
  if(['sieve','separator','crucible','crusher','filter','collector'].includes(m.kind))ports.push({x:cx,y:m.y+m.h,label:m.kind==='sieve'?'Ouro':'Saída'});
  if(m.kind==='funnel')ports.push(outlet(m));
  if(['mist','valve'].includes(m.kind))ports.push(outlet(m));
  return ports;
}
export function outlet(m:Machine):{x:number;y:number;label:string} {
  if(m.kind==='funnel')return {...globalCell(m,Math.floor(MACHINE_DEFS.funnel.w/2),MACHINE_DEFS.funnel.h),label:'Saída'};
  const d=m.rotation;return {x:d===1?m.x+m.w:d===3?m.x-1:m.x+Math.floor(m.w/2),y:d===0?m.y+m.h:d===2?m.y-1:m.kind==='mist'?m.y:m.y+Math.floor(m.h/2),label:'Saída'};
}
export const RECIPES = {
  separator: { every: 5, quartzChance: REACTIONS.separator.bonusChance }, kiln: { every: 7, solarEvery: 40 },
  crucible: { every: 8, temperature: REACTIONS.melting.outputTemperature }, mist: { every: 1, temperature: -45 },
  press: { minimumFall: REACTIONS.piezo.minimumFall }, crusher: { every: 4, quartzChance: REACTIONS.crusher.quartzChance },
};
export interface Machine {
  id: number; kind: MachineKind; x: number; y: number; w: number; h: number; rotation: number;
  enabled: boolean; signal: boolean; status: string; filter: Mat; densityMin: number; densityMax: number;
  mode: 'material' | 'density'; targetId?: number; buffer?: FluidBuffer; flash: number;
  force?: number; angle?: number; interval?:number;
}
export function feedPoint(m: Machine): { x: number; y: number } {
  if(m.kind==='funnel')return globalCell(m,Math.floor(MACHINE_DEFS.funnel.w/2),-3);
  return { x: m.x + Math.floor(m.w / 2), y: m.kind === 'lift' ? m.y + m.h - 3 : m.y - 3 };
}
const granular = (m: Mat): boolean => ['granular','paste'].includes(MATERIALS[m].state);
export const secondary = (kind: MachineKind) => ['pipe', 'pump', 'valve', 'sensor'].includes(kind);

export class Factory {
  machines: Machine[] = [];
  energy = new Energy();
  nextId = 1;
  gold=0; crystals=0;
  private collisionSignature='';
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
            if(m.kind==='filter')for(const d of MATERIALS)if(m.mode==='material'?d.id===m.filter:d.density>=m.densityMin&&d.density<=m.densityMax)pass|=1<<d.id;
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
    Object.assign(m,size,{rotation:r});this.rebuildBlocks();this.wakeFootprint(m);return true;
  }
  setEnabled(id:number,enabled:boolean):boolean {
    const m=this.machines.find(m=>m.id===id);if(!m)return false;
    if(m.kind==='gate'&&enabled)for(let y=m.y;y<m.y+m.h;y++)for(let x=m.x;x<m.x+m.w;x++)if(this.world.get(x,y)!==Mat.Air){m.status='Comporta ocupada';return false;}
    m.enabled=enabled;this.rebuildBlocks();this.wakeFootprint(m);return true;
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
    const speed = ['fastbelt','hauler'].includes(m.kind) ? 2 : 1;
    if(m.kind==='sieve' && this.world.tick%REACTIONS.sieve.residueEvery)return;
    let moved = false, occupied = false;
    for (let t = 0; t < speed; t++) for (let n = 0; n < m.w; n++) {
      const x = direction > 0 ? m.x + m.w - 1 - n : m.x + n;
      const y = m.y - 1, material = this.world.get(x, y);
      if (!granular(material)) continue;
      occupied = true;
      const density = MATERIALS[material].density;
      const accepted = filter && (m.mode === 'material' ? material === m.filter : density >= m.densityMin && density <= m.densityMax);
      if (accepted) {
        // The grille allows accepted material to descend through its physical cells.
        if (this.world.get(x,m.y)===Mat.Air && this.world.accepts(x,m.y,material)) { this.world.swap(this.world.index(x,y),this.world.index(x,m.y)); moved=true; }
      } else if (this.empty(x + direction, y)) {
        this.world.swap(this.world.index(x, y), this.world.index(x + direction, y)); moved = true;
      }
    }
    m.status = moved ? 'Ativa' : occupied ? 'Saída bloqueada' : 'Sem entrada';
  }
  step(): void {
    updateSignals(this.world, this.machines);
    // A rising signal may close a gate only after its physical aperture is empty.
    for(const m of this.machines)if(m.kind==='gate'&&m.enabled&&m.signal){
      for(let y=m.y;y<m.y+m.h&&m.signal;y++)for(let x=m.x;x<m.x+m.w;x++)if(this.world.get(x,y)!==Mat.Air){m.signal=false;break;}
    }
    if(this.signature()!==this.collisionSignature){this.rebuildBlocks();for(const m of this.machines)this.wakeFootprint(m);}
    const tick = this.world.tick;
    for (const m of this.machines) {
      m.flash = Math.max(0, m.flash - 1);
      if (m.kind === 'sensor') continue;
      if(m.kind==='gate'){m.status=m.enabled&&m.signal?'Fechada':'Aberta';continue;}
      if (!m.enabled || !m.signal) { m.status = 'Desligada'; continue; }
      if (isPipeMachine(m)) continue;
      if (m.kind === 'vault') { this.vault(m); continue; }
      if (m.kind === 'collector') { this.collector(m);continue; }
      if (['block','platform','wall','funnel'].includes(m.kind)){m.status='Estrutura';continue;}
      if (m.kind==='sieve'){this.sieve(m);continue;}
      if (m.kind==='launcher'){this.launcher(m);continue;}
      if (m.kind==='drill'){this.drill(m);continue;}
      if (m.kind === 'belt' || m.kind === 'fastbelt' || m.kind === 'hauler' || m.kind === 'filter') { this.convey(m, m.kind === 'filter'); continue; }
      if (m.kind === 'lift') { this.lift(m); continue; }
      if (m.kind === 'press') { this.press(m); continue; }
      const cx = m.x + Math.floor(m.w / 2), sideX = m.rotation % 2 ? m.x - 1 : m.x + m.w;
      m.status = 'Sem entrada';
      if (m.kind === 'separator') {
        const input = this.input(m, Mat.Residue)??this.input(m, Mat.Pulp); if (!input) {this.reject(m,[Mat.Residue,Mat.Pulp]);continue;}
        if (!this.empty(sideX, m.y + m.h - 3) || !this.empty(cx, m.y + m.h)) { m.status = 'Saída bloqueada'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.separator.every) continue;
        this.world.set(input.x, input.y, Mat.Air); this.emit(sideX, m.y + m.h - 3, Mat.Clay);
        this.counters.pulp++; this.counters.clay++;
        if (this.world.rng() < RECIPES.separator.quartzChance) { this.emit(cx, m.y + m.h, Mat.Quartz); this.counters.quartz++; }
        m.flash = 6;
      } else if (m.kind === 'heater') {
        const input=this.input(m,Mat.Residue);if(!input)continue;
        if(!this.empty(sideX,m.y+m.h-3)){m.status='Saída bloqueada';continue;}
        if(this.energy.value<.6){m.status='Sem energia';continue;}m.status='Ativa';if(tick%8)continue;
        this.energy.spend(.6);this.world.set(input.x,input.y,Mat.Air);this.emit(sideX,m.y+m.h-3,Mat.Calcined,480);m.flash=8;
      } else if (m.kind === 'kiln') {
        const input = this.input(m, Mat.Clay); if (!input) {this.reject(m,[Mat.Clay]);continue;}
        if (!this.empty(sideX, m.y + m.h - 3)) { m.status = 'Saída bloqueada'; continue; }
        const solar = this.energy.value < ENERGY.kiln;
        m.status = solar ? 'Aquecimento solar' : 'Ativa';
        if (tick % (solar ? RECIPES.kiln.solarEvery : RECIPES.kiln.every)) continue;
        if (!solar) this.energy.spend(ENERGY.kiln);
        this.world.set(input.x, input.y, Mat.Air); this.emit(sideX, m.y + m.h - 3, Mat.Pellet, 180);
        this.counters.pellet++; m.flash = 10;
      } else if (m.kind === 'crucible') {
        const input = this.input(m, Mat.Quartz); if (!input) {this.reject(m,[Mat.Quartz]);continue;}
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
        const {x:ox,y:oy}=outlet(m);
        if (!this.empty(ox, oy)) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.mist) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.mist.every) continue;
        this.energy.spend(ENERGY.mist); this.world.set(input.x, input.y, Mat.Air);
        this.emit(ox, oy, Mat.Mist, RECIPES.mist.temperature); m.flash = 5;
      } else if (m.kind === 'crusher') {
        const shard = this.input(m, Mat.Shard), glass = this.input(m, Mat.Glass),cal=this.input(m,Mat.Calcined), input = shard ?? glass ?? cal;
        if (!input) { this.reject(m, [Mat.Shard, Mat.Glass,Mat.Calcined]); continue; }
        if (!this.empty(cx, m.y + m.h)) { m.status = 'Saída bloqueada'; continue; }
        if (this.energy.value < ENERGY.crush) { m.status = 'Sem energia'; continue; }
        m.status = 'Ativa'; if (tick % RECIPES.crusher.every) continue;
        this.energy.spend(ENERGY.crush); this.world.set(input.x, input.y, Mat.Air);
        this.emit(cx, m.y + m.h, cal?(this.world.rng()<.3?Mat.Quartz:Mat.Clay):!shard && this.world.rng() < RECIPES.crusher.quartzChance ? Mat.Quartz : Mat.Sand);
        this.counters.recycled++; m.flash = 4;
      }
    }
    this.pipes.step(this.machines);
    const stored = this.countCrystals(); this.counters.stored = Math.max(this.counters.stored, stored);
    this.counters.crystal = Math.max(this.counters.crystal, stored);
  }
  private sieve(m:Machine) {
    m.status='Sem entrada';let occupied=false,processed=false,blocked=false;
    for(let x=m.x+1;x<m.x+m.w-1;x++) {
      const mat=this.world.get(x,m.y-1);if(mat!==Mat.Air)occupied=true;
      if(mat!==Mat.WetSand)continue;
      // Reserve gold space before consuming a grain, even if this roll yields none.
      if(!this.empty(x,m.y+m.h)){blocked=true;continue;}
      if(this.world.tick%REACTIONS.sieve.every)continue;
      this.world.set(x,m.y-1,Mat.Residue);
      if(this.world.rng()<REACTIONS.sieve.goldChance){this.emit(x,m.y+m.h,Mat.Gold);this.counters.gold=(this.counters.gold??0)+1;}
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
    const p=this.input(m,input.id)!;const dir=m.rotation%2?-1:1;
    if(!this.empty(p.x,p.y-1)){m.status='Saída bloqueada';return;}
    this.world.swap(this.world.index(p.x,p.y),this.world.index(p.x,p.y-1));
    const angle=(m.angle??35)*Math.PI/180,force=m.force??5;
    this.world.launch(p.x,p.y-1,Math.cos(angle)*force*dir,-Math.sin(angle)*force);m.flash=4;m.status='Ativa';
  }
  private drill(m:Machine) {
    if(this.world.tick%20)return;m.status='Sem depósito';
    // Work from the underside, releasing one cell into the same physical world.
    for(let y=Math.min(this.world.height-1,m.y+m.h+27);y>=m.y+m.h;y--)for(let x=m.x+1;x<m.x+m.w-1;x++) {
      const i=this.world.index(x,y),mat=this.world.get(x,y);
      if(this.world.blocked[i])continue;
      if(!this.world.consolidated[i]&&MATERIALS[mat].state!=='terrain')continue;
      if(this.world.get(x,y+1)!==Mat.Air && this.world.consolidated[this.world.index(x,y+1)])continue;
      if(this.energy.value<.15){m.status='Sem energia';return;}
      if(this.world.excavate(x,y)){this.energy.spend(.15);m.status='Ativa';m.flash=5;this.counters.mined=(this.counters.mined??0)+1;return;}
    }
  }
  private reject(m: Machine, accepts: Mat[]): void {
    const direction=m.rotation%2?1:-1;let found=false;
    for (let n=1;n<m.w-1;n++) {
      const x=direction<0?m.x+n:m.x+m.w-1-n;
      const material = this.world.get(x, m.y - 1);
      if (material === Mat.Air || accepts.includes(material)) continue;
      found=true;
      if (this.empty(x+direction,m.y-1)) {
        this.world.swap(this.world.index(x,m.y-1),this.world.index(x+direction,m.y-1));m.status='Material rejeitado';
      }
    }
    if(found&&m.status!=='Material rejeitado')m.status='Entrada incompatível';
  }
  private lift(m: Machine): void {
    let moved = false, occupied = false;
    const direction = m.rotation % 2 ? -1 : 1;
    // Snapshot prevents a grain being carried repeatedly in the same tick.
    for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x + 1; x < m.x + m.w - 1; x++) {
      if (!granular(this.world.get(x, y))) continue;
      occupied = true;
      const ty=y===m.y?y-1:y-2;
      if (this.empty(x,y-1)&&this.empty(x,ty)) {
        this.world.swap(this.world.index(x,y),this.world.index(x,ty));this.world.fall[this.world.index(x,ty)]=0;moved=true;
        if(y===m.y)this.world.launch(x,ty,direction*2,-1);
      }
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
