import { World, SIMULATION_HZ } from '../sim/world';
import { Mat, materials } from '../sim/materials';
import { generateTerrain } from '../sim/terrain';
import { Factory, MACHINE_DEFS, feedPoint, type MachineKind, type Machine } from '../sim/machines';
import { Renderer } from '../render/renderer';
import { Player } from './player';
import { Input } from './input';
import { AudioSystem } from './audio';
import { deserialize, serialize, SAVE_KEY, type Progress, type Preferences } from './save';
import { MISSIONS, type MissionContext } from './progression';
import { UI } from '../ui/ui';

export type Tool = 'dig'|'collect'|'pour'|'build';
export type Panel = 'start'|'build'|'research'|'help'|'inventory'|'pause'|'new'|'won'|null;
export const TOOL_NAMES = {dig:'Escavar',collect:'Coletar',pour:'Despejar',build:'Construir'};
export const FEED_MATERIAL:Partial<Record<MachineKind,Mat>>={separator:Mat.Pulp,kiln:Mat.Clay,crucible:Mat.Quartz,mist:Mat.Water,press:Mat.Pellet,vault:Mat.Crystal,crusher:Mat.Shard,pump:Mat.Water,lift:Mat.Pellet,belt:Mat.Sand,fastbelt:Mat.Sand,filter:Mat.Quartz};
export class Game {
  world=new World();factory=new Factory(this.world);player=new Player();
  inventory=Array(materials.length).fill(0) as number[];
  progress:Progress={mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0};
  preferences:Preferences={volume:.18,shake:!matchMedia('(prefers-reduced-motion: reduce)').matches,zoom:Math.min(4.5,Math.max(2.5,window.innerHeight/240))};
  renderer:Renderer;input:Input;audio=new AudioSystem();ui:UI;
  tool:Tool='dig';material:Mat=Mat.Sand;building:MachineKind='separator';rotation=0;selectedId=0;panel:Panel='start';
  started=false;hasSave=false;time=0;fps=60;saveLabel='Salvamento local';
  private last=0;private accumulator=0;private lastUI=0;private lastAutosave=0;private usedClick=false;private toastUntil=0;
  private feeds:{id:number;material:Mat;remaining:number}[]=[];private mining=new Map<number,number>();
  constructor(){
    this.ui=new UI(this);this.renderer=new Renderer(document.querySelector('#world')!,document.querySelector('#minimap')!);this.renderer.camera.zoom=this.preferences.zoom;
    this.input=new Input(this.renderer.canvas);this.input.onAction=code=>this.key(code);this.input.onZoom=amount=>{this.renderer.camera.zoom=Math.max(1.5,Math.min(6,this.renderer.camera.zoom+amount*.25));this.preferences.zoom=this.renderer.camera.zoom;};this.input.onPan=(x,y)=>{this.renderer.follow=false;this.renderer.camera.x-=x/this.renderer.camera.zoom;this.renderer.camera.y-=y/this.renderer.camera.zoom;};
    generateTerrain(this.world);
    try{this.hasSave=!!localStorage.getItem(SAVE_KEY);}catch{this.saveLabel='Armazenamento indisponível';}
    this.ui.showPanel();this.ui.update();
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started){this.save(false);this.input.release();this.last=0;}});
    window.addEventListener('pagehide',()=>{if(this.started)this.save(false);});
    requestAnimationFrame(t=>this.frame(t));
  }
  get paused(){return this.panel!==null||document.hidden;}
  newWorld(seed=(Date.now()%1000000)+1){
    this.world=new World(640,320,seed);generateTerrain(this.world);this.factory=new Factory(this.world);this.player=new Player();this.inventory=Array(materials.length).fill(0);
    this.progress={mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0};this.feeds=[];this.mining.clear();this.lastAutosave=0;this.selectedId=0;this.tool='dig';this.material=Mat.Sand;
    this.renderer.camera.x=210;this.renderer.camera.y=124;this.renderer.follow=true;this.started=true;this.setPanel(null);this.save(false);this.toast('Bem-vindo a Prismara. Escave a areia da superfície para começar.');
  }
  continueWorld(){
    try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('Nenhum mundo salvo.');const restored=deserialize(raw);Object.assign(this,restored);this.started=true;this.feeds=[];this.selectedId=0;this.renderer.camera.x=this.player.x+50;this.renderer.camera.y=this.player.y<185?124:this.player.y-18;this.renderer.camera.zoom=this.preferences.zoom;this.audio.volume=this.preferences.volume;this.setPanel(null);this.toast('Expedição restaurada. Sua fábrica está pronta para continuar.');}
    catch(error){this.toast(`Não foi possível restaurar: ${(error as Error).message}`);}
  }
  save(notify=true){
    if(!this.started)return false;
    try{localStorage.setItem(SAVE_KEY,serialize(this));this.hasSave=true;this.saveLabel='Salvo neste navegador';if(notify)this.toast('Mundo salvo: partículas, máquinas e pesquisas preservados.');return true;}
    catch{this.saveLabel='Falha ao salvar';if(notify)this.toast('Não há espaço disponível no navegador. O mundo continua aberto; libere espaço antes de sair.');return false;}
  }
  setPanel(panel:Panel){this.panel=panel;this.input?.release();this.ui.showPanel();this.ui.update();}
  selectTool(tool:Tool){this.tool=tool;this.selectedId=0;this.ui.update();this.audio.play('click');}
  selectBuild(kind:MachineKind){if(MACHINE_DEFS[kind].tier>this.progress.tier){this.toast('Desbloqueie este nível no painel Pesquisa.');return;}this.building=kind;this.tool='build';this.rotation=0;this.selectedId=0;this.setPanel(null);this.toast(`${MACHINE_DEFS[kind].name}: escolha um espaço livre. R gira; botão direito remove.`);}
  selectMaterial(mat:Mat){this.material=mat;this.tool='pour';this.setPanel(null);}
  private key(code:string){
    if(code==='Escape'){this.setPanel(this.panel===null?'pause':this.started?null:'start');return;}
    if(this.panel){if(code==='KeyB'&&this.panel==='build'||code==='KeyT'&&this.panel==='research'||code==='KeyH'&&this.panel==='help')this.setPanel(null);return;}
    if(/^Digit[1-4]$/.test(code)){const tools:Tool[]=['dig','collect','pour','build'];this.selectTool(tools[Number(code.slice(-1))-1]);}
    if(code==='KeyB')this.setPanel('build');if(code==='KeyT')this.setPanel('research');if(code==='KeyH')this.setPanel('help');if(code==='KeyI')this.setPanel('inventory');
    if(code==='KeyM')document.querySelector('.map-panel')?.classList.toggle('expanded');
    if(code==='KeyF'){this.renderer.follow=true;this.toast('Câmera acompanhando o explorador.');}
    if(code==='KeyR'){if(this.selectedId){const m=this.selectedMachine();if(m)m.rotation=(m.rotation+1)%4;}else this.rotation=(this.rotation+1)%4;this.ui.update(true);}
    if(code==='KeyQ'||code==='KeyE'){
      const dir=code==='KeyE'?1:-1;if(this.tool==='build'){const kinds=(Object.keys(MACHINE_DEFS) as MachineKind[]).filter(k=>MACHINE_DEFS[k].tier<=this.progress.tier);this.building=kinds[(kinds.indexOf(this.building)+dir+kinds.length)%kinds.length];}
      else{const all=materials.filter(m=>m.transportable&&m.state!=='gas').map(m=>m.id);this.material=all[(all.indexOf(this.material)+dir+all.length)%all.length];}this.ui.update();
    }
  }
  private frame(now:number){
    const dt=this.last?Math.min(.1,(now-this.last)/1000):1/60;this.last=now;this.fps+=(1/dt-this.fps)*.03;this.time+=dt;
    if(!this.paused){this.accumulator+=dt;let steps=0;while(this.accumulator>=1/SIMULATION_HZ&&steps<3){this.step();this.accumulator-=1/SIMULATION_HZ;steps++;}}else this.accumulator=0;
    const pointer=this.renderer.worldPoint(this.input.mouseX,this.input.mouseY);
    this.renderer.render({world:this.world,factory:this.factory,player:this.player,time:this.time,pointer,tool:this.started&&this.panel===null?this.tool:'none',building:this.building,rotation:this.rotation,selectedId:this.selectedId,paused:this.paused,shake:this.preferences.shake,won:this.progress.won},dt);
    if(this.time-this.lastUI>.12){this.ui.update();this.lastUI=this.time;}
    if(this.started&&!this.paused&&this.progress.elapsed-this.lastAutosave>25){this.save(false);this.lastAutosave=this.progress.elapsed;}
    if(this.time>this.toastUntil)document.querySelector('#toast')?.classList.remove('show');
    requestAnimationFrame(t=>this.frame(t));
  }
  /** One fixed simulation step. Also used by the deterministic integration harness. */
  step(){
    this.progress.elapsed+=1/SIMULATION_HZ;this.player.update(this.world,this.input.keys,1/SIMULATION_HZ);
    this.interact();this.feedStep();const impacts=this.factory.counters.impacts;
    this.factory.step();this.world.step();
    if(this.factory.counters.impacts>impacts){this.audio.play('impact');for(const m of this.factory.machines)if(m.kind==='press'&&m.flash>0)this.renderer.burst(m.x+m.w/2,m.y,3,12);}
    if(this.world.tick%15===0)this.updateProgress();
  }
  updateProgress(){
    this.progress.mixed=Math.max(this.progress.mixed,this.world.reactionCounts?.pulp??0);
    this.progress.crystalsMade=Math.max(this.progress.crystalsMade,this.world.reactionCounts?.crystal??0);
    if(this.player.x>510&&this.player.x<603&&this.player.y<190&&!this.progress.ruins){this.progress.ruins=true;this.toast('Ruína descoberta. Cristais antigos repousam no altar. O farol pede uma nova fonte de luz.');this.audio.play('research');}
    const context=this.context();let advanced=false;
    while(this.progress.mission<MISSIONS.length&&MISSIONS[this.progress.mission].value(context)>=MISSIONS[this.progress.mission].goal){this.progress.mission++;advanced=true;}
    if(advanced){this.audio.play('research');this.renderer.burst(this.player.x,this.player.y-10,2,24);this.toast(this.progress.mission<MISSIONS.length?`Objetivo concluído. Próximo: ${MISSIONS[this.progress.mission].title}`:'Expedição concluída. Prismara voltou a brilhar.');}
  }
  context():MissionContext {return {mined:this.progress.mined,pulp:this.progress.mixed,clay:this.factory.counters.clay,quartz:this.factory.counters.quartz,pellet:this.factory.counters.pellet,impacts:this.factory.counters.impacts,molten:this.factory.counters.molten,crystal:this.progress.crystalsMade,stored:this.factory.counters.stored,tier:this.progress.tier,ruins:this.progress.ruins,won:this.progress.won};}
  selectedMachine(){return this.factory.machines.find(m=>m.id===this.selectedId);}
  machineAt(x:number,y:number){return [...this.factory.machines].reverse().find(m=>x>=m.x&&x<m.x+m.w&&y>=m.y&&y<m.y+m.h);}
  private interact(){
    const {left,right}=this.input;
    if(!left&&!right){this.usedClick=false;return;}
    const point=this.renderer.worldPoint(this.input.mouseX,this.input.mouseY),m=this.machineAt(point.x,point.y);
    if(right){if(m&&!this.usedClick)this.removeMachine(m.id);this.usedClick=true;return;}
    if(m&&!this.usedClick){this.selectedId=m.id;this.usedClick=true;this.ui.update(true);return;}
    if(this.tool==='build'){if(!this.usedClick)this.place(this.building,Math.floor(point.x/2)*2,Math.floor(point.y/2)*2,this.rotation);this.usedClick=true;return;}
    if(m)return;
    this.selectedId=0;
    if(Math.hypot(point.x-this.player.x,point.y-this.player.y)>95){if(!this.usedClick)this.toast('Aproxime o explorador: alcance da ferramenta de 95 células.');this.usedClick=true;return;}
    if(this.tool==='pour'){
      if(this.world.tick%2)return;const count=Math.min(4,this.inventory[this.material]);if(!count){if(!this.usedClick)this.toast('A mochila não contém este material. Colete [2] ou escolha outro [Q/E].');this.usedClick=true;return;}
      const emitted=this.world.emit(point.x,point.y,this.material,count);this.inventory[this.material]-=emitted;if(emitted)this.audio.play(this.material===Mat.Water?'water':'dig');return;
    }
    if(this.world.tick%2)return;
    let collected=0;
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      if(dx*dx+dy*dy>18)continue;const x=point.x+dx,y=point.y+dy;if(!this.world.inBounds(x,y))continue;const index=this.world.index(x,y),mat=this.world.cells[index],def=materials[mat];
      if(mat===Mat.Air||this.world.blocked[index])continue;
      if(this.tool==='collect'&&(!def.transportable||def.state==='gas'))continue;
      if(mat===Mat.Molten){if(!this.usedClick){this.toast('Vidro fundido exige resfriamento. Use Névoa Fria antes de coletar.');this.usedClick=true;}continue;}
      if(def.state==='gas')continue;
      const damage=(this.mining.get(index)??0)+1;if(damage<def.resistance){this.mining.set(index,damage);continue;}this.mining.delete(index);
      let output=mat;
      if(mat===Mat.Earth)output=this.world.rng()<.025?Mat.Quartz:Mat.Sand;
      if(mat===Mat.Rock||mat===Mat.Wall)output=Mat.Sand;
      this.world.set(x,y,Mat.Air);this.inventory[output]++;if(output===Mat.Sand)this.progress.mined++;collected++;
    }
    if(collected){this.renderer.burst(point.x,point.y,0,Math.min(collected,10));this.audio.play('dig');}
  }
  place(kind:MachineKind,x:number,y:number,rotation=0){
    const def=MACHINE_DEFS[kind];if(def.tier>this.progress.tier){this.toast('Pesquise o nível necessário primeiro.');return null;}
    if(this.inventory[Mat.Sand]<def.cost){this.toast(`Faltam ${def.cost-this.inventory[Mat.Sand]} grãos de areia para construir.`);return null;}
    const p=this.player;if(!['pipe','pump','valve','sensor'].includes(kind)&&x<p.x+3&&x+def.w>p.x-3&&y<p.y+1&&y+def.h>p.y-12){this.toast('Deixe espaço para o explorador sair da construção.');return null;}
    const m=this.factory.add(kind,x,y,rotation);if(!m){this.toast('Posição ocupada. Escave o terreno ou escolha outro espaço.');return null;}
    this.inventory[Mat.Sand]-=def.cost;this.renderer.burst(x+def.w/2,y+def.h/2,1,15);this.audio.play('build');this.ui.update();return m;
  }
  removeMachine(id:number){const m=this.factory.machines.find(m=>m.id===id);if(!m)return;if(this.factory.remove(id)){this.inventory[Mat.Sand]+=MACHINE_DEFS[m.kind].cost;this.selectedId=0;this.feeds=this.feeds.filter(f=>f.id!==id);this.toast('Máquina recolhida. Custo devolvido; partículas preservadas.');this.audio.play('build');}else this.toast('Libere espaço ao redor para drenar o líquido antes de remover.');this.ui.update(true);}
  queueFeed(id:number,material?:Mat){
    const m=this.factory.machines.find(m=>m.id===id);if(!m)return;
    let mat=material??FEED_MATERIAL[m.kind]??this.material;
    if(m.kind==='crusher'&&!this.inventory[Mat.Shard])mat=Mat.Glass;
    const remaining=Math.min(m.kind==='press'?12:64,this.inventory[mat]);if(!remaining){this.toast(`Colete ${materials[mat].name} e tente novamente.`);return;}
    if(this.feeds.some(f=>f.id===id)){this.toast('Esta máquina já tem uma alimentação em andamento.');return;}
    this.feeds.push({id,material:mat,remaining});this.toast(`${remaining} × ${materials[mat].name}: despejando pela entrada física.`);
  }
  private feedStep(){
    if(this.world.tick%3)return;
    for(const feed of this.feeds){
      const m=this.factory.machines.find(m=>m.id===feed.id);if(!m||!this.inventory[feed.material]){feed.remaining=0;continue;}
      const p=feedPoint(m);if(m.kind==='press')p.y=m.y-26;
      if(m.kind==='pump')p.y=m.y-1;
      for(const dx of [0,-1,1,-2,2]){const x=p.x+dx,y=p.y;if(this.world.inBounds(x,y)&&this.world.get(x,y)===Mat.Air&&!this.world.blocked[this.world.index(x,y)]){this.world.set(x,y,feed.material);this.inventory[feed.material]--;feed.remaining--;break;}}
    }
    this.feeds=this.feeds.filter(f=>f.remaining>0);
  }
  isFeeding(id:number){return this.feeds.find(f=>f.id===id)?.remaining??0;}
  canResearch(tier:number){if(tier!==this.progress.tier+1)return false;if(tier===2)return this.factory.counters.clay>=18&&this.factory.counters.quartz>=3;if(tier===3)return this.factory.counters.impacts>=3;if(tier===4)return this.factory.countCrystals()>=12;return false;}
  research(tier:number){if(!this.canResearch(tier)){this.toast('Complete o requisito indicado para esta pesquisa.');return;}if(tier===4&&!this.factory.spendCrystals(12))return;this.progress.tier=tier;this.audio.play('research');this.renderer.burst(this.player.x,this.player.y,2,45);this.toast(`Nível ${tier} desbloqueado. Novas máquinas disponíveis.`);this.save(false);this.ui.showPanel();this.updateProgress();}
  activateBeacon(){if(this.progress.tier<4||!this.progress.ruins||Math.abs(this.player.x-550)>50||this.player.y>195){this.toast('Visite o farol na ruína após pesquisar Controle de Fluxo.');return;}if(!this.factory.spendCrystals(24)){this.toast('O farol precisa de 24 cristais armazenados no cofre.');return;}this.progress.won=true;this.audio.play('research');this.updateProgress();this.save(false);this.setPanel('won');}
  buildThermalModule(){
    if(this.progress.tier<3)return;const cost=MACHINE_DEFS.crucible.cost+MACHINE_DEFS.mist.cost+6;
    if(this.inventory[Mat.Sand]<cost){this.toast(`O módulo precisa de ${cost} grãos de areia.`);return;}
    for(let x=210;x<306;x+=30)for(let y=102;y>=54;y-=40){
      let free=true;for(let yy=y;yy<=y+33;yy++)for(let xx=x-2;xx<=x+24;xx++)if(this.world.get(xx,yy)!==Mat.Air||this.world.blocked[this.world.index(xx,yy)])free=false;
      if(!free||!this.factory.canPlace('crucible',x,y)||!this.factory.canPlace('mist',x+9,y+12))continue;
      const crucible=this.factory.add('crucible',x,y),mist=this.factory.add('mist',x+9,y+12,3);
      if(!crucible||!mist){if(crucible)this.factory.remove(crucible.id);if(mist)this.factory.remove(mist.id);continue;}
      for(let xx=x-2;xx<=x+24;xx++)this.world.set(xx,y+33,Mat.Wall);
      for(let yy=y+12;yy<y+33;yy++){this.world.set(x-2,yy,Mat.Wall);this.world.set(x+24,yy,Mat.Wall);}
      for(let yy=y+9;yy<y+12;yy++)this.world.set(x+15,yy,Mat.Wall);
      this.inventory[Mat.Sand]-=cost;this.selectedId=crucible.id;this.tool='collect';this.renderer.follow=false;this.renderer.camera.x=x;this.renderer.camera.y=y+25;this.setPanel(null);this.toast('Módulo térmico montado. Alimente o cadinho com quartzo e o gerador à direita com água.');return;
    }
    this.toast('O posto está ocupado. Construa o cadinho e a névoa separadamente.');
  }
  toast(message:string){const el=document.querySelector('#toast')!;el.textContent=message;el.classList.add('show');this.toastUntil=this.time+5;}
}
