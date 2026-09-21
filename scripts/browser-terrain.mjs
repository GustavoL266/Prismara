import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

export async function validateSurfaceBackground(page,screenshot,pass){
  const result=await page.evaluate(async()=>{
    const g=__prismara,bg=g.renderer.surfaceBackground;await bg.ready;
    const [{surfaceAt,spawnPoint},{serialize,deserialize}]=await Promise.all([import('/src/sim/terrain.ts'),import('/src/game/save.ts')]),spawn=spawnPoint(g.world);
    const before={tick:g.world.tick,rng:g.world.rngState,x:g.player.x,y:g.player.y,known:g.exploration.discoveredCells.reduce((a,b)=>a+b,0)};
    const cases=[
      ['surface',1280,720,3,spawn.x,spawn.y],['crossing',1280,720,4,spawn.x,spawn.y+28],
      ['below',1280,720,2,spawn.x,spawn.y+190],['deep',1280,720,3,spawn.x,720],['return',1280,720,3,spawn.x,spawn.y],['horizontal',1280,720,3,spawn.x+700,spawn.y],
      ...[[1280,720],[1920,1080],[1024,768],[1600,900]].flatMap(([width,height])=>[2,3,4,5].map(zoom=>['matrix',width,height,zoom,spawn.x+zoom*37,spawn.y]))
    ];
    const checks=[];let leaks=0,unfilled=0;
    for(const [name,width,height,zoom,cameraX,cameraY] of cases){
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d',{alpha:false});
      c.fillStyle='#17191d';c.fillRect(0,0,width,height);const ox=width/2-cameraX*zoom,oy=height/2-cameraY*zoom;
      bg.draw(c,g.world,width,height,ox,oy,zoom,cameraX);const pixels=c.getImageData(0,0,width,height).data;let localLeaks=0,localUnfilled=0;
      for(let sy=7;sy<height;sy+=19)for(let sx=7;sx<width;sx+=23){const x=Math.floor((sx-ox)/zoom),boundary=oy+surfaceAt(g.world,x)*zoom,i=(sy*width+sx)*4,base=pixels[i]===23&&pixels[i+1]===25&&pixels[i+2]===29;if(sy>boundary+2){if(!base)localLeaks++;}else if(sy<boundary-2&&base)localUnfilled++;}
      leaks+=localLeaks;unfilled+=localUnfilled;checks.push({name,width,height,zoom,cameraY,drawn:bg.frame.drawn,leaks:localLeaks,unfilled:localUnfilled,ms:bg.frame.ms});
    }
    const raw=serialize(g),surfaceSave=deserialize(raw),deepData=JSON.parse(raw);deepData.player.y=720;const deepSave=deserialize(JSON.stringify(deepData)),saveCanvas=document.createElement('canvas');saveCanvas.width=1280;saveCanvas.height=720;const saveContext=saveCanvas.getContext('2d',{alpha:false}),drawSave=(world,cameraY)=>{saveContext.fillStyle='#17191d';saveContext.fillRect(0,0,1280,720);bg.draw(saveContext,world,1280,720,640-spawn.x*3,360-cameraY*3,3,spawn.x);return bg.frame.drawn;},saves={surface:drawSave(surfaceSave.world,surfaceSave.player.y),deep:drawSave(deepSave.world,deepSave.player.y)};
    const after={tick:g.world.tick,rng:g.world.rngState,x:g.player.x,y:g.player.y,known:g.exploration.discoveredCells.reduce((a,b)=>a+b,0)};
    return {natural:[bg.image.naturalWidth,bg.image.naturalHeight],ratio:bg.image.naturalWidth/bg.image.naturalHeight,cases:checks.length,leaks,unfilled,before,after,maxMs:Math.max(...checks.map(c=>c.ms)),deep:checks.find(c=>c.name==='deep'),saves};
  });
  assert.deepEqual(result.before,result.after,'drawing the surface background must not mutate simulation or discovery');
  assert.equal(result.leaks,0,'surface pixels must never leak below the generated terrain profile');
  assert.equal(result.unfilled,0,'the imported landscape must fill every visible sky sample');
  assert.ok(Math.abs(result.ratio-16/9)<.01,'surface asset must preserve its source aspect ratio');
  assert.equal(result.deep.drawn,false,'deep cameras must skip the landscape entirely');
  assert.deepEqual(result.saves,{surface:true,deep:false},'loaded surface and deep saves must choose the correct background');
  pass('Imported landscape is clipped to the real procedural surface without underground leakage',result);
  await screenshot('14-fundo-superficie');
}

export async function traverseGeneratedGallery(page,screenshot,pass){
  const route=await page.evaluate(async()=>{
    const g=__prismara,{playerClearance}=await import('/src/sim/terrain-access.ts'),{chambers}=await import('/src/sim/terrain.ts'),mask=playerClearance(g.world),width=g.world.width,height=g.world.height;
    const start=g.world.index(Math.round(g.player.x),Math.round(g.player.y)),room=chambers(g.world).find(c=>c.id==='drain'),goal=g.world.index(room.x-20,room.y-4),parent=new Int32Array(mask.length);parent.fill(-1);const queue=new Int32Array(mask.length);let end=0;queue[end++]=start;parent[start]=start;
    for(let head=0;head<end&&parent[goal]<0;head++){const i=queue[head],x=i%width,y=Math.floor(i/width);for(const j of [x?i-1:-1,x<width-1?i+1:-1,y?i-width:-1,y<height-1?i+width:-1])if(j>=0&&mask[j]&&parent[j]<0){parent[j]=i;queue[end++]=j;}}
    if(parent[goal]<0)throw Error('Generated drain chamber has no player-body route');const path=[];for(let i=goal;;i=parent[i]){path.push({x:i%width,y:Math.floor(i/width)});if(i===start)break;}path.reverse();const waypoints=[];let last=path[0],direction='';for(let n=1;n<path.length;n++){const dx=path[n].x-path[n-1].x,dy=path[n].y-path[n-1].y,nextDirection=`${dx},${dy}`;if(nextDirection!==direction||Math.abs(path[n].x-last.x)+Math.abs(path[n].y-last.y)>=9){waypoints.push(path[n]);last=path[n];direction=nextDirection;}}if(waypoints.at(-1)!==path.at(-1))waypoints.push(path.at(-1));return {target:room,pathCells:path.length,waypoints};
  });
  let index=0,lastProgress=Date.now(),best=Infinity;const captured=new Set(),started=Date.now();
  while(index<route.waypoints.length&&Date.now()-started<105000){
    const p=await page.evaluate(()=>({x:__prismara.player.x,y:__prismara.player.y,fuel:__prismara.player.fuel})),target=route.waypoints[index],distance=Math.hypot(target.x-p.x,target.y-p.y);
    if(distance<8){index++;lastProgress=Date.now();best=Infinity;continue;}if(distance<best-1){best=distance;lastProgress=Date.now();}
    for(const depth of [300,450,600])if(p.y>=depth&&!captured.has(depth)){captured.add(depth);await screenshot('15-percurso-'+depth);}
    const stalled=Date.now()-lastProgress;let horizontal=target.x>p.x+.25?'d':target.x<p.x-.25?'a':null;if(!horizontal&&target.y>p.y+2&&stalled>1200){const next=route.waypoints[Math.min(index+1,route.waypoints.length-1)];horizontal=next.x>=p.x?'d':'a';}const needsLift=target.y<p.y-2;
    if(horizontal)await page.keyboard.down(horizontal);if(needsLift&&p.fuel>8)await page.keyboard.down('Space');await delay(95);if(needsLift)await page.keyboard.up('Space');if(horizontal)await page.keyboard.up(horizontal);await delay(needsLift?35:20);
    if(Date.now()-lastProgress>9000)throw Error('Normal controls became stuck near '+JSON.stringify({p,target,index}));
  }
  const end=await page.evaluate(()=>({x:__prismara.player.x,y:__prismara.player.y,known:__prismara.exploration.discoveredCells.reduce((a,b)=>a+b,0)}));
  assert.equal(index,route.waypoints.length,'normal controls must complete the generated route');assert.ok(end.y>500,'normal controls must reach the deep connected chamber');
  await screenshot('04-exploracao');await screenshot('16-fundo-subterraneo');pass('Normal controls traverse the generated body-clearance route to a deep chamber',{route:{target:route.target,pathCells:route.pathCells,waypoints:route.waypoints.length},end,wallSeconds:(Date.now()-started)/1000,captured:[...captured]});
}
