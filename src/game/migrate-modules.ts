import { Factory, MACHINE_DEFS, machineSolid, normalizeRotation, type Machine, type MachineKind } from '../sim/machines';
import { MODULE_SIZE, snapModule } from '../sim/module-geometry';
import { playerOverlaps } from './player';

/** Immutable dimensions of persisted versions 1–4. Never use current definitions here. */
const OLD:Record<MachineKind,[number,number]>={belt:[16,3],lift:[6,26],filter:[16,4],separator:[16,12],kiln:[14,12],crucible:[14,12],mist:[8,8],press:[16,4],crusher:[12,10],pump:[6,6],pipe:[4,4],valve:[4,4],vault:[16,14],sensor:[5,5],fastbelt:[16,3],sieve:[24,5],collector:[18,12],block:[4,4],platform:[16,2],wall:[2,16],funnel:[18,12],gate:[12,2],launcher:[10,6],drill:[12,8],heater:[14,10],hauler:[24,3],lamp:[6,8]};
export function legacySize(kind:MachineKind,rotation:number){const [w,h]=OLD[kind];return ['platform','wall','funnel','gate'].includes(kind)&&rotation%2?{w:h,h:w}:{w,h};}
export interface PendingModule {machine:Machine;source:{id:number;x:number;y:number;w:number;h:number};reason:string}
export function migrateModules(factory:Factory,old:Machine[],player:{x:number;y:number}) {
  const expandable=['belt','fastbelt','hauler','platform','wall','lift','pipe','sieve','filter','gate'];
  for(const source of old){
    const long=expandable.includes(source.kind),vertical=source.h>source.w,count=long?Math.ceil(Math.max(source.w,source.h)/MODULE_SIZE):1;
    const cost=MACHINE_DEFS[source.kind].cost;
    // Old flip pieces reverse along the horizontal face; new pieces use real turns.
    const wasQuarter=['mist','valve','platform','wall','funnel','gate'].includes(source.kind);
    const rotation=normalizeRotation(source.kind,wasQuarter?(source.kind==='mist'||source.kind==='valve'?(4-source.rotation)%4:source.rotation):source.rotation%2?2:0);
    for(let n=0;n<count;n++){
      const m:Machine={...source,w:MODULE_SIZE,h:MODULE_SIZE,x:snapModule(source.x)+(vertical?0:n*MODULE_SIZE),y:snapModule(source.y)+(vertical?n*MODULE_SIZE:0),rotation,id:n?factory.nextId++:source.id,stockCost:Math.floor(cost/count)+Number(n<cost%count)};
      m.x=Math.max(0,Math.min(factory.world.width-MODULE_SIZE,m.x));m.y=Math.max(0,Math.min(factory.world.height-MODULE_SIZE,m.y));
      if(n)delete m.buffer;
      const pending:PendingModule={machine:m,source:{id:source.id,x:source.x,y:source.y,w:source.w,h:source.h},reason:'Libere uma área e reposicione este módulo. O terreno e os grãos foram mantidos.'};
      if(factory.canPlace(m.kind,m.x,m.y,m.rotation)&&!playerOverlaps(player.x,player.y,(x,y)=>machineSolid(m,x,y)))factory.machines.push(m);else factory.pendingModules.push(pending);
    }
  }
}
