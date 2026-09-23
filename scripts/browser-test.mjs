import {manualCampaign} from './browser-manual.mjs';
import {validateModuleMigration} from './browser-migration.mjs';
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
  await manualCampaign(page,{build,hold,dragArea,screenshot,pass,assertHUD,artifacts});
  const campaignSave=await page.evaluate(async()=>{const {readSave}=await import('/src/game/save.ts');return await readSave();});
  if(!process.env.PRISMARA_BOOTSTRAP_ONLY){
  await validateModuleMigration(page,{hold,pass});
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
  await page.evaluate(raw=>{__prismara.restore(raw);__prismara.preferences.uiScale=1;},campaignSave);
  await validateExploration(page,screenshot,pass);
  }
  assert.deepEqual(report.consoleErrors,[]);pass('No browser JavaScript or console errors');report.ok=true;
}catch(error){
  report.ok=false;report.error=error.stack??String(error);console.error(error);process.exitCode=1;
  if(page){await page.screenshot({path:resolve(artifacts,'failure.png')}).catch(()=>{});report.debug=await page.evaluate(()=>window.__prismara?{panel:__prismara.panel,inventory:__prismara.inventory,progress:__prismara.progress,counters:__prismara.factory.counters,gold:__prismara.factory.gold,machines:__prismara.factory.machines,toast:document.getElementById('toast')?.textContent}:null).catch(()=>null);}
}finally{report.finishedAt=new Date().toISOString();writeFileSync(resolve(artifacts,'report.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close();console.log('Browser evidence: '+artifacts);}
