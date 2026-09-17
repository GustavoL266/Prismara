import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

export async function validateExploration(page,screenshot,pass){
  await page.keyboard.press('m');await screenshot('08-mapa-percurso');await page.keyboard.press('m');
  // Pause the physical scene while exercising camera and UI; canvas pixels exclude HTML panels.
  const before=await page.evaluate(()=>{
    const g=__prismara;g.setPanel('pause');document.querySelector('#modal-root').innerHTML='';
    return {known:g.exploration.discoveredCells.reduce((a,b)=>a+b,0),x:g.player.x,y:g.player.y};
  });
  for(const zoom of [2,3,4]){
    await page.evaluate(zoom=>{const g=__prismara;g.renderer.follow=false;g.renderer.camera.x=900;g.renderer.camera.y=1200;g.renderer.camera.zoom=zoom;},zoom);
    for(const [width,height] of [[1280,720],[1920,1080]]){
      await page.setViewportSize({width,height});await delay(120);
      const result=await page.evaluate(()=>{
        const g=__prismara,c=g.renderer.ctx,d=c.getImageData(0,0,g.renderer.canvas.width,g.renderer.canvas.height).data;
        let colored=0;for(let i=0;i<d.length;i+=4)if(d[i]||d[i+1]||d[i+2])colored++;
        return {colored,known:g.exploration.discoveredCells.reduce((a,b)=>a+b,0)};
      });
      assert.equal(result.colored,0,'undiscovered world is opaque black including effects and decoration');assert.equal(result.known,before.known);
    }
  }
  await page.setViewportSize({width:1280,height:720});
  const hidden=await page.evaluate(()=>{
    const g=__prismara,m=g.factory.add('sensor',900,1200);g.selectedId=m.id;g.ui.update(true);
    const blocked=g.place('block',800,1200,0,false)===null;
    const result={blocked,inspect:g.selectedMachine()===undefined,hit:g.machineAt(900,1200)===undefined,inspector:document.querySelector('#inspector').classList.contains('hidden')};
    g.factory.remove(m.id);g.selectedId=0;return result;
  });assert.deepEqual(hidden,{blocked:true,inspect:true,hit:true,inspector:true});
  pass('Exploration stays independent of zoom, camera, resolution and hidden machine overlays',{before,zooms:[2,3,4],resolutions:[[1280,720],[1920,1080]],hidden});

  const restored=await page.evaluate(async()=>{
    const {serialize,deserialize}=await import('/src/game/save.ts'),g=__prismara,raw=serialize(g),r=deserialize(raw);
    const equal=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
    return {version:JSON.parse(raw).version,mask:equal(g.exploration.discoveredCells,r.exploration.discoveredCells),memory:equal(g.exploration.rememberedMaterial,r.exploration.rememberedMaterial),variants:equal(g.world.visualVariant,r.world.visualVariant),map:JSON.stringify(g.exploration.map)===JSON.stringify(r.exploration.map)};
  });assert.deepEqual(restored,{version:3,mask:true,memory:true,variants:true,map:true});pass('Portable v3 snapshot preserves discovery and last observation exactly',restored);

  // Controlled lamp rig: placement is made inside the actual initial player disk.
  const lamp=await page.evaluate(async()=>{
    const [{World},{Factory},{Exploration}]=await Promise.all([import('/src/sim/world.ts'),import('/src/sim/machines.ts'),import('/src/game/exploration.ts')]);
    const g=__prismara;g.world=new World(1024,1536,18);g.world.backdrop.fill(3);g.factory=new Factory(g.world);g.exploration=new Exploration(g.world);g.player.x=100;g.player.y=300;g.progress.researched=['tools','exploration'];g.inventory[1]=100;
    g.exploration.update(100,300,[],true);const initial=g.exploration.discoveredCells.reduce((a,b)=>a+b,0),m=g.place('lamp',172,300,0,false);if(!m)throw Error('Legitimate local lamp placement failed');
    g.factory.step();g.exploration.update(100,300,[{id:m.id,x:m.x+3,y:m.y+3,radius:38}]);
    for(let x=80;x<214;x++)g.world.set(x,320,15);
    g.factory.add('belt',182,308);g.factory.add('collector',190,322);
    g.renderer.camera.x=145;g.renderer.camera.y=300;g.renderer.camera.zoom=4;g.renderer.follow=false;g.renderer.invalidate();g.ui.update(true);
    return {id:m.id,initial,known:g.exploration.discoveredCells.reduce((a,b)=>a+b,0)};
  });assert.ok(lamp.known>lamp.initial);await screenshot('09-luminarias');
  const on=await page.evaluate(()=>__prismara.renderer.lighting.intensity(175,302));assert.ok(on>.7);
  await page.evaluate(id=>{__prismara.factory.remove(id);__prismara.renderer.invalidate();},lamp.id);await delay(120);
  const off=await page.evaluate(()=>({light:__prismara.renderer.lighting.intensity(175,302),known:__prismara.exploration.discoveredCells.reduce((a,b)=>a+b,0)}));
  assert.equal(off.light,0);assert.equal(off.known,lamp.known);pass('Legitimately placed lamp reveals locally; removal removes light and retains knowledge',{on,off});

  // Seeded physical ruins, before and after an explicit test teleport (no fictitious corridor).
  const room=await page.evaluate(async()=>{
    const {chambers}=await import('/src/sim/terrain.ts'),g=__prismara;g.newWorld(91207);g.setPanel('pause');document.querySelector('#modal-root').innerHTML='';const room=chambers(g.world)[0];
    g.renderer.follow=false;g.renderer.camera.x=room.x;g.renderer.camera.y=room.y-22;g.renderer.camera.zoom=4;g.renderer.invalidate();return room;
  });await screenshot('10-arquivo-desconhecido');
  assert.equal(await page.evaluate(()=>__prismara.exploration.points.length),0);
  await page.evaluate(room=>{const g=__prismara;g.player.x=room.x;g.player.y=room.y-22;g.exploration.update(g.player.x,g.player.y,[],true);g.renderer.invalidate();},room);
  await screenshot('11-arquivo-descoberto');assert.ok(await page.evaluate(()=>__prismara.exploration.points.includes('drain')));
  pass('Ancient room markers appear only after their cells are discovered');

  const groups=[['transporte',['belt','fastbelt','hauler','sieve','filter','lift','launcher']],['processamento',['separator','kiln','press','crucible','heater','crusher','mist','collector','vault']],['estruturas',['block','platform','wall','funnel','gate','sensor','lamp','pump','pipe','valve']]];
  for(const [group,kinds] of groups){
    await page.evaluate(async(kinds)=>{
      const [{World},{Factory},{Exploration},{MACHINE_DEFS}]=await Promise.all([import('/src/sim/world.ts'),import('/src/sim/machines.ts'),import('/src/game/exploration.ts'),import('/src/sim/machines.ts')]);
      const g=__prismara;g.world=new World(1024,1536,29);g.world.backdrop.fill(3);g.factory=new Factory(g.world);g.exploration=new Exploration(g.world);g.selection.clear();g.selectedId=0;
      for(let row=0;row<kinds.length;row++)for(let state=0;state<3;state++){
        const kind=kinds[row],m=g.factory.add(kind,100+state*85,230+row*29);if(!m)throw Error('Gallery overlap '+kind);
        m.enabled=state!==0;m.status=state===1?'Ativa':state===2?'Saída bloqueada':'Desligada';m.flash=state!==2?14:0;
        g.world.set(m.x+Math.floor(m.w/2),m.y-1,kind==='sieve'?17:kind==='collector'?18:kind==='kiln'?4:kind==='crucible'?5:1);
        if(state===2)for(let dx=2;dx<Math.min(m.w-2,8);dx++)for(let dy=1;dy<3;dy++)g.world.set(m.x+dx,m.y-dy,1);
      }
      for(let row=0;row<kinds.length;row++)for(const x of [90,175,260]){const m=g.factory.add('lamp',x,237+row*29);m.status='Ativa';g.exploration.reveal(x+3,m.y+3,80);}
      g.exploration.points=[];g.player.x=210;g.player.y=230+kinds.length*14.5;g.renderer.camera.x=210;g.renderer.camera.y=g.player.y;g.renderer.camera.zoom=2;g.renderer.follow=false;g.renderer.invalidate();g.ui.update(true);
    },kinds);
    await screenshot('12-galeria-'+group);
    if(group==='transporte')for(const zoom of [3,4]){await page.evaluate(zoom=>{__prismara.renderer.camera.zoom=zoom;__prismara.renderer.invalidate();},zoom);await screenshot('12-galeria-transporte-'+zoom+'x');}
  }
  pass('Own industrial sprites inspected in disabled, operating and obstructed gallery states',{groups:groups.map(([name,kinds])=>({name,kinds})),states:['Desligada','Ativa','Saída bloqueada']});

  await page.evaluate(async()=>{
    const [{World},{Factory},{Exploration}]=await Promise.all([import('/src/sim/world.ts'),import('/src/sim/machines.ts'),import('/src/game/exploration.ts')]);
    const g=__prismara;g.world=new World(1024,1536,29);g.world.backdrop.fill(3);g.factory=new Factory(g.world);g.exploration=new Exploration(g.world);
    for(let n=0;n<9;n++){const mat=[1,2,17,3,18,19,20,9,8][n],left=100+n*24;
      for(let y=300;y<=335;y++)for(let x=left;x<=left+18;x++)if(x===left||x===left+18||y===335)g.world.set(x,y,15);else if(y>321-(n%3)*3)g.world.set(x,y,mat,mat===8?1100:24);
      g.world.set(left+9,285,mat,mat===8?1100:24);
    }
    for(const y of [282,345])for(const x of [90,165,235,312]){const m=g.factory.add('lamp',x,y);if(!m)throw Error('Material gallery lamp would overwrite occupied cells');m.status='Ativa';g.exploration.reveal(x,315,80);}
    g.player.x=210;g.player.y=355;g.renderer.camera.x=210;g.renderer.camera.y=315;g.renderer.follow=false;g.renderer.invalidate();g.ui.update(true);
  });
  for(const zoom of [2,3,4]){await page.evaluate(zoom=>{__prismara.renderer.camera.zoom=zoom;__prismara.renderer.invalidate();},zoom);await screenshot('13-materiais-'+zoom+'x');}
  pass('Real occupied cells show isolated grains, cohesive piles and reservoirs at 2x, 3x and 4x');
}
