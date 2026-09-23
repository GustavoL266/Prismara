import {Mat} from '../../src/sim/materials';
import {Factory} from '../../src/sim/machines';
import {World} from '../../src/sim/world';
/** Finite, physical regression installation; no injected inputs while operating. */
export function installLine(world:World,factory:Factory){
 const drill=factory.add('drill',32,24)!;
 for(let x=32;x<88;x+=8)if(!factory.add('belt',x,80))throw new Error('Esteira obstruída');
 const sieve=factory.add('sieve',88,80)!,collector=factory.add('collector',88,96)!;
 const pump=factory.add('pump',128,72)!;
 factory.add('pipe',128,56);factory.add('pipe',128,64);
 for(let x=72;x<128;x+=8)if(!factory.add('pipe',x,56))throw new Error('Tubo obstruído');
 const valve=factory.add('valve',64,56)!;valve.interval=20;
 if(!drill||!sieve||!collector||!pump||!valve)throw new Error('Geometria da linha obstruída');
 for(let y=32;y<80;y++)for(let x=33;x<39;x++){world.set(x,y,Mat.Sand);world.consolidated[world.index(x,y)]=1;}
 for(let y=40;y<=73;y++)for(let x=127;x<=157;x++)world.set(x,y,x===127||x===157||y===73?Mat.Earth:y>41?Mat.Water:Mat.Air);
 for(let x=0;x<world.width;x++)world.set(x,210,Mat.Rock);
 factory.energy.value=160;return {drill,sieve,collector,pump,valve};
}
