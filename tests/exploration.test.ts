import test from 'node:test';
import assert from 'node:assert/strict';
import { Exploration, DISCOVERY_RADIUS } from '../src/game/exploration';
import { World } from '../src/sim/world';
import { Mat, materials } from '../src/sim/materials';
import { Factory } from '../src/sim/machines';
import { Player } from '../src/game/player';
import { serialize, deserialize, type Saveable } from '../src/game/save';
import { chambers } from '../src/sim/terrain';
import { Lighting } from '../src/render/lighting';
import { pipeConnections } from '../src/render/sprites';
import { FogBoundary } from '../src/render/fog';

const game=():Saveable=>{
 const world=new World(320,320,128),factory=new Factory(world),player=Object.assign(new Player(),{x:100,y:110});
 const exploration=new Exploration(world);exploration.revealSurface();exploration.update(player.x,player.y);
 return {world,factory,player,exploration,inventory:Array(materials.length).fill(0),progress:{mined:0,mixed:0,crystalsMade:0,tier:1,ruins:false,won:false,elapsed:0,mission:0,researched:[],discovered:[0,1,2,3,4,5]},preferences:{volume:0,shake:false,zoom:3}};
};
test('initial discovery exactly matches the requested world-space circle, including solid terrain',()=>{
 const w=new World(256,256,3);w.cells.fill(Mat.Rock);w.consolidated.fill(1);const e=new Exploration(w);e.update(128.2,129.7);
 for(let y=0;y<w.height;y++)for(let x=0;x<w.width;x++)assert.equal(e.knows(x,y),(x+.5-128.2)**2+(y+.5-129.7)**2<=DISCOVERY_RADIUS**2);
 assert.equal(e.rememberedMaterial[w.index(128,129)],Mat.Rock);
});
test('fast continuous movement unions disks without gaps, while explicit teleport reveals only its destination',()=>{
 const w=new World(1024,320,3),a=new Exploration(w),b=new Exploration(w);a.update(90,150);b.update(90,150);
 a.update(800,150);b.update(800,150,[],true);
 for(let x=90;x<=800;x++)assert.equal(a.knows(x,150),true);
 assert.equal(b.knows(440,150),false);assert.equal(b.knows(800,150),true);assert.equal(b.knows(90,150),true);
});
test('fractional movement reveals the new disk immediately rather than waiting for a whole cell',()=>{
 const e=new Exploration(new World(320,320,3));e.update(100.1,110.1);assert.equal(e.knows(180,110),false);e.update(100.55,110.1);assert.equal(e.knows(180,110),true);
});
test('leaving preserves knowledge and remote changes remain remembered until observed again',()=>{
 const w=new World(512,256,3),e=new Exploration(w);w.set(100,120,Mat.Water);e.update(100,110);e.update(400,110,[],true);
 w.set(100,120,Mat.Sand);w.tick=12;e.update(400,110);
 assert.equal(e.knows(100,120),true);assert.equal(e.rememberedMaterial[w.index(100,120)],Mat.Water);
 e.update(100,110,[],true);assert.equal(e.rememberedMaterial[w.index(100,120)],Mat.Sand);
});
test('static local sources reveal their disk, removal preserves knowledge, and newly enabled sources observe immediately',()=>{
 const w=new World(512,256,5),e=new Exploration(w);e.update(90,110,[{id:1,x:340,y:110,radius:38}]);
 assert.equal(e.knows(377,110),true);assert.equal(e.knows(380,110),false);
 e.update(90,110,[]);assert.equal(e.knows(340,110),true);
 w.set(340,110,Mat.Water);e.update(90,110,[{id:1,x:340,y:110,radius:38}]);assert.equal(e.rememberedMaterial[w.index(340,110)],Mat.Water);
});
test('lamps consume energy only while enabled and remove current lighting when switched off',()=>{
 const w=new World(512,512,5),f=new Factory(w),m=f.add('lamp',340,220)!;f.step();assert.equal(m.status,'Ativa');assert.equal(f.energy.value,159.998);
 const light=new Lighting();light.update(w,90,110,f.machines,300,180,400,270);assert.ok(light.intensity(343,222)>.7);
 m.enabled=false;f.step();assert.equal(f.energy.value,159.998);light.update(w,90,110,f.machines,300,180,400,270);assert.equal(light.intensity(343,222),0);
});
test('illumination attenuates through a solid wall without changing circular discovery',()=>{
 const w=new World(256,256,2),e=new Exploration(w);for(let y=50;y<220;y++){w.set(140,y,Mat.Rock);w.consolidated[w.index(140,y)]=1;}
 e.update(110,150);const light=new Lighting();light.update(w,110,150,[],60,90,210,210);
 assert.equal(e.knows(170,150),true);assert.ok(light.intensity(170,150)<light.intensity(100,150)*.8);
});
test('terrain walls attenuate light even without the consolidated deposit flag',()=>{
 const w=new World(256,256,2);for(let y=50;y<220;y++)for(let x=140;x<146;x++)w.set(x,y,Mat.Rock);
 const light=new Lighting();light.update(w,110,150,[],60,90,210,210);assert.ok(light.intensity(170,150)<.2);assert.ok(light.intensity(130,150)>.7);
});
test('soft boundary affects only known cells and keeps every unknown cell fully opaque',()=>{
 const e=new Exploration(new World(320,320,3));e.update(160,160);const fog=new FogBoundary();fog.update(e,60,60,260,260);
 for(let y=60;y<260;y++)for(let x=60;x<260;x++)if(!e.knows(x,y))assert.equal(fog.strength(x,y),0);
 assert.equal(fog.strength(160,160),1);assert.ok(fog.strength(239,160)>0&&fog.strength(239,160)<1);
});
test('viewport borders do not invent darkness when knowledge continues beyond the screen',()=>{
 const e=new Exploration(new World(320,320,3));e.update(160,160);const fog=new FogBoundary();fog.update(e,130,130,190,190);
 for(let y=130;y<190;y++)for(let x=130;x<190;x++)assert.equal(fog.strength(x,y),1);
});
test('v4 roundtrip retains knowledge, old map information, preferences, points and stable particle variants',()=>{
 const g=game(),e=g.exploration!;g.world.set(112,113,Mat.Gold);e.update(200,110);e.map={x:210,y:130,zoom:3};
 g.world.set(112,113,Mat.Water);const restored=deserialize(serialize(g));
 assert.deepEqual(restored.exploration!.discoveredCells,e.discoveredCells);assert.deepEqual(restored.exploration!.rememberedMaterial,e.rememberedMaterial);
 assert.deepEqual(restored.exploration!.map,e.map);assert.deepEqual(restored.world.visualVariant,g.world.visualVariant);assert.deepEqual(restored.world.backdrop,g.world.backdrop);
});
for(const version of [1,2])test('migration v'+version+' reveals only the player neighborhood and existing machine footprints',()=>{
 const g=game();g.factory.add('belt',270,270);const raw=JSON.parse(serialize(g));raw.machines[0].w=16;raw.machines[0].h=3;raw.version=version;delete raw.exploration;delete raw.world.visualVariant;delete raw.world.backdrop;
 const r=deserialize(JSON.stringify(raw)),e=r.exploration!;assert.equal(e.knows(100,110),true);assert.equal(e.knows(275,271),true);assert.equal(e.knows(230,170),false);assert.equal(e.knows(310,20),true);
 assert.ok(e.discoveredCells.reduce((a,b)=>a+b,0)<320*320*.6);
});
test('discovery names cannot reveal the region and a fresh expedition cannot inherit another map',()=>{
 const g=game();g.exploration!.update(275,275);const r=deserialize(serialize(g));assert.equal(r.progress.discovered!.length,6);assert.equal(r.exploration!.knows(310,20),true);
 const fresh=new Exploration(new World(320,320,128));fresh.update(100,110);assert.equal(fresh.knows(275,275),false);
});
test('cartography rejects malformed lengths, unknown material and concealed chamber markers',()=>{
 const mutations=[(d:any)=>d.exploration.discoveredCells.pop(),(d:any)=>d.exploration.discoveredCells=[2,320*320],(d:any)=>d.exploration.rememberedMaterial=[99,320*320],(d:any)=>d.exploration.width++, (d:any)=>d.exploration.points=['feed'],(d:any)=>d.exploration.map.zoom=99,(d:any)=>delete d.exploration,(d:any)=>d.world.visualVariant=[999,320*320],(d:any)=>d.world.backdrop=[7,320*320]];
 for(const mutate of mutations){const data=JSON.parse(serialize(game()));mutate(data);assert.throws(()=>deserialize(JSON.stringify(data)));}
});
test('unobserved factories keep producing and cannot rewrite remote cartographic memory',()=>{
 const w=new World(512,320,3),f=new Factory(w),s=f.add('sieve',360,220)!,c=f.add('collector',360,240)!,e=new Exploration(w);e.update(80,110);
 w.rng=()=>0;w.set(s.x+4,s.y+4,Mat.WetSand);
 for(let i=0;i<100;i++){f.step();w.step();e.update(80,110);}
 assert.ok(f.gold>0);assert.equal(e.knows(c.x,c.y),false);assert.equal(e.rememberedMaterial[w.index(s.x+6,s.y-1)],Mat.Air);
});
test('particle variants travel through swap and conversion without consuming physics RNG',()=>{
 const w=new World(128,128,9);w.set(50,50,Mat.Sand);const variant=w.visualVariant[w.index(50,50)],rng=w.rngState;
 w.swap(w.index(50,50),w.index(51,51));assert.equal(w.visualVariant[w.index(51,51)],variant);w.set(51,51,Mat.WetSand);assert.equal(w.visualVariant[w.index(51,51)],variant);assert.equal(w.rngState,rng);
});
test('edge changes invalidate adjacent visual chunks without waking physics on presentation-only updates',()=>{
 const w=new World(64,64,4);w.dirty.fill(0);w.active.fill(0);w.markVisualDirty(15,15);
 for(const i of [0,1,4,5])assert.equal(w.dirty[i],1);assert.equal(w.active.some(Boolean),false);
 w.dirty.fill(0);w.set(16,16,Mat.Sand);for(const i of [0,1,4,5])assert.equal(w.dirty[i],1);
});
test('pipe sprite branches agree with the actual fluid adjacency and do not connect sensors',()=>{
 const w=new World(128,128,3),f=new Factory(w),m=f.add('pipe',40,40)!;
 f.add('pipe',32,40);f.add('pump',48,40);f.add('pipe',40,32);f.add('sensor',40,48);
 assert.deepEqual(pipeConnections(m,f.machines),{left:true,right:true,up:true,down:false});assert.equal(f.pipes.inspect(m.id).capacity,48*4);
});
