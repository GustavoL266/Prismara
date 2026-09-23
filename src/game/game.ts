import {snapModule,MODULE_SIZE,rotateVector} from '../sim/module-geometry';
import { emptyLoad, pickLoad, dropLoad, storeLoad, type ManualLoad } from './manipulator';
import { World, SIMULATION_HZ } from '../sim/world';
import { Mat, materials } from '../sim/materials';
import { generateTerrain, WORLD_WIDTH, WORLD_HEIGHT, spawnPoint, regionAt, REGION_NAMES, chambers } from '../sim/terrain';
import { Factory, MACHINE_DEFS, feedPoint, machineSolid, machineSize, secondary, normalizeRotation, type MachineKind, type Machine } from '../sim/machines';
import { Renderer } from '../render/renderer';
import { Player, playerOverlaps } from './player';
import { Input, actionFor } from './input';
import { AudioSystem } from './audio';
import { deserialize, serialize, serializeAsync, readSave, writeSave, readMigrationBackup, type Progress, type Preferences } from './save';
import { MISSIONS, RESEARCH, type MissionContext } from './progression';
import { UI } from '../ui/ui';
import { Exploration, LAMP_DISCOVERY_RADIUS } from './exploration';

export type Tool='dig'|'collect'|'pour'|'build'|'select'|'thermal'|'vacuum';
export type Panel='start'|'build'|'research'|'upgrades'|'help'|'inventory'|'pause'|'new'|'won'|null;
export const TOOL_NAMES={dig:'Escavar',collect:'Manipular',vacuum:'Aspirador',pour:'Despejar',build:'Construir',select:'Selecionar',thermal:'Lança térmica'};
export const FEED_MATERIAL:Partial<Record<MachineKind,Mat>>={sieve:Mat.WetSand,collector:Mat.Gold,separator:Mat.Residue,kiln:Mat.Clay,heater:Mat.Residue,crucible:Mat.Quartz,mist:Mat.Water,press:Mat.Pellet,vault:Mat.Crystal,crusher:Mat.Calcined,pump:Mat.Water,lift:Mat.Pellet,belt:Mat.Sand,fastbelt:Mat.Sand,launcher:Mat.Sand};
export interface Area {x:number;y:number;endX:number;endY:number;remove:boolean}
export interface Blueprint {sourceId?:number;kind:MachineKind;dx:number;dy:number;rotation:number;config:Partial<Machine>}
const initialProgress=():Progress=>({mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0,researched:[],discovered:[0],solved:[],visited:[],chamberFeed:0});
export class Game {
  world=new World();factory=new Factory(this.world);player=new Player();
  exploration=new Exploration(this.world);
  inventory=Array(materials.length).fill(0) as number[];
  progress:Progress=initialProgress();
  preferences:Preferences={volume:.18,shake:false,zoom:3,uiScale:1};
  renderer:Renderer;input:Input;audio=new AudioSystem();ui:UI;
  manualLoad:ManualLoad=emptyLoad();
  tool:Tool='dig';material:Mat=Mat.Sand;building:MachineKind='sieve';rotation=0;selectedId=0;panel:Panel='start';
  started=false;hasSave=false;time=0;fps=60;saveLabel='Salvamento local';
  simulationMs=0;renderMs=0;maxSimulationMs=0;saveMs=0;
  area?:Area;selection=new Set<number>();clipboard:Blueprint[]=[];pasteGroup=false;
  private last=0;private accumulator=0;private lastUI=0;private lastAutosave=0;private usedClick=false;private toastUntil=0;
  private feeds:{id:number;material:Mat;remaining:number}[]=[];private mining=new Map<number,number>();
  pendingModuleId=0;private migrationBackup?:string;
  private lastBuild?:{x:number;y:number};private saving=Promise.resolve();
  constructor(){
    this.ui=new UI(this);this.renderer=new Renderer(document.querySelector('#world')!,document.querySelector('#minimap')!);
    this.renderer.camera.zoom=this.preferences.zoom;
    this.input=new Input(this.renderer.canvas);this.input.onAction=code=>this.key(code);
    this.input.onPrimary=(pressed,x,y)=>{
      if(this.paused||!this.started||this.tool!=='collect')return;
      const p=this.renderer.worldPoint(x,y);
      if(pressed){if(!this.manualLoad.pixels.length)pickLoad(this,this.manualLoad,p.x,p.y);}
      else {const n=dropLoad(this,this.manualLoad,p.x,p.y);if(this.manualLoad.pixels.length)this.toast(n?'Parte depositada; o restante continua na ferramenta.':'Destino bloqueado. A carga continua na ferramenta.');}
      this.ui.update();void this.save(false);
    };
    this.input.onZoom=amount=>{this.renderer.camera.zoom=Math.max(2,Math.min(6,Math.round((this.renderer.camera.zoom+amount)*1)));this.preferences.zoom=this.renderer.camera.zoom;};
    this.input.onPan=(x,y)=>{this.renderer.follow=false;this.renderer.camera.x-=x/this.renderer.camera.zoom;this.renderer.camera.y-=y/this.renderer.camera.zoom;};
    generateTerrain(this.world);Object.assign(this.player,spawnPoint(this.world));
    this.exploration.revealSurface();this.exploration.update(this.player.x,this.player.y,[],true);
    readSave().then(raw=>{this.hasSave=!!raw;if(this.panel==='start')this.ui.showPanel();}).catch(()=>this.saveLabel='Armazenamento indisponível');
    this.ui.showPanel();this.ui.update();
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started){void this.save(false);this.input.release();this.last=0;}});
    window.addEventListener('pagehide',()=>{if(this.started)void this.save(false);});
    requestAnimationFrame(t=>this.frame(t));
  }
  get paused(){return this.panel!==null||document.hidden;}
  hasResearch(id:string){return this.progress.researched?.includes(id)??false;}
  get reach(){return 70+Number(this.hasResearch('tools'))*25+Number(this.hasResearch('capacity'))*25;}
  get capacity(){return 400+Number(this.hasResearch('tools'))*200+Number(this.hasResearch('capacity'))*600;}
  get strength(){return 1+Number(this.hasResearch('tools'))+Number(this.hasResearch('propulsion'))*2;}
  get carried(){return this.inventory.reduce((a,b)=>a+b,0);}
  unlocked(kind:MachineKind){const id=MACHINE_DEFS[kind].research;return !id||this.hasResearch(id);}
  newWorld(seed=(Date.now()%1000000)+1){
    this.world=new World(WORLD_WIDTH,WORLD_HEIGHT,seed);generateTerrain(this.world);
    this.factory=new Factory(this.world);this.player=new Player();Object.assign(this.player,spawnPoint(this.world));
    this.exploration=new Exploration(this.world);this.exploration.revealSurface();this.exploration.update(this.player.x,this.player.y,[],true);
    this.pendingModuleId=0;this.migrationBackup=undefined;this.manualLoad=emptyLoad();this.inventory=Array(materials.length).fill(0);this.inventory[Mat.Sand]=48;
    this.progress=initialProgress();this.feeds=[];this.mining.clear();this.lastAutosave=0;this.selectedId=0;this.tool='dig';this.material=Mat.Sand;
    this.selection.clear();this.area=undefined;this.clipboard=[];this.pasteGroup=false;
    this.renderer.camera.x=this.player.x+45;this.renderer.camera.y=this.player.y-35;this.renderer.follow=true;
    this.started=true;this.setPanel(null);void this.save(false);this.toast('Planície Âmbar descoberta. [1] libera grãos; [2] transporta porções. Leve areia ao bolsão de água à direita.');
  }
  async continueWorld(){
    try{const raw=await readSave();if(!raw)throw new Error('Nenhum mundo salvo.');this.restore(raw);this.toast('Expedição restaurada. Fábrica, grãos e pesquisas preservados.');}
    catch(error){this.toast('Não foi possível restaurar: '+(error as Error).message);}
  }
  restore(raw:string){
    const restored=deserialize(raw);this.migrationBackup=JSON.parse(raw).version<5?raw:undefined;
    Object.assign(this,restored);this.progress.researched??=[];this.progress.discovered??=[0];this.progress.solved??=[];this.progress.visited??=[];this.progress.chamberFeed??=0;
    this.started=true;this.tool='dig';this.pendingModuleId=0;this.feeds=[];this.mining.clear();this.selectedId=0;this.selection.clear();this.area=undefined;this.pasteGroup=false;
    this.renderer.camera.x=this.player.x+40;this.renderer.camera.y=this.player.y-30;this.renderer.camera.zoom=this.preferences.zoom;this.renderer.follow=true;this.renderer.invalidate();
    this.audio.volume=this.preferences.volume;this.setPanel(null);
  }
  async save(notify=true):Promise<boolean>{
    if(!this.started)return false;
    const start=performance.now(),backup=this.migrationBackup;this.saveLabel='Salvando…';let raw:string;
    try{raw=await serializeAsync(this);}catch{this.saveLabel='Falha ao comprimir — exporte a partida';return false;}
    this.saveMs=performance.now()-start;
    let success=true;
    this.saving=this.saving.catch(()=>{}).then(()=>writeSave(raw,backup)).then(()=>{this.migrationBackup=undefined;this.hasSave=true;this.saveLabel='Salvo neste navegador';if(notify)this.toast('Partida salva.');}).catch(()=>{success=false;this.saveLabel='Falha ao salvar — exporte a partida';if(notify)this.toast('Falha no armazenamento. Exporte a partida pelo menu de pausa.');});
    await this.saving;return success;
  }
  async exportMigrationBackup(){const raw=await readMigrationBackup();if(!raw){this.toast('Nenhuma migração local guardada.');return;}this.downloadSave(raw,'Prismara-antes-dos-modulos.prismara');}
  private downloadSave(raw:string,name:string){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  exportSave(){
    const blob=new Blob([serialize(this)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Prismara-'+this.world.seed+'.prismara';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.toast('Partida exportada.');
  }
  async importSave(file:File){try{if(file.size>30_000_000)throw new Error('Arquivo grande demais.');const raw=await file.text();deserialize(raw);this.restore(raw);await this.save(false);this.toast('Partida importada e validada.');}catch(e){this.toast('Importação recusada: '+(e as Error).message);}}
  setPanel(panel:Panel){this.panel=panel;this.input?.release();this.area=undefined;this.lastBuild=undefined;this.ui.showPanel();this.ui.update();}
  toolAvailable(tool:Tool){return tool==='vacuum'?this.hasResearch('vacuum'):tool==='thermal'?this.hasResearch('thermal'):true;}
  storeManualLoad(){const n=storeLoad(this.manualLoad,this.inventory,this.capacity);this.toast(n?n+' células guardadas na mochila.':'Carga vazia ou mochila cheia.');this.ui.update();void this.save(false);}
  selectTool(tool:Tool){if(!this.toolAvailable(tool)){this.toast(tool==='vacuum'?'Pesquise Rotor de Coleta para equipar o aspirador.':'Pesquise Lança Térmica.');return;}this.input.release();if(tool==='thermal'&&!this.hasResearch('thermal')){this.toast('Pesquise Lança Térmica.');return;}this.tool=tool;this.pendingModuleId=0;this.pasteGroup=false;this.selectedId=0;this.ui.update();this.audio.play('click');}
  selectPendingModule(id:number){const p=this.factory.pendingModules.find(p=>p.machine.id===id);if(!p)return;this.pendingModuleId=id;this.building=p.machine.kind;this.rotation=p.machine.rotation;this.tool='build';this.pasteGroup=false;this.selectedId=0;this.setPanel(null);this.toast('Clique numa área livre para reposicionar sem custo.');}
  selectBuild(kind:MachineKind){
    this.pendingModuleId=0;
    if(!this.unlocked(kind)){this.toast('Pesquise '+RESEARCH.find(r=>r.id===MACHINE_DEFS[kind].research)?.name+'.');return;}
    this.building=kind;this.tool='build';this.rotation=0;this.selectedId=0;this.pasteGroup=false;this.setPanel(null);
  }
  selectMaterial(mat:Mat){this.material=mat;this.tool='pour';this.setPanel(null);}
  private key(code:string){
    const action=actionFor(code);
    if(action==='pause'){this.setPanel(this.panel===null?'pause':this.started?null:'start');return;}
    if(this.panel){if(action===this.panel)this.setPanel(null);return;}
    const tools:Record<string,Tool>={dig:'dig',collect:'collect',pour:'pour',buildTool:'build',select:'select',thermal:'thermal',vacuum:'vacuum'};
    if(action&&tools[action])this.selectTool(tools[action]);
    if(['build','research','help','inventory','upgrades'].includes(action??''))this.setPanel(action as Panel);
    if(action==='map')this.ui.toggleMap(true);if(action==='minimap')this.ui.toggleMap();
    if(action==='follow'){this.renderer.follow=true;this.toast('Câmera acompanhando o explorador.');}
    if(action==='rotate'){if(this.selectedId)this.rotateSelected();else this.rotation=normalizeRotation(this.building,this.rotation+1);this.ui.update(true);}
    if(action==='storeLoad')this.storeManualLoad();
    if(action==='copy')this.copySelection();if(action==='paste'){if(this.clipboard.length){this.pasteGroup=true;this.tool='build';this.selectedId=0;this.building=this.clipboard[0].kind;this.toast('Clique para copiar o conjunto; botão direito cancela.');}}
    if(action==='previous'||action==='next'){
      const dir=action==='next'?1:-1;
      if(this.tool==='build'){const kinds=(Object.keys(MACHINE_DEFS) as MachineKind[]).filter(k=>this.unlocked(k));this.building=kinds[(kinds.indexOf(this.building)+dir+kinds.length)%kinds.length];this.rotation=0;this.pasteGroup=false;}
      else{const all=materials.filter(m=>m.transportable&&m.state!=='gas').map(m=>m.id);this.material=all[(all.indexOf(this.material)+dir+all.length)%all.length];}this.ui.update();
    }
    if(action==='delete')for(const id of this.selection.size?[...this.selection]:[this.selectedId])this.removeMachine(id);
  }
  rotateSelected(){const m=this.selectedMachine();if(m&&playerOverlaps(this.player.x,this.player.y,(x,y)=>machineSolid({...m,rotation:normalizeRotation(m.kind,m.rotation+1)},x,y))){this.toast('Afaste-se da parte sólida antes de girar.');return;}if(this.selectedId&&!this.factory.rotate(this.selectedId))this.toast('Rotação bloqueada: libere a nova geometria.');this.ui.update(true);}
  private frame(now:number){
    const dt=this.last?Math.min(.1,(now-this.last)/1000):1/60;this.last=now;this.fps+=(1/dt-this.fps)*.03;this.time+=dt;
    if(!this.paused){this.accumulator+=dt;let steps=0;while(this.accumulator>=1/SIMULATION_HZ&&steps<3){this.step();this.accumulator-=1/SIMULATION_HZ;steps++;}}else this.accumulator=0;
    const start=performance.now(),pointer=this.renderer.worldPoint(this.input.mouseX,this.input.mouseY);
    if(!this.exploration.matches(this.world)){this.exploration=new Exploration(this.world);this.exploration.revealSurface();this.exploration.update(this.player.x,this.player.y,[],true);}
    this.renderer.render({world:this.world,exploration:this.exploration,factory:this.factory,player:this.player,time:this.time,pointer,tool:this.started&&this.panel===null&&this.input.overWorld?this.tool:'none',building:this.building,rotation:this.rotation,selectedId:this.selectedId,paused:this.paused,shake:this.preferences.shake,won:this.progress.won,area:this.area,selection:this.selection,blueprint:this.pasteGroup?this.clipboard:[],dragging:this.input.left||this.input.right,manualLoad:this.manualLoad,reach:this.reach},dt);
    this.renderMs+=(performance.now()-start-this.renderMs)*.08;
    if(this.time-this.lastUI>.15){this.ui.update();this.lastUI=this.time;}
    if(this.started&&!this.paused&&this.progress.elapsed-this.lastAutosave>25){void this.save(false);this.lastAutosave=this.progress.elapsed;}
    if(this.time>this.toastUntil)document.querySelector('#toast')?.classList.remove('show');
    requestAnimationFrame(t=>this.frame(t));
  }
  step(){
    const start=performance.now();this.progress.elapsed+=1/SIMULATION_HZ;
    this.player.propulsion=Number(this.hasResearch('exploration'))+Number(this.hasResearch('propulsion'))*2;
    this.player.update(this.world,this.input.keys,1/SIMULATION_HZ);this.interact();this.feedStep();
    const impacts=this.factory.counters.impacts;this.factory.step();this.world.step();
    if(!this.exploration.matches(this.world))this.exploration=new Exploration(this.world);
    this.exploration.update(this.player.x,this.player.y,this.factory.machines.filter(m=>m.kind==='lamp'&&m.enabled&&m.signal&&m.status==='Ativa').map(m=>({id:m.id,x:m.x+3,y:m.y+3,radius:LAMP_DISCOVERY_RADIUS})));
    if(this.factory.counters.impacts>impacts)this.audio.play('impact');
    if(this.world.tick%15===0)this.updateProgress();
    const elapsed=performance.now()-start;this.simulationMs+=(elapsed-this.simulationMs)*.08;this.maxSimulationMs=Math.max(this.maxSimulationMs,elapsed);
  }
  updateProgress(){
    this.progress.mixed=Math.max(this.progress.mixed,this.world.reactionCounts.wet??0);
    this.progress.crystalsMade=Math.max(this.progress.crystalsMade,this.world.reactionCounts.crystal??0);
    const region=regionAt(this.world,this.player.x,this.player.y);
    if(!this.progress.discovered!.includes(region)){this.progress.discovered!.push(region);this.toast(REGION_NAMES[region]+' descoberta.');this.audio.play('research');}
    for(const c of chambers(this.world)){
      if(this.exploration.points.includes(c.id)&&!this.progress.visited!.includes(c.id)){this.progress.visited!.push(c.id);this.toast(c.name+' encontrado. '+({drain:'Drene a sala para revelar o arquivo.',thaw:'Derreta a barreira de gelo.',feed:'Faça 12 pelotas chegarem à plataforma central.'} as Record<string,string>)[c.id]);}
      if(this.progress.solved!.includes(c.id)||!this.progress.visited!.includes(c.id))continue;
      let water=0,ice=0;
      for(let y=c.y-42;y<c.y;y++)for(let x=c.x-35;x<c.x+36;x++){
        const mat=this.world.get(x,y);if(mat===Mat.Water)water++;if(mat===Mat.Ice)ice++;
        const support=this.world.get(x,y+1);
        if(c.id==='feed'&&mat===Mat.Pellet&&x>=c.x-5&&x<=c.x+5&&y>=c.y-8&&support!==Mat.Air&&support!==Mat.Water&&(this.progress.chamberFeed??0)<12){this.world.set(x,y,Mat.Shard);this.progress.chamberFeed!++;}
      }
      const solved=c.id==='drain'?water<10:c.id==='thaw'?ice===0:this.progress.chamberFeed!>=12;
      if(solved){this.progress.solved!.push(c.id);this.progress.ruins=true;this.toast(c.name+' resolvido. Registro recuperado.');this.audio.play('research');}
    }
    let advanced=false;const context=this.context();
    while(this.progress.mission<MISSIONS.length&&MISSIONS[this.progress.mission].value(context)>=MISSIONS[this.progress.mission].goal){this.progress.mission++;advanced=true;}
    if(advanced){this.audio.play('research');this.toast(this.progress.mission<MISSIONS.length?'Próximo objetivo: '+MISSIONS[this.progress.mission].title:'Arquivos conectados. Continue expandindo sua fábrica.');}
  }
  context():MissionContext{return {mined:this.progress.mined+(this.factory.counters.mined??0),wet:this.progress.mixed,gold:this.factory.counters.collectedGold??0,stored:this.factory.counters.stored,machines:this.factory.machines.length,research:this.progress.researched!.length,discovered:this.progress.discovered!.length,challenges:this.progress.solved!.length,won:this.progress.won};}
  selectedMachine(){return this.factory.machines.find(m=>m.id===this.selectedId&&this.exploration.knows(m.x,m.y));}
  machineAt(x:number,y:number){if(!this.exploration.knows(x,y))return undefined;return [...this.factory.machines].reverse().find(m=>x>=m.x&&x<m.x+m.w&&y>=m.y&&y<m.y+m.h);}
  private finishArea(){
    if(!this.area)return;
    const a=this.area,minX=Math.min(a.x,a.endX),maxX=Math.max(a.x,a.endX),minY=Math.min(a.y,a.endY),maxY=Math.max(a.y,a.endY);
    const ids=this.factory.machines.filter(m=>this.exploration.knows(m.x,m.y)&&m.x<maxX+1&&m.x+m.w>minX&&m.y<maxY+1&&m.y+m.h>minY).map(m=>m.id);
    if(a.remove)for(const id of ids)this.removeMachine(id);else{this.selection=new Set(ids);this.selectedId=ids[0]??0;this.toast(ids.length+' peças selecionadas. [C] copia; [V] constrói a cópia.');}
    this.area=undefined;this.ui.update(true);
  }
  private interact(){
    if(this.tool==='collect')return;
    const {left,right}=this.input,point=this.renderer.worldPoint(this.input.mouseX,this.input.mouseY);
    if(!left&&!right){this.finishArea();this.usedClick=false;this.lastBuild=undefined;return;}
    if(!this.input.overWorld&&!this.area){this.lastBuild=undefined;return;}
    if(!this.exploration.knows(point.x,point.y)){this.usedClick=true;return;}
    if(this.area){this.area.endX=point.x;this.area.endY=point.y;return;}
    if((right&&this.input.keys.has('ShiftLeft'))||(left&&this.tool==='select')){
      this.area={x:point.x,y:point.y,endX:point.x,endY:point.y,remove:right};return;
    }
    const m=this.machineAt(point.x,point.y);
    if(right){if(this.pasteGroup){this.pasteGroup=false;this.clipboard=[];}else if(m&&!this.usedClick)this.removeMachine(m.id);this.usedClick=true;return;}
    if(this.tool==='build'){
      const x=snapModule(point.x),y=snapModule(point.y);
      const buildHit=[...this.factory.machines].reverse().find(o=>secondary(o.kind)===secondary(this.building)&&point.x>=o.x&&point.x<o.x+o.w&&point.y>=o.y&&point.y<o.y+o.h);
      if(!this.lastBuild||x!==this.lastBuild.x||y!==this.lastBuild.y){
        if(this.pasteGroup){if(!this.usedClick)this.placeSet(x,y);this.usedClick=true;}
        else if(!buildHit){
          const previous=this.lastBuild,steps=previous?Math.ceil(Math.max(Math.abs(x-previous.x),Math.abs(y-previous.y))/MODULE_SIZE):1;
          for(let n=1;n<=steps;n++){const xx=previous?snapModule(previous.x+(x-previous.x)*n/steps):x,yy=previous?snapModule(previous.y+(y-previous.y)*n/steps):y;
            if(this.factory.canPlace(this.building,xx,yy,this.rotation))this.place(this.building,xx,yy,this.rotation,false);
          }
        }else if(!this.usedClick){this.selectedId=buildHit.id;this.ui.update(true);}
        this.lastBuild={x,y};
      }return;
    }
    if(m&&this.tool!=='pour'&&this.tool!=='thermal'){if(!this.usedClick){this.selectedId=m.id;this.selection=new Set([m.id]);this.usedClick=true;this.ui.update(true);}return;}
    this.selectedId=0;
    if(Math.hypot(point.x-this.player.x,point.y-this.player.y)>this.reach){if(!this.usedClick)this.toast('Alcance da ferramenta: '+this.reach+' células. Aproxime-se.');this.usedClick=true;return;}
    if(this.world.tick%2)return;
    if(this.tool==='pour'){
      const count=Math.min(4,this.inventory[this.material]);if(!count){if(!this.usedClick)this.toast('Material ausente. [2] pega; [G] guarda; [I] escolhe o estoque.');this.usedClick=true;return;}
      const emitted=this.world.emit(point.x,point.y,this.material,count);this.inventory[this.material]-=emitted;if(emitted)this.audio.play(this.material===Mat.Water?'water':'dig');return;
    }
    let changed=0;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      if(dx*dx+dy*dy>10)continue;const x=point.x+dx,y=point.y+dy;
      if(!this.world.inBounds(x,y))continue;const i=this.world.index(x,y),mat=this.world.cells[i],def=materials[mat];
      if(mat===Mat.Air||this.world.blocked[i])continue;
      if(this.tool==='thermal'){
        if(this.factory.energy.spend(.035)){this.world.temperature[i]=Math.min(1200,this.world.temperature[i]+85);this.world.markDirty(x,y);changed++;}continue;
      }
      if(this.tool==='vacuum'){
        if(!this.hasResearch('vacuum'))continue;
        if((this.input.keys.has('ShiftLeft')||this.input.keys.has('ShiftRight'))&&mat!==this.material)continue;
        if(!def.transportable||def.state==='gas'||this.world.consolidated[i]||this.carried>=this.capacity)continue;
        this.inventory[mat]++;this.world.set(x,y,Mat.Air);changed++;continue;
      }
      if(this.tool!=='dig'||(!this.world.consolidated[i]&&def.state!=='terrain'))continue;
      const damage=(this.mining.get(i)??0)+this.strength;
      if(damage<def.resistance){if(this.mining.size>500)this.mining.clear();this.mining.set(i,damage);continue;}this.mining.delete(i);
      if(this.world.excavate(x,y)){this.progress.mined++;changed++;}
    }
    if(changed){this.renderer.burst(point.x,point.y,this.tool==='thermal'?3:0,Math.min(changed,8));this.audio.play('dig');}
  }
  place(kind:MachineKind,x:number,y:number,rotation=0,notify=true){
    const d=MACHINE_DEFS[kind],size=machineSize(kind,rotation);
    if(!this.exploration.footprint(x,y,size.w,size.h)){if(notify)this.toast('Explore toda a área antes de construir.');return null;}
    if(!this.pendingModuleId&&!this.unlocked(kind)){if(notify)this.toast('Pesquisa necessária.');return null;}
    if(!this.pendingModuleId&&this.inventory[Mat.Sand]<d.cost){if(notify)this.toast('Faltam '+(d.cost-this.inventory[Mat.Sand])+' grãos de areia.');return null;}
    const p=this.player;
    const probe={kind,x,y,...size,rotation:normalizeRotation(kind,rotation),enabled:true,signal:true} as Machine;
    if(playerOverlaps(p.x,p.y,(xx,yy)=>machineSolid(probe,xx,yy)))return null;
    if(this.pendingModuleId){const m=this.factory.restorePending(this.pendingModuleId,x,y,rotation);if(m){this.pendingModuleId=0;this.selectTool('select');this.toast('Módulo e conteúdo recuperados.');}return m;}
    const m=this.factory.add(kind,x,y,rotation);if(!m){if(notify)this.toast('Posição ocupada.');return null;}
    this.inventory[Mat.Sand]-=d.cost;this.audio.play('build');this.ui.update();return m;
  }
  removeMachine(id:number){const m=this.factory.machines.find(m=>m.id===id);if(!m)return;
    if(this.factory.remove(id)){this.inventory[Mat.Sand]+=m.stockCost??MACHINE_DEFS[m.kind].cost;this.selectedId=0;this.selection.delete(id);this.feeds=this.feeds.filter(f=>f.id!==id);this.audio.play('build');}
    else this.toast('Libere espaço para drenar o conteúdo dos tubos.');this.ui.update(true);
  }
  copySelection(){
    const all=this.factory.machines.filter(m=>this.selection.has(m.id)||m.id===this.selectedId);if(!all.length)return;
    const minX=Math.min(...all.map(m=>m.x)),minY=Math.min(...all.map(m=>m.y));
    this.clipboard=all.map(m=>({sourceId:m.id,kind:m.kind,dx:m.x-minX,dy:m.y-minY,rotation:m.rotation,config:{enabled:m.enabled,filter:m.filter,mode:m.mode,densityMin:m.densityMin,densityMax:m.densityMax,force:m.force,angle:m.angle,interval:m.interval,targetId:m.targetId}}));
    this.toast(all.length+' configurações copiadas. [V] posiciona o conjunto.');
  }
  pasteConfig(){
    const m=this.selectedMachine(),copy=this.clipboard[0];if(m&&copy){
      if(m.kind==='gate'&&copy.config.enabled&&!this.factory.setEnabled(m.id,true)){this.toast('Libere a comporta antes de fechar.');return;}
      Object.assign(m,copy.config);this.factory.rebuildBlocks();this.ui.update(true);this.toast('Configuração aplicada.');
    }
  }
  placeSet(x:number,y:number){
    const cost=this.clipboard.reduce((s,b)=>s+MACHINE_DEFS[b.kind].cost,0);
    if(this.inventory[Mat.Sand]<cost||this.clipboard.some(b=>!this.unlocked(b.kind)||!this.factory.canPlace(b.kind,x+b.dx,y+b.dy,b.rotation))){this.toast('Conjunto bloqueado ou areia insuficiente.');return;}
    const added:Machine[]=[],idMap=new Map<number,number>();
    for(const b of this.clipboard){const m=this.place(b.kind,x+b.dx,y+b.dy,b.rotation,false);if(!m){for(const a of added)this.removeMachine(a.id);return;}Object.assign(m,b.config);added.push(m);if(b.sourceId)idMap.set(b.sourceId,m.id);}
    for(const m of added)if(m.targetId)m.targetId=idMap.get(m.targetId)??m.targetId;
    this.factory.rebuildBlocks();this.toast(added.length+' peças construídas.');
  }
  queueFeed(id:number,material?:Mat){
    const m=this.factory.machines.find(m=>m.id===id);if(!m)return;const p=feedPoint(m);
    if(Math.hypot(p.x-this.player.x,p.y-this.player.y)>this.reach){this.toast('Alimentação exige proximidade da ferramenta.');return;}
    const mat=material??FEED_MATERIAL[m.kind]??this.material,remaining=Math.min(16,this.inventory[mat]);
    if(!remaining){this.toast('Colete '+materials[mat].name+'.');return;}
    if(!this.feeds.some(f=>f.id===id))this.feeds.push({id,material:mat,remaining});
  }
  private feedStep(){
    if(this.world.tick%3)return;
    for(const feed of this.feeds){
      const m=this.factory.machines.find(m=>m.id===feed.id);if(!m||!this.inventory[feed.material]){feed.remaining=0;continue;}
      const p=feedPoint(m);if(Math.hypot(p.x-this.player.x,p.y-this.player.y)>this.reach){feed.remaining=0;continue;}
      for(const offset of [0,-1,1,-2,2]){const d=rotateVector(m.rotation,offset,0),x=p.x+d.x,y=p.y+d.y;if(this.world.get(x,y)===Mat.Air&&this.world.accepts(x,y,feed.material)){this.world.set(x,y,feed.material);this.inventory[feed.material]--;feed.remaining--;break;}}
    }
    this.feeds=this.feeds.filter(f=>f.remaining>0);
  }
  isFeeding(id:number){return this.feeds.find(f=>f.id===id)?.remaining??0;}
  canResearch(id:string){
    const r=RESEARCH.find(r=>r.id===id);
    return !!r&&!this.hasResearch(id)&&r.requires.every(d=>this.hasResearch(d))&&this.factory.gold>=r.gold&&this.factory.countCrystals()>=r.crystals;
  }
  research(id:string){
    if(!this.canResearch(id)){this.toast('Recurso ou dependência ainda ausente.');return;}
    const r=RESEARCH.find(r=>r.id===id)!;if(!this.factory.spendCrystals(r.crystals))return;
    this.factory.gold-=r.gold;this.progress.researched!.push(id);
    this.progress.tier=Math.min(4,1+Number(this.hasResearch('processing'))+Number(this.hasResearch('glass'))+Number(this.hasResearch('automation')));
    this.audio.play('research');this.toast(r.name+' pesquisada.');void this.save(false);this.ui.showPanel();this.updateProgress();
  }
  activateBeacon(){
    if(!this.hasResearch('exploration')||this.progress.discovered!.length<6||this.progress.solved!.length<3){this.toast('Descubra seis regiões, resolva três arquivos e pesquise Cartografia.');return;}
    this.progress.won=true;this.audio.play('research');this.updateProgress();void this.save(false);this.setPanel('won');
  }
  toast(message:string){const el=document.querySelector('#toast');if(el){el.textContent=message;el.classList.add('show');this.toastUntil=this.time+5;}const feedback=document.querySelector('#modal-feedback');if(feedback){feedback.textContent=message;feedback.classList.remove('hidden');}}
}
