import {legacySize} from '../src/game/migrate-modules';
import {feedPoint,globalCell} from '../src/sim/machines';
import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/sim/world';
import {Factory,machineSize,machinePorts,machineSolid,MACHINE_DEFS} from '../src/sim/machines';
import {Mat} from '../src/sim/materials';
import {REACTIONS} from '../src/sim/reactions';
import {CONTROLS} from '../src/game/input';
import {RESEARCH} from '../src/game/progression';
import {deserialize,serialize,type Saveable} from '../src/game/save';
import {Player} from '../src/game/player';
import {generateTerrain,spawnPoint,chambers} from '../src/sim/terrain';
import {reachablePlayer} from '../src/sim/terrain-access';
import {installLine} from './fixtures/line';
import {installAdvancedLine} from './fixtures/advanced';
import {Game} from '../src/game/game';
import {Exploration} from '../src/game/exploration';
const advance=(w:World,f:Factory,n:number)=>{for(let i=0;i<n;i++){f.step();w.step();}};

test('sieve reserves its lower outlet and leaves residual material on the grille',()=>{
  const w=new World(120,100,72),f=new Factory(w),m=f.add('sieve',40,30)!;
  const x=46;
  w.set(x,m.y+4,Mat.WetSand);w.set(x,m.y+m.h,Mat.Rock);f.step();
  assert.equal(w.get(x,m.y+4),Mat.WetSand);assert.equal(m.status,'Saída bloqueada');
  w.set(x,m.y+m.h,Mat.Air);
  const original=w.rng.bind(w);w.rng=()=>0;w.tick=5;f.step();w.rng=original;
  assert.equal(w.get(x,m.y+4),Mat.Residue);assert.equal(w.get(x,m.y+m.h),Mat.Gold);
  assert.equal(f.energy.value,160);assert.equal(f.counters.wet,1);
  assert.equal(machinePorts(m).find(p=>p.label==='Resíduo')!.y,m.y+4);
});
test('sieve yield matches its configurable abstraction over many independent grains',()=>{
  const w=new World(100,100,51),f=new Factory(w),m=f.add('sieve',40,30)!;
  for(let n=0;n<2000;n++){w.tick=n*5;w.set(46,34,Mat.WetSand);f.step();w.set(46,38,Mat.Air);for(let x=40;x<48;x++)w.set(x,34,Mat.Air);}
  assert.equal(f.counters.wet,2000);assert.ok(Math.abs(f.counters.gold/2000-REACTIONS.sieve.goldChance)<.035);
});
test('collector credits physical gold and crystals exactly once even after reload and removal',()=>{
  const w=new World(128,96,11),f=new Factory(w),m=f.add('collector',40,40)!;
  w.set(46,39,Mat.Gold);w.set(45,43,Mat.Crystal);f.step();f.step();
  assert.equal(f.gold,1);assert.equal(f.countCrystals(),1);assert.equal(w.count(Mat.Gold),0);
  const game:Saveable={world:w,factory:f,player:Object.assign(new Player(),{x:20,y:30}),inventory:Array(22).fill(0),progress:{mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0},preferences:{volume:0,shake:false,zoom:3}};
  const r=deserialize(serialize(game));r.factory.step();r.factory.remove(m.id);r.factory.step();
  assert.equal(r.factory.gold,1);assert.equal(r.factory.countCrystals(),1);
  assert.equal(r.factory.spendCrystals(1),true);assert.equal(r.factory.spendCrystals(1),false);
});
test('rotated structural dimensions, solid cells and placement use identical geometry',()=>{
  const w=new World(128,96,17),f=new Factory(w);
  assert.deepEqual(machineSize('wall',1),{w:8,h:8});
  w.set(45,31,Mat.Water);
  assert.equal(f.canPlace('wall',40,30,0),false);assert.equal(f.canPlace('wall',40,30,1),false);
  w.set(45,31,Mat.Air);const m=f.add('wall',40,30,1)!;
  assert.deepEqual({w:m.w,h:m.h},machineSize('wall',1));
  for(let y=m.y;y<m.y+m.h;y++)for(let x=m.x;x<m.x+m.w;x++)assert.equal(!!w.blocked[w.index(x,y)],machineSolid(m,x,y));
  assert.equal(f.add('belt',40,30,2),null);
  assert.equal(f.remove(m.id),true);assert.equal(w.blocked.some(id=>id===m.id),false);
});
test('machine construction refuses to overwrite gas, particles or consolidated ore',()=>{
  for(const mat of [Mat.Mist,Mat.Gold,Mat.Quartz,Mat.Water]){const w=new World(80,80,6),f=new Factory(w);w.set(30,30,mat);assert.equal(f.add('block',30,30),null);assert.equal(w.get(30,30),mat);}
});
test('rotated funnel ports follow its physical mouth and throat and mist uses its preview outlet',()=>{
  for(let rotation=0;rotation<4;rotation++){
    const w=new World(120,120,6),f=new Factory(w),funnel=f.add('funnel',30,30,rotation)!;
    const ports=machinePorts(funnel),entry=ports.find(p=>p.label==='Entrada')!,exit=ports.find(p=>p.label==='Saída')!;
    assert.ok(entry.x<funnel.x||entry.x>=funnel.x+funnel.w||entry.y<funnel.y||entry.y>=funnel.y+funnel.h);
    assert.ok(exit.x<funnel.x||exit.x>=funnel.x+funnel.w||exit.y<funnel.y||exit.y>=funnel.y+funnel.h);
    const mist=f.add('mist',65,65,rotation)!,nozzle=machinePorts(mist).find(p=>p.label==='Saída')!;const input=feedPoint(mist);w.set(input.x,input.y,Mat.Water);f.step();assert.equal(w.get(nozzle.x,nozzle.y),Mat.Mist);
  }
});
test('grille blocks player and residual solids while passing gold, water and gas',()=>{
  const w=new World(100,100,8),f=new Factory(w),s=f.add('sieve',30,30)!;
  assert.ok(w.blocked[w.index(34,35)]);assert.equal(w.accepts(34,35,Mat.Residue),false);
  for(const mat of [Mat.Gold,Mat.Water,Mat.Steam])assert.equal(w.accepts(34,35,mat),true);
  w.set(34,34,Mat.Gold);w.set(35,34,Mat.Residue);s.enabled=false;advance(w,f,8);
  assert.equal(w.count(Mat.Gold),1);assert.equal(w.get(34,42),Mat.Gold);assert.equal(w.get(35,34),Mat.Residue);
});
test('launcher traverses intermediate cells and hits a wall without teleporting or deleting grains',()=>{
  const w=new World(120,100,91),f=new Factory(w),m=f.add('launcher',30,40)!;m.force=8;m.angle=0;
  for(let y=1;y<90;y++)w.set(43,y,Mat.Rock);
  w.set(37,39,Mat.Sand);advance(w,f,20);
  const i=w.cells.indexOf(Mat.Sand);assert.equal(w.count(Mat.Sand),1);assert.ok(i%w.width<43,'wall must stop projectile');
});
test('consolidated terrain remains in place and excavation releases material without collecting it',()=>{
  const w=new World(80,80,10);w.set(40,20,Mat.Sand);w.consolidated[w.index(40,20)]=1;
  for(let i=0;i<12;i++)w.step();assert.equal(w.get(40,20),Mat.Sand);
  assert.equal(w.excavate(40,20),true);for(let i=0;i<8;i++)w.step();assert.equal(w.get(40,28),Mat.Sand);assert.equal(w.count(Mat.Sand),1);
});
test('finite liquid is contained by built walls and leaks when a wall is removed',()=>{
  const w=new World(100,100,19),f=new Factory(w);
  const left=f.add('wall',32,32)!,right=f.add('wall',48,32)!;f.add('platform',32,40);f.add('platform',40,40);f.add('block',48,40);
  for(let y=36;y<46;y++)for(let x=33;x<48;x++)w.set(x,y,Mat.Water);
  // Stack a second wall module to reach the bottom platform.
  const lowerLeft=f.add('wall',32,40);assert.equal(lowerLeft,null,'bounding boxes cannot overlap');
  for(let y=40;y<47;y++)w.set(32,y,Mat.Wall);for(let y=40;y<47;y++)w.set(48,y,Mat.Wall);
  advance(w,f,120);assert.equal(w.count(Mat.Water),150);assert.equal(w.cells.some((m,i)=>m===Mat.Water&&i%w.width>48),false);
  f.remove(right.id);advance(w,f,80);assert.equal(w.count(Mat.Water),150);assert.ok(w.cells.some((m,i)=>m===Mat.Water&&i%w.width>48));assert.ok(left);

});
test('calcination is visible thermal chemistry and recovered outputs wait for capacity',()=>{
  const w=new World(100,100,14),f=new Factory(w),m=f.add('crusher',40,50)!;
  w.set(45,49,Mat.Residue,520);w.step();assert.equal(w.count(Mat.Calcined),1);
  const index=w.cells.indexOf(Mat.Calcined);w.set(index%w.width,Math.floor(index/w.width),Mat.Air);w.set(45,49,Mat.Calcined,300);w.set(44,58,Mat.Rock);
  const energy=f.energy.value;f.step();assert.equal(w.get(45,49),Mat.Calcined);assert.equal(f.energy.value,energy);
  w.set(44,58,Mat.Air);w.tick=4;f.step();assert.ok([Mat.Clay,Mat.Quartz].includes(w.get(44,58)));
});
test('research graph is acyclic, every unlock exists, and basic resources never depend on their producer',()=>{
  const visiting=new Set<string>(),done=new Set<string>();
  function visit(id:string){assert.equal(visiting.has(id),false,'cycle '+id);if(done.has(id))return;visiting.add(id);const r=RESEARCH.find(r=>r.id===id);assert.ok(r);r.requires.forEach(visit);visiting.delete(id);done.add(id);}
  RESEARCH.forEach(r=>visit(r.id));Object.values(MACHINE_DEFS).forEach(m=>{if(m.research)assert.ok(done.has(m.research));});
  for(const kind of ['sieve','collector','belt'] as const)assert.equal(MACHINE_DEFS[kind].research,undefined);
  for(const r of RESEARCH.filter(r=>r.crystals>0))assert.ok(r.requires.includes('glass'));
});
test('keyboard help has no conflicting bindings',()=>{const codes=CONTROLS.flatMap(c=>c.codes);assert.equal(new Set(codes).size,codes.length);});
test('cold ice barriers survive idle simulation and melt when intentionally heated',()=>{
  const w=new World(80,80,23);for(let y=20;y<30;y++)for(let x=30;x<36;x++)w.set(x,y,Mat.Ice,-20);
  for(let i=0;i<1000;i++)w.step();assert.equal(w.count(Mat.Ice),60);
  w.temperature[w.index(33,25)]=85;w.markDirty(33,25);w.step();assert.equal(w.count(Mat.Water),1);assert.equal(w.count(Mat.Ice),59);
});
test('v1 migration retains old material ids, particles and networks and unlocks compatible branches',()=>{
  const w=new World(128,96,7),f=new Factory(w);f.add('separator',20,20);const p=f.add('pipe',50,20)!;p.buffer={material:Mat.Pulp,count:12,temperature:31};w.set(55,35,Mat.Pulp);w.set(60,40,Mat.Rock);
  const game:Saveable={world:w,factory:f,player:Object.assign(new Player(),{x:70,y:20}),inventory:Array(22).fill(0),progress:{mined:8,mixed:18,crystalsMade:0,tier:3,ruins:false,won:false,elapsed:60,mission:4},preferences:{volume:.1,shake:false,zoom:3}};
  const data=JSON.parse(serialize(game));data.version=1;data.inventory.length=17;for(const m of data.machines)Object.assign(m,legacySize(m.kind,m.rotation));delete data.world.consolidated;delete data.world.velocityX;delete data.world.velocityY;delete data.credits;
  const r=deserialize(JSON.stringify(data));assert.deepEqual(r.world.cells,w.cells);assert.equal(r.factory.machines[1].buffer!.count,12);assert.equal(r.world.consolidated[r.world.index(60,40)],1);assert.ok(r.progress.researched!.includes('glass'));assert.equal(r.factory.gold,0);
});
test('three minutes of autonomous mining, belt transport, finite wetting, screening and collection',()=>{
  const w=new World(320,240,91207),f=new Factory(w);installLine(w,f);
  const initialWater=w.count(Mat.Water),samples:number[]=[];
  for(let second=0;second<180;second++){advance(w,f,30);if(second%30===29)samples.push(f.gold);}
  assert.ok((f.counters.mined??0)>=265);assert.ok((f.counters.wet??0)>200,JSON.stringify(f.counters));
  assert.ok(f.gold>40,JSON.stringify(samples));assert.ok(samples.every((n,i)=>i===0||n>samples[i-1]),'continuous collection each 30 s: '+samples);
  assert.ok(w.count(Mat.Water)<initialWater);assert.ok(w.consolidated.some((n,i)=>n&&w.cells[i]===Mat.Sand),'raw deposit remains at 180 s');
  assert.equal(w.count(Mat.Water)+f.pipes.inspect(f.machines.find(m=>m.kind==='pump')!.id).count+w.reactionCounts.wet,initialWater,'every finite water unit remains in the world, tubes or a wetting reaction');
  assert.equal(w.count(Mat.Gold)+f.gold,f.counters.gold,'all emitted gold remains physical or collected');
});
for(const [width,height] of [[320,240],[1024,1536]])test(`advanced gravity installation takes only raw sand and water through ceramics, impact energy, glass and rare collection (${width}x${height})`,()=>{
  const w=new World(width,height,91207),f=new Factory(w);installAdvancedLine(w,f);advance(w,f,5400);
  assert.ok(f.counters.clay>180);assert.ok(f.counters.pellet>170);assert.ok(f.counters.impacts>30);assert.ok(f.counters.energy>=960);
  assert.ok(f.counters.molten>40);assert.ok(f.crystals>=8);assert.ok(f.gold>40);
  assert.equal(w.count(Mat.Gold)+f.gold,f.counters.gold);assert.equal(w.count(Mat.Crystal)+f.crystals,w.reactionCounts.crystal);
  assert.ok(w.count(Mat.Pellet)>0,'full battery visibly blocks the press without destroying its pellets');
});
test('closing a gate with particles inside refuses the action and keeps all resources',()=>{
  const w=new World(80,80,3),f=new Factory(w),g=f.add('gate',30,30)!;assert.equal(f.setEnabled(g.id,false),true);
  w.set(34,37,Mat.Water);assert.equal(f.setEnabled(g.id,true),false);assert.equal(g.enabled,false);assert.equal(w.count(Mat.Water),1);assert.equal(w.blocked[w.index(34,37)],0);
});
test('automatic rising signals leave an occupied gate open until its aperture clears',()=>{
  const w=new World(100,100,3),f=new Factory(w),gate=f.add('gate',40,40)!,sensor=f.add('sensor',20,20)!;
  sensor.targetId=gate.id;sensor.filter=Mat.Sand;f.step();assert.equal(gate.signal,false);
  w.set(44,47,Mat.Gold);w.set(22,16,Mat.Sand);f.step();assert.equal(gate.signal,false);assert.equal(w.blocked[w.index(44,47)],0);assert.equal(w.count(Mat.Gold),1);
  w.set(44,47,Mat.Air);f.step();assert.equal(gate.signal,true);assert.ok(w.blocked[w.index(44,47)]);
});
test('the ancient mechanism accepts twelve supported pellets without requiring shard cleanup',()=>{
  const world=new World(1024,1536,7),factory=new Factory(world),c=chambers(world).find(c=>c.id==='feed')!;
  for(let x=c.x-5;x<=c.x+5;x++){world.set(x,c.y-4,Mat.Wall);world.set(x,c.y-5,Mat.Pellet);}world.set(c.x,c.y-6,Mat.Pellet);
  const g=Object.create(Game.prototype) as Game;Object.assign(g,{world,factory,exploration:new Exploration(world),player:Object.assign(new Player(),{x:c.x,y:c.y-10}),progress:{mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0,researched:[],discovered:[5],solved:[],visited:['feed'],chamberFeed:0},audio:{play:()=>{}},toast:()=>{}});
  g.updateProgress();assert.equal(g.progress.chamberFeed,12);assert.deepEqual(g.progress.solved,['feed']);assert.equal(world.count(Mat.Shard),12);factory.counters.mined=24;assert.equal(g.context().mined,24);
});
for(const seed of [1,7,91207])test('deep world has traversable connecting galleries and safe initial basin, seed '+seed,()=>{
  const w=new World(1024,1536,seed);generateTerrain(w);const p=spawnPoint(w);assert.equal(w.get(p.x,p.y),Mat.Air);
  const {reachable}=reachablePlayer(w,p.x,p.y);for(const c of chambers(w))assert.ok(reachable[w.index(c.x-20,c.y-30)],'connected chamber '+c.id);
});
