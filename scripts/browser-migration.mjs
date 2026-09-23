import assert from 'node:assert/strict';

/** A synthetic old file exercises the real import, backup and recovery UI. */
export async function validateModuleMigration(page,{hold,pass}) {
  const previous=await page.evaluate(async()=>{
    const [{World},{Factory},{Player},{Exploration},{serialize}]=await Promise.all([
      import('/src/sim/world.ts'),import('/src/sim/machines.ts'),import('/src/game/player.ts'),import('/src/game/exploration.ts'),import('/src/game/save.ts')]);
    const world=new World(128,128,71),factory=new Factory(world),player=new Player(),exploration=new Exploration(world);
    player.x=24;player.y=90;for(let x=0;x<128;x++)world.set(x,100,15);exploration.update(24,90,[],true);
    const pump=factory.add('pump',32,32);pump.buffer={material:2,count:48,temperature:73};factory.add('belt',64,64);
    world.set(64,68,5);world.consolidated[world.index(64,68)]=1;
    const data=JSON.parse(serialize({world,factory,player,exploration,inventory:Array(22).fill(0),progress:{tier:1,elapsed:0,mission:0,mined:0,mixed:0,crystalsMade:0,ruins:false,won:false,researched:[]},preferences:{volume:0,zoom:3,shake:false}}));
    data.version=4;data.machines[0].w=6;data.machines[0].h=6;data.machines[1].w=16;data.machines[1].h=3;
    return JSON.stringify(data);
  });
  await page.keyboard.press('Escape');
  await page.locator('#save-import').setInputFiles({name:'legacy.prismara',mimeType:'application/json',buffer:Buffer.from(previous)});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent==='Partida importada e validada.');
  const migration=await page.evaluate(async()=>{const {readMigrationBackup}=await import('/src/game/save.ts');const g=__prismara;return {backup:await readMigrationBackup(),pending:g.factory.pendingModules.length,water:g.factory.pipes.inspect(1).count,solid:g.world.consolidated[g.world.index(64,68)],vacuum:g.hasResearch('vacuum'),stock:g.inventory[1]};});
  assert.equal(migration.backup,previous);assert.equal(migration.pending,1);assert.equal(migration.water,48);assert.equal(migration.solid,1);assert.equal(migration.vacuum,true);
  await page.keyboard.press('i');await page.locator('[data-pending]').click();await hold(88,80,100);
  const recovered=await page.evaluate(()=>({pending:__prismara.factory.pendingModules.length,stock:__prismara.inventory[1],placed:__prismara.factory.machines.some(m=>m.id===2&&m.x===88&&m.y===80),water:__prismara.factory.pipes.inspect(1).count}));
  assert.deepEqual(recovered,{pending:0,stock:migration.stock,placed:true,water:48});
  pass('Old file import retains its exact backup, fluids and terrain; pending module repositions through UI at no cost',recovered);
}
