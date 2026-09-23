import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {World} from '../src/sim/world';
import {Mat,materials} from '../src/sim/materials';
import {Factory,MACHINE_DEFS,machineSize,machineSolid,type MachineKind,feedPoint,outlet} from '../src/sim/machines';
import {globalCell,MODULE_SIZE,FLOW_ROW} from '../src/sim/module-geometry';
import {Player} from '../src/game/player';
import {Exploration} from '../src/game/exploration';
import {emptyLoad,pickLoad,dropLoad,dropTargets,gripBounds,storeLoad,toolReachable} from '../src/game/manipulator';
import {deserialize,serialize,type Saveable} from '../src/game/save';
import {Game} from '../src/game/game';
import {generateTerrain,surfaceAt} from '../src/sim/terrain';
import {playerClearance} from '../src/sim/terrain-access';
import {blocksPlayer} from '../src/sim/player-collision';
const setup=()=>{const world=new World(128,128,42),player=Object.assign(new Player(),{x:24,y:44}),exploration=new Exploration(world),factory=new Factory(world);exploration.reveal(64,64,200);return {world,player,exploration,factory,reach:70,manualLoad:emptyLoad(),inventory:Array(materials.length).fill(0),progress:{mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0,researched:[]},preferences:{volume:0,shake:false,zoom:3}};};
test('manual selection and preview use the same exact 5 by 5 cells, center priority and stable type',()=>{
 const g=setup(),b=gripBounds(40.8,40.2);assert.deepEqual(b,{x:38,y:38,w:5,h:5});
 for(let y=37;y<=43;y++)for(let x=37;x<=43;x++)g.world.set(x,y,Mat.Sand,71);
 g.world.set(40,40,Mat.Quartz,99);assert.equal(pickLoad(g,g.manualLoad,40,40),1);assert.equal(g.manualLoad.material,Mat.Quartz);assert.deepEqual(g.manualLoad.pixels.map(p=>[p.dx,p.dy,p.temperature]),[[2,2,99]]);
 dropLoad(g,g.manualLoad,60,40);g.world.set(60,40,Mat.Air);
 assert.equal(pickLoad(g,g.manualLoad,40,40),24);assert.equal(g.manualLoad.material,Mat.Sand);assert.equal(g.world.count(Mat.Sand),24);
 assert.ok(dropTargets(g,g.manualLoad,40,40).every(p=>p.x>=b.x&&p.x<b.x+b.w&&p.y>=b.y&&p.y<b.y+b.h));
 assert.equal(pickLoad(g,g.manualLoad,40,40),0,'holding is a single action');
});
test('manual pickup rejects consolidated ore, liquid, gas, structures, hidden cells and walls along the ray',()=>{
 const g=setup();for(const mat of [Mat.Water,Mat.Pulp,Mat.Steam,Mat.Wall]){g.world.set(40,40,mat);assert.equal(pickLoad(g,g.manualLoad,40,40),0);}
 g.world.set(40,40,Mat.Quartz);g.world.consolidated[g.world.index(40,40)]=1;assert.equal(pickLoad(g,g.manualLoad,40,40),0);
 g.world.excavate(40,40);for(let y=0;y<128;y++)g.world.set(32,y,Mat.Wall);assert.equal(pickLoad(g,g.manualLoad,40,40),0);assert.equal(toolReachable(g,40,40),false);
 for(let y=0;y<128;y++)g.world.set(32,y,Mat.Air);g.exploration.discoveredCells[g.world.index(40,40)]=0;assert.equal(pickLoad(g,g.manualLoad,40,40),0);
});
test('partial drops conserve exact pixels and properties through retry and portable saves',()=>{
 const g=setup();for(let x=39;x<=41;x++){g.world.set(x,40,Mat.WetSand,64);g.world.fall[g.world.index(x,40)]=17;}
 pickLoad(g,g.manualLoad,40,40);g.world.set(61,40,Mat.Sand);assert.equal(dropLoad(g,g.manualLoad,60,40),2);assert.equal(g.manualLoad.state,'partial');assert.equal(g.manualLoad.pixels.length,1);
 const restored=deserialize(serialize(g));assert.deepEqual(restored.manualLoad,g.manualLoad);assert.equal(restored.world.count(Mat.WetSand)+restored.manualLoad!.pixels.length,3);
 const h={...restored,reach:70,exploration:restored.exploration!};assert.equal(dropLoad(h,restored.manualLoad!,60,40),0);assert.equal(dropLoad(h,restored.manualLoad!,55,35),1);assert.equal(restored.world.count(Mat.WetSand),3);assert.equal(restored.world.temperature[restored.world.index(56,35)],64);assert.equal(restored.world.fall[restored.world.index(56,35)],17);
});
test('unknown, distant and blocked release retains load; explicit stock transfer respects capacity',()=>{
 const g=setup();g.world.set(40,40,Mat.Sand);pickLoad(g,g.manualLoad,40,40);const before=structuredClone(g.manualLoad);
 assert.equal(dropLoad(g,g.manualLoad,120,120),0);assert.deepEqual(g.manualLoad,before);assert.equal(storeLoad(g.manualLoad,g.inventory,0),0);assert.equal(storeLoad(g.manualLoad,g.inventory,1),1);assert.equal(g.inventory[Mat.Sand],1);assert.equal(g.manualLoad.state,'empty');
});
test('invalid manual portable payload is rejected atomically',()=>{
 const g=setup();g.world.set(40,40,Mat.Sand);pickLoad(g,g.manualLoad,40,40);const before=serialize(g);
 for(const change of [(v:any)=>v.pixels.push(v.pixels[0]),(v:any)=>v.material=Mat.Water,(v:any)=>v.pixels[0].temperature=NaN,(v:any)=>v.state='empty']){const data=JSON.parse(before);change(data.manualLoad);assert.throws(()=>deserialize(JSON.stringify(data)));assert.equal(g.manualLoad.pixels.length,1);}
});
test('vacuum unlock is enforced for UI and shortcuts by the same tool gate; manual stays available',()=>{
 const game=Object.create(Game.prototype) as Game;game.progress=setup().progress;
 assert.equal(game.toolAvailable('vacuum'),false);assert.equal(game.toolAvailable('collect'),true);game.progress.researched!.push('vacuum');assert.equal(game.toolAvailable('vacuum'),true);assert.equal(game.toolAvailable('collect'),true);
 const g=setup();g.progress.researched.push('vacuum' as never);assert.ok(deserialize(serialize(g)).progress.researched!.includes('vacuum'));
});
for(const mat of [Mat.Sand,Mat.Quartz,Mat.Residue,Mat.WetSand,Mat.Water,Mat.Pulp])test('loose material '+mat+' is passable in sleeping or moving chunks without collection',()=>{
 const g=setup();g.player.x=20;g.player.y=60;for(let x=0;x<128;x++)g.world.set(x,61,Mat.Rock);
 for(let y=50;y<=60;y++)for(let x=30;x<=50;x++)g.world.set(x,y,mat);g.world.active.fill(0);const count=g.world.count(mat),access=playerClearance(g.world);
 assert.equal(access[g.world.index(40,60)],1);for(let n=0;n<40;n++)g.player.update(g.world,new Set(['KeyD']),1/30);assert.ok(g.player.x>60);
 g.world.velocityY.fill(2);for(let n=0;n<40;n++)g.player.update(g.world,new Set(['KeyA']),1/30);assert.ok(g.player.x<25);assert.equal(g.world.count(mat),count);
});
test('excavation removes player wall collision immediately and grains survive crossings',()=>{
 const g=setup();for(let y=25;y<50;y++){g.world.set(40,y,Mat.Quartz);g.world.consolidated[g.world.index(40,y)]=1;assert.equal(blocksPlayer(g.world,40,y),true);g.world.excavate(40,y);assert.equal(blocksPlayer(g.world,40,y),false);}assert.equal(g.world.count(Mat.Quartz),25);
 const m=g.factory.add('platform',64,64)!;assert.equal(blocksPlayer(g.world,66,71),true);assert.equal(blocksPlayer(g.world,66,65),false);assert.equal(playerClearance(g.world)[g.world.index(66,71)],0);assert.ok(m);
});
test('every buildable footprint is square and all rotated masks and ports share one transform',()=>{
 for(const kind of Object.keys(MACHINE_DEFS) as MachineKind[])for(let r=0;r<4;r++){
  const g=setup(),m=g.factory.add(kind,64,64,r)!;assert.ok(m,kind);assert.deepEqual(machineSize(kind,r),{w:8,h:8});assert.equal(m.w, MODULE_SIZE);assert.equal(m.h,MODULE_SIZE);
  for(let y=64;y<72;y++)for(let x=64;x<72;x++)assert.equal(!!g.world.blocked[g.world.index(x,y)],machineSolid(m,x,y));
 }
});
test('connected square belts convey along their shared surface without jumping obstacles',()=>{
 const g=setup();g.factory.add('belt',32,32);g.factory.add('belt',40,32);g.world.set(37,36,Mat.Sand);g.world.set(42,36,Mat.Wall);
 for(let i=0;i<12;i++)g.factory.step();assert.equal(g.world.get(41,36),Mat.Sand);assert.equal(g.world.count(Mat.Sand),1);g.world.set(42,36,Mat.Air);for(let i=0;i<7;i++)g.factory.step();assert.equal(g.world.get(48,36),Mat.Sand);
});
test('rotated sieve preserves blocked input and emits gold and residue at transformed ports',()=>{
 for(let r=0;r<4;r++) {const g=setup(),m=g.factory.add('sieve',64,64,r)!,p=globalCell(m,3,FLOW_ROW),out=globalCell(m,3,8);g.world.set(p.x,p.y,Mat.WetSand);g.world.set(out.x,out.y,Mat.Wall);g.world.rng=()=>0;g.factory.step();assert.equal(g.world.get(p.x,p.y),Mat.WetSand);g.world.set(out.x,out.y,Mat.Air);g.world.tick=5;g.factory.step();assert.equal(g.world.get(p.x,p.y),Mat.Residue);assert.equal(g.world.get(out.x,out.y),Mat.Gold);}
});
test('rotated pump intake and valve outlet use face ports and finite per-module buffers',()=>{
 for(let r=0;r<4;r++){const g=setup(),pump=g.factory.add('pump',40,40,r)!,pipe=g.factory.add('pipe',48,40)!,valve=g.factory.add('valve',56,40,r)!;const p=feedPoint(pump),out=outlet(valve);g.world.set(p.x,p.y,Mat.Water,63);g.factory.step();assert.equal(g.world.get(out.x,out.y),Mat.Water);assert.equal(g.factory.pipes.inspect(pipe.id).capacity,144);assert.equal(g.factory.pipes.inspect(pipe.id).count,0);}
});
test('stacked lift modules carry material through the connecting face',()=>{
 const g=setup();g.factory.add('lift',64,64);g.factory.add('lift',64,56);g.world.set(67,70,Mat.Quartz);
 for(let n=0;n<7;n++)g.factory.step();assert.equal(g.world.get(67,56),Mat.Quartz);assert.equal(g.world.count(Mat.Quartz),1);
});
test('rotated drill checks support on its working face before releasing a consolidated cell',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const g=setup(),m=g.factory.add('drill',64,64,rotation)!,p=globalCell(m,3,9),support=globalCell(m,3,10);
  for(const q of [p,support]){g.world.set(q.x,q.y,Mat.Quartz);g.world.consolidated[g.world.index(q.x,q.y)]=1;}
  g.factory.step();assert.equal(g.world.consolidated[g.world.index(support.x,support.y)],0);assert.equal(g.world.consolidated[g.world.index(p.x,p.y)],1);assert.equal(g.world.count(Mat.Quartz),2);
  g.world.tick=20;g.factory.step();assert.equal(g.world.consolidated[g.world.index(p.x,p.y)],0);assert.equal(g.world.count(Mat.Quartz),2);
 }
});
test('legacy conversion cannot trap the saved player inside an expanded solid module',()=>{
 const g=setup(),m=g.factory.add('block',32,40)!;const raw=JSON.parse(serialize(g));raw.version=4;raw.machines[0].w=4;raw.machines[0].h=4;raw.player.x=38;raw.player.y=47;
 const h=deserialize(JSON.stringify(raw));assert.equal(h.factory.machines.length,0);assert.equal(h.factory.pendingModules.length,1);assert.equal(h.factory.pendingModules[0].machine.id,m.id);assert.equal(blocksPlayer(h.world,38,47),false);assert.deepEqual(deserialize(serialize(h)).factory.pendingModules,h.factory.pendingModules);
});
test('v4 migration preserves terrain, buffered fluids, total construction credit and recoverable modules',()=>{
 const g=setup();const pump=g.factory.add('pump',32,32)!;pump.buffer={material:Mat.Water,count:48,temperature:73};const raw=JSON.parse(serialize(g));raw.version=4;raw.machines[0].w=6;raw.machines[0].h=6;
 raw.machines.push({...raw.machines[0],id:2,kind:'belt',x:64,y:64,w:16,h:3,buffer:undefined});raw.nextId=3;
 // A consolidated cell under the new square prevents conversion without touching it.
 g.world.set(64,68,Mat.Quartz);g.world.consolidated[g.world.index(64,68)]=1;const terrain=JSON.parse(serialize(g)).world;raw.world=terrain;
 const h=deserialize(JSON.stringify(raw));assert.deepEqual(h.world.cells,g.world.cells);assert.deepEqual(h.world.consolidated,g.world.consolidated);assert.ok(h.progress.researched!.includes('vacuum'));
 assert.equal(h.factory.pipes.inspect(1).count,48);assert.ok(h.factory.pendingModules.length);assert.equal([...h.factory.machines,...h.factory.pendingModules.map(p=>p.machine)].filter(m=>m.kind==='belt').reduce((n,m)=>n+m.stockCost!,0),2);
 const pending=h.factory.pendingModules[0];assert.ok(h.factory.restorePending(pending.machine.id,80,80,0));assert.equal(h.factory.restorePending(pending.machine.id,88,80,0),null);
 const round=deserialize(serialize(h));assert.equal(round.factory.pipes.inspect(1).count,48);assert.deepEqual(round.world.cells,h.world.cells);
});
test('whole variable surface is known but connected cavern interiors remain hidden and knowledge unions on load',()=>{
 const w=new World(1024,1536,17);generateTerrain(w);const e=new Exploration(w);e.revealSurface();
 for(let x=0;x<w.width;x++){assert.equal(e.knows(x,0),true);assert.equal(e.knows(x,surfaceAt(w,x)+3),true);assert.equal(e.knows(x,surfaceAt(w,x)+4),false);}
 assert.deepEqual(e.points,[]);const entry=w.generation!.entry;assert.equal(e.knows(entry.x,entry.y+80),false);e.update(entry.x,entry.y+150,[],true);assert.equal(e.knows(0,0),true);
});
test('reference seeds retain byte-identical caves and geological metadata',()=>{
 const expected=['79bf39f266b37cf7235924fb60c009891a01369e2992e86ea65d89fcf8d4451c','bf9ebccb37c03fcd06ed84b635aeb36ff2b67210e0bd5d0605ad6df31a95fab4','749bd71b50f57fda16b2bb554a2d4d484a0912029605a46ac132c867ee0a2fae'];
 for(const [i,seed] of [1,17,73417].entries()){const w=new World(1024,1536,seed);generateTerrain(w);assert.equal(createHash('sha256').update(w.cells).update(w.consolidated).update(JSON.stringify(w.generation)).digest('hex'),expected[i]);}
});
