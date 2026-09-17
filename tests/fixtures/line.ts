import { Mat } from '../../src/sim/materials';
import { Factory } from '../../src/sim/machines';
import { World } from '../../src/sim/world';

/** Controlled regression rig: raw consolidated sand and finite water only.
 * Machines are installed once. No feeders, inventory transfers or mutations during operation.
 * The normal-control browser campaign is a separate test in the generated terrain.
 */
export function installLine(world:World,factory:Factory) {
  const drill=factory.add('drill',30,42)!;
  for(const x of [30,46,62,78])if(!factory.add('belt',x,80))throw new Error('Esteira obstruída');
  const sieve=factory.add('sieve',86,84)!;
  const collector=factory.add('collector',88,98)!;
  const pump=factory.add('pump',114,62)!;
  for(const x of [110,106,102,98,94])if(!factory.add('pipe',x,62))throw new Error('Tubo obstruído');
  const valve=factory.add('valve',90,62)!;valve.interval=20;
  if(!drill||!sieve||!collector||!pump||!valve)throw new Error('Geometria da linha obstruída');
  for(let y=50;y<78;y++)for(let x=31;x<41;x++){
    world.set(x,y,Mat.Sand);world.consolidated[world.index(x,y)]=1;
  }
  for(let y=45;y<=73;y++)for(let x=113;x<=148;x++)world.set(x,y,x===113||x===148||y===73?Mat.Earth:y>46?Mat.Water:Mat.Air);
  for(let x=0;x<world.width;x++)world.set(x,190,Mat.Rock);
  factory.energy.value=160;
  return {drill,sieve,collector,pump,valve};
}
