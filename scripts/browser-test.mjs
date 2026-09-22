import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {cpus,totalmem,platform,release} from 'node:os';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {validateExploration} from './browser-exploration.mjs';
import {traverseGeneratedGallery,validateSurfaceBackground} from './browser-terrain.mjs';

const origin=process.env.PRISMARA_TEST_URL??'http://127.0.0.1:5173',artifacts=resolve('.local/browser');
const chrome=process.env.CHROME_PATH??(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':undefined);
const report={startedAt:new Date().toISOString(),environment:{os:platform()+' '+release(),node:process.version,cpu:cpus()[0]?.model,ramGiB:totalmem()/1024**3},checks:[],consoleErrors:[],screenshots:[]};
mkdirSync(artifacts,{recursive:true});let server,browser,page;
const pass=(name,detail)=>{report.checks.push({name,detail});console.log('PASS '+name+(detail?': '+JSON.stringify(detail):''));};
const ready=async()=>{try{return (await fetch(origin)).ok;}catch{return false;}};
const screenshot=async(scene)=>{for(const [width,height] of [[1280,720],[1920,1080]]){await page.setViewportSize({width,height});await delay(350);const name=scene+'-'+width+'.png';await page.screenshot({path:resolve(artifacts,name)});report.screenshots.push(name);}await page.setViewportSize({width:1280,height:720});await delay(150);};
const hold=async(x,y,ms=450)=>{
  const p=await page.evaluate(({x,y})=>window.__prismara.renderer.screenPoint(x+.5,y+.5),{x,y});
  await page.mouse.move(p.x,p.y);await page.mouse.down();await delay(ms);await page.mouse.up();await delay(100);
};
const inventory=()=>page.evaluate(()=>[...window.__prismara.inventory]);
const build=async(kind,x,y)=>{
  await page.keyboard.press('b');await page.locator('[data-machine="'+kind+'"]').click();await delay(100);await hold(x,y,100);
  await page.waitForFunction(({kind,x,y})=>window.__prismara.factory.machines.some(m=>m.kind===kind&&m.x===x&&m.y===y),{kind,x,y},{timeout:2500});
  return page.evaluate(({kind,x,y})=>window.__prismara.factory.machines.find(m=>m.kind===kind&&m.x===x&&m.y===y).id,{kind,x,y});
};
const material=async(mat)=>{await page.keyboard.press('i');await page.locator('[data-material="'+mat+'"]').click();await delay(60);};
const dragArea=async(x,y,endX,endY,remove=false)=>{
  const points=await page.evaluate(({x,y,endX,endY})=>({a:__prismara.renderer.screenPoint(x,y),b:__prismara.renderer.screenPoint(endX,endY)}),{x,y,endX,endY});
  if(remove)await page.keyboard.down('Shift');await page.mouse.move(points.a.x,points.a.y);await page.mouse.down({button:remove?'right':'left'});await delay(120);await page.mouse.move(points.b.x,points.b.y,{steps:8});await delay(150);await page.mouse.up({button:remove?'right':'left'});if(remove)await page.keyboard.up('Shift');await delay(180);
};
const assertHUD=async()=>{
  const boxes=await page.evaluate(()=>[...document.querySelectorAll('#hud .resource-strip,#hud .shortcuts,#hud .objectives,#hud .map-panel,#hud .dock,#hud .inspector')].filter(el=>!el.classList.contains('hidden')).map(el=>{const r=el.getBoundingClientRect();return {name:el.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(const b of boxes)assert.ok(b.x>=-1&&b.y>=-1&&b.right<=page.viewportSize().width+1&&b.bottom<=page.viewportSize().height+1,'HUD out of view '+JSON.stringify(b));
  const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(overlaps(boxes[i],boxes[j]),false,'Overlapping panels '+boxes[i].name+' / '+boxes[j].name);
  return boxes;
};
try{
  if(!await ready()){server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:5173,strictPort:true}});await server.listen();for(let i=0;i<100&&!await ready();i++)await delay(100);assert.ok(await ready(),'Vite unavailable');}
  browser=await chromium.launch({headless:true,...(chrome&&existsSync(chrome)?{executablePath:chrome}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce',acceptDownloads:true});page=await context.newPage();
  report.environment.browser=browser.version();
  page.on('pageerror',e=>report.consoleErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  await page.goto(origin+'/?test=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.__prismara));
  assert.equal(await page.locator('.start-logo').textContent(),'PRISMARA');await screenshot('00-menu');
  await page.locator('#save-import').setInputFiles({name:'invalid.prismara',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await page.waitForFunction(()=>document.querySelector('#modal-feedback')?.textContent?.startsWith('Importação recusada:'));
  assert.equal(await page.locator('#modal-feedback').isVisible(),true);assert.equal(await page.evaluate(()=>__prismara.started),false);pass('Invalid portable import reports its reason inside the start menu and leaves the world untouched');
  await page.locator('#seed').fill('91207');await page.locator('[data-action="new"]').click();await delay(1100);
  await screenshot('01-inicio');pass('New seeded deep world through normal menu',{dimensions:await page.evaluate(()=>[__prismara.world.width,__prismara.world.height])});
  await validateSurfaceBackground(page,screenshot,pass);
  const position=()=>page.evaluate(()=>({x:__prismara.player.x,y:__prismara.player.y,fuel:__prismara.player.fuel}));
  const start=await position();await page.keyboard.down('d');await delay(500);await page.keyboard.up('d');const moved=await position();assert.ok(moved.x>start.x+8);
  await page.keyboard.down('a');await delay(200);await page.keyboard.up('a');await page.keyboard.down('Space');await delay(400);await page.keyboard.up('Space');
  const flew=await position();assert.ok(flew.y<start.y-5&&flew.fuel<100);await delay(1200);pass('Normal movement and propulsion',{start,moved,flew});
  for(const x of [152,159,166]){
    const before=(await inventory())[1];await page.keyboard.press('1');await hold(x,175,400);
    assert.equal((await inventory())[1],before,'digging must leave particles in world');
    await page.keyboard.press('2');await hold(x,175,450);assert.ok((await inventory())[1]>before,'aspiration must collect released grains');
  }
  pass('Dig releases real terrain; separate normal aspiration collects grains',{sand:(await inventory())[1]});
  const sieve=await build('sieve',166,128);const collector=await build('collector',168,146);await build('belt',190,128);
  await page.keyboard.down('d');await delay(500);await page.keyboard.up('d');await delay(500);
  // Mix in the finite natural basin first; no assigned particles, inventory or recipe counters.
  await material(1);await hold(207,165,1050);await delay(2400);
  assert.ok(await page.evaluate(()=>__prismara.world.reactionCounts.wet>=40));
  await material(17);await page.keyboard.press('2');await page.keyboard.down('Shift');
  for(const x of [198,204,210,216])await hold(x,175,500);
  await page.keyboard.up('Shift');
  for(let attempt=0;attempt<4&&(await inventory())[17]<35;attempt++){
    const pockets=await page.evaluate(()=>{const g=__prismara,bins=new Map();for(let y=150;y<=205;y++)for(let x=190;x<=226;x++)if(g.world.get(x,y)===17&&Math.hypot(x-g.player.x,y-g.player.y)<=g.reach-3){const key=`${Math.floor(x/5)},${Math.floor(y/5)}`,bin=bins.get(key)??{x:0,y:0,count:0};bin.x+=x;bin.y+=y;bin.count++;bins.set(key,bin);}return [...bins.values()].sort((a,b)=>b.count-a.count).slice(0,12).map(b=>({x:Math.round(b.x/b.count),y:Math.round(b.y/b.count)}));});
    if(pockets.length){await page.keyboard.press('2');await page.keyboard.down('Shift');for(const p of pockets){if((await inventory())[17]>=35)break;await hold(p.x,p.y,220);}await page.keyboard.up('Shift');}
    if((await inventory())[17]<35){await material(1);await hold(207,165,700);await delay(1400);await material(17);}
  }
  assert.ok((await inventory())[17]>=35,'normal basin must provide enough wet sand');
  const wet=(await inventory())[17];await material(17);await hold(177,124,Math.ceil(wet/60*1000)+300);await delay(4000);
  // Small batches have variable mineral yield. Replenish by the same normal actions if needed.
  for(let batch=0;batch<3&&await page.evaluate(()=>__prismara.factory.gold)<6;batch++){
    await material(1);await hold(207,165,800);await delay(1800);await material(17);await page.keyboard.press('2');await page.keyboard.down('Shift');
    for(const x of [198,204,210,216])await hold(x,175,500);await page.keyboard.up('Shift');
    const more=(await inventory())[17];assert.ok(more>0);await material(17);await hold(177,124,Math.ceil(more/60*1000)+300);await delay(3500);
  }
  const first=await page.evaluate(()=>({gold:__prismara.factory.gold,wet:__prismara.factory.counters.wet,elapsed:__prismara.progress.elapsed,mined:__prismara.progress.mined}));
  assert.ok(first.gold>=6,'first physical gold should finance hydraulics');assert.ok(first.elapsed<180,'first gold target: under three minutes with normal controls');
  pass('Fresh normal-control campaign produces spendable gold without inspector feeds',first);
  await page.keyboard.press('1');await hold(175,150,80);await screenshot('02-primeira-fabrica');
  await page.keyboard.press('t');await screenshot('05-pesquisa');
  const goldBefore=await page.evaluate(()=>__prismara.factory.gold);await page.locator('[data-research="liquids"]').click();
  assert.equal(await page.evaluate(()=>__prismara.factory.gold),goldBefore-6);await page.keyboard.press('Escape');
  pass('Normal gold-funded research unlocks an independent liquids branch');
  // Explore the group placement footprint using movement before building there.
  await page.keyboard.down('d');await page.keyboard.down('Space');await delay(1500);await page.keyboard.up('d');await page.keyboard.up('Space');
  await page.keyboard.down('a');await delay(1500);await page.keyboard.up('a');await delay(1800);
  await delay(1400);const sandBeforeCopy=(await inventory())[1];await page.keyboard.press('5');await dragArea(164,126,188,160);
  assert.equal(await page.evaluate(()=>__prismara.selection.size),2);await page.keyboard.press('c');await page.keyboard.press('v');await hold(250,108,100);
  assert.ok(await page.evaluate(()=>__prismara.factory.machines.some(m=>m.kind==='sieve'&&m.x===250&&m.y===108)));assert.equal((await inventory())[1],sandBeforeCopy-10);
  await dragArea(248,106,278,142,true);assert.equal((await inventory())[1],sandBeforeCopy);
  await page.keyboard.press('b');await page.locator('[data-machine="wall"]').click();await page.keyboard.press('r');await hold(250,106,100);
  const rotated=await page.evaluate(()=>__prismara.factory.machines.find(m=>m.kind==='wall'&&m.x===250&&m.y===106));assert.equal(rotated.rotation,1);assert.deepEqual([rotated.w,rotated.h],[16,2]);
  await dragArea(248,104,268,112,true);assert.equal((await inventory())[1],sandBeforeCopy);pass('Normal area selection, configuration copy, paid group placement, rotation and removal preserve resources');
  // Reserve actual mined construction stock after any extra wetting batch.
  for(const x of [152,159,166])if((await inventory())[1]<32){await page.keyboard.press('1');await hold(x,184,400);await page.keyboard.press('2');await hold(x,184,500);}
  assert.ok((await inventory())[1]>=24);await delay(1200);await build('pump',196,166);
  for(const x of [192,188,184,180,176])await build('pipe',x,166);
  for(let y=162;y>=122;y-=4)await build('pipe',176,y);
  await build('valve',176,118);
  await screenshot('03-fabrica-etapas');
  const net=await page.evaluate(()=>__prismara.factory.pipes.inspect(__prismara.factory.machines.find(m=>m.kind==='pump').id));
  assert.ok(net.capacity>=48*18);pass('Normal construction makes a connected physical hydraulic network',net);
  for(const [width,height] of [[1280,720],[1920,1080]]){await page.setViewportSize({width,height});await delay(200);pass('HUD fits without overlaps '+width+'x'+height,await assertHUD());}
  await page.setViewportSize({width:1280,height:720});
  // Pause, export, and restore from IndexedDB: exact snapshot before the first resumed tick.
  await page.keyboard.press('Escape');await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>__prismara.saveLabel==='Salvo neste navegador');
  const snapshot=await page.evaluate(async()=>{const {readSave}=await import('/src/game/save.ts');return await readSave();});
  const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const exported=await download;assert.ok(exported.suggestedFilename().endsWith('.prismara'));await exported.saveAs(resolve(artifacts,'export.prismara'));
  const before=JSON.parse(snapshot);await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>__prismara.started);await page.keyboard.press('Escape');
  const after=await page.evaluate(()=>({gold:__prismara.factory.gold,inventory:__prismara.inventory,research:__prismara.progress.researched,machines:__prismara.factory.machines.length}));
  assert.equal(after.gold,before.credits.gold);assert.deepEqual(after.inventory,before.inventory);assert.deepEqual(after.research,before.progress.researched);assert.equal(after.machines,before.machines.length);
  pass('Async save, reload, Continue and portable export preserve progress and inventory',after);
  await page.locator('#save-import').setInputFiles(resolve(artifacts,'export.prismara'));await page.waitForFunction(()=>document.querySelector('#toast')?.textContent==='Partida importada e validada.');await page.keyboard.press('Escape');
  const imported=await page.evaluate(()=>({gold:__prismara.factory.gold,inventory:__prismara.inventory,research:__prismara.progress.researched,machines:__prismara.factory.machines.length}));assert.deepEqual(imported,after);pass('Portable file import restores the exported physical installation');
  await page.locator('#ui-scale').focus();await page.keyboard.press('End');await page.keyboard.press('Escape');await delay(200);await page.keyboard.press('1');await hold(175,150,80);pass('Maximum UI scale with contextual inspector stays in view',await assertHUD());
  // Independent automation rig on a full-size world. Installed once; raw materials only.
  await page.evaluate(async()=>{
    const [{World},{Factory},{installLine},{Exploration}]=await Promise.all([import('/src/sim/world.ts'),import('/src/sim/machines.ts'),import('/tests/fixtures/line.ts'),import('/src/game/exploration.ts')]);
    const g=__prismara;g.world=new World(1024,1536,91207);g.factory=new Factory(g.world);installLine(g.world,g.factory);
    g.inventory.fill(0);g.progress.elapsed=0;g.progress.researched=['processing','transport','liquids','heat','automation'];g.progress.discovered=[0];g.progress.solved=[];g.progress.visited=[];g.progress.chamberFeed=0;g.progress.mission=0;
    g.factory.add('platform',68,115);g.factory.add('lamp',44,38);g.factory.add('lamp',150,80);
    g.player.x=80;g.player.y=114;g.player.vx=0;g.player.vy=0;g.exploration=new Exploration(g.world);g.exploration.update(80,114,[],true);
    g.renderer.follow=false;g.renderer.camera.x=110;g.renderer.camera.y=102;g.renderer.camera.zoom=3;g.renderer.invalidate();g.preferences.uiScale=1;g.selectedId=0;g.selection.clear();g.input.release();g.setPanel(null);
    window.__autonomousStart={tick:g.world.tick,wall:performance.now()};
  });
  const samples=[];
  for(let checkpoint=1;checkpoint<=6;checkpoint++){
    await page.waitForFunction(target=>__prismara.world.tick-__autonomousStart.tick>=target,checkpoint*900,{timeout:45000});
    const sample=await page.evaluate(()=>({tick:__prismara.world.tick,gold:__prismara.factory.gold,mined:__prismara.factory.counters.mined,wet:__prismara.factory.counters.wet,fps:__prismara.fps,simMs:__prismara.simulationMs,renderMs:__prismara.renderMs,discoveryMs:__prismara.exploration.updateMs,lightingMs:__prismara.renderer.lighting.updateMs}));samples.push(sample);
    console.log('AUTONOMOUS '+checkpoint*30+' s: '+JSON.stringify(sample));
    if(checkpoint===2)await screenshot('06-linha-autonoma');
  }
  assert.ok(samples.every((n,i)=>i===0||n.gold>samples[i-1].gold));assert.ok(samples.at(-1).gold>40&&samples.at(-1).mined>=265);
  await page.waitForFunction(()=>performance.now()-__autonomousStart.wall>=180000,undefined,{timeout:5000});
  const duration=await page.evaluate(()=>({wallSeconds:(performance.now()-__autonomousStart.wall)/1000,simSeconds:(__prismara.world.tick-__autonomousStart.tick)/30,heapBytes:performance.memory?.usedJSHeapSize}));
  assert.ok(duration.wallSeconds>=180);pass('At least three wall-clock minutes of unattended physical mining through collection',{duration,samples});
  report.autonomous={duration,samples};
  const advanced=await page.evaluate(async()=>{
    const [{World},{Factory},{installAdvancedLine},{Exploration}]=await Promise.all([import('/src/sim/world.ts'),import('/src/sim/machines.ts'),import('/tests/fixtures/advanced.ts'),import('/src/game/exploration.ts')]);
    const g=__prismara;g.setPanel('pause');g.world=new World(1024,1536,91207);g.factory=new Factory(g.world);installAdvancedLine(g.world,g.factory);
    for(let i=0;i<5400;i++){g.factory.step();g.world.step();}
    g.factory.add('lamp',44,38);g.factory.add('lamp',150,80);g.factory.add('lamp',160,150);
    g.progress.researched=['processing','transport','liquids','heat','glass','automation'];g.player.x=163;g.player.y=189;g.exploration=new Exploration(g.world);g.exploration.update(95,100,[],true);g.exploration.update(g.player.x,g.player.y);
    g.renderer.camera.x=120;g.renderer.camera.y=116;g.renderer.invalidate();g.setPanel(null);
    return {counters:g.factory.counters,gold:g.factory.gold,crystals:g.factory.crystals};
  });
  assert.ok(advanced.crystals>=8&&advanced.counters.impacts>=30);await screenshot('07-industria-avancada');pass('Physical advanced factory with impact energy, ceramics, molten glass and rare collection',advanced);
  // Actual generated subterranean rendering; follow the generated player-body route with normal controls.
  await page.evaluate(()=>{__prismara.newWorld(91207);__prismara.preferences.uiScale=1;});
  await traverseGeneratedGallery(page,screenshot,pass);
  await validateExploration(page,screenshot,pass);
  assert.deepEqual(report.consoleErrors,[]);pass('No browser JavaScript or console errors');report.ok=true;
}catch(error){
  report.ok=false;report.error=error.stack??String(error);console.error(error);process.exitCode=1;
  if(page){await page.screenshot({path:resolve(artifacts,'failure.png')}).catch(()=>{});report.debug=await page.evaluate(()=>window.__prismara?{panel:__prismara.panel,inventory:__prismara.inventory,progress:__prismara.progress,counters:__prismara.factory.counters,gold:__prismara.factory.gold,machines:__prismara.factory.machines,toast:document.getElementById('toast')?.textContent}:null).catch(()=>null);}
}finally{report.finishedAt=new Date().toISOString();writeFileSync(resolve(artifacts,'report.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close();console.log('Browser evidence: '+artifacts);}
