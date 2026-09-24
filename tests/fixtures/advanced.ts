import {Mat} from '../../src/sim/materials';
import {Factory} from '../../src/sim/machines';
import {World} from '../../src/sim/world';
import {installLine} from './line';
/** Connected square modules take only finite raw sand and water as inputs. */
export function installAdvancedLine(w:World,f:Factory){
 const basic=installLine(w,f);
 f.add('belt',96,96);f.add('belt',104,96);
 const separator=f.add('separator',112,104)!,kiln=f.add('kiln',120,120)!,press=f.add('press',144,168)!;
 const crucible=f.add('crucible',112,144)!,mist=f.add('mist',120,152,1)!,collector=f.add('collector',112,176)!;
 f.add('belt',128,128);f.add('belt',136,128);for(let y=128;y<133;y++)w.set(127,y,Mat.Wall);for(let y=160;y<176;y++)w.set(143,y,Mat.Wall);
 // Leave a module of headroom: a full melt tray must not plug the cold jet.
 const cooling=f.add('filter',112,160)!;cooling.mode='density';cooling.densityMin=175;cooling.densityMax=260;f.rebuildBlocks();
 for(let y=152;y<166;y++)w.set(111,y,Mat.Wall);
 for(let y=160;y<166;y++)w.set(120,y,Mat.Wall);
 f.add('collector',104,176);f.add('collector',120,176);
 for(let y=64;y<144;y+=8)if(!f.add('pipe',120,y))throw new Error('Conduíte avançado obstruído');
 const valve=f.add('valve',120,144,3)!;valve.interval=20;
 if(!separator||!kiln||!press||!crucible||!mist||!collector||!valve)throw new Error('Máquina avançada obstruída');
 for(let y=88;y<100;y++){w.set(95,y,Mat.Wall);w.set(104,y,Mat.Wall);}
 for(let y=104;y<112;y++)w.set(111,y,Mat.Wall);
 for(let y=112;y<128;y++)w.set(119,y,Mat.Wall);
 for(let y=153;y<176;y++){w.set(103,y,Mat.Wall);w.set(136,y,Mat.Wall);}
 return {...basic,separator,kiln,press,crucible,mist,rareCollector:collector};
}
