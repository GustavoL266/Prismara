import { Mat } from '../../src/sim/materials';
import { Factory } from '../../src/sim/machines';
import { World } from '../../src/sim/world';
import {installLine} from './line';
/** Gravity-connected advanced rig. Feedstock still consists only of raw sand and water. */
export function installAdvancedLine(w:World,f:Factory) {
  const basic=installLine(w,f);
  const separator=f.add('separator',104,112)!,belt=f.add('belt',120,135)!;
  const kiln=f.add('kiln',130,146)!,press=f.add('press',140,180)!;
  const crucible=f.add('crucible',106,144)!,mist=f.add('mist',116,166,3)!;
  const collector=f.add('collector',104,178)!;
  for(let y=68;y<=152;y+=4)if(!f.add('pipe',118,y))throw new Error('Conduíte avançado obstruído');
  const valve=f.add('valve',118,156)!;
  if(!separator||!belt||!kiln||!press||!crucible||!mist||!collector||!valve)throw new Error('Máquina avançada obstruída');
  valve.interval=20;
  for(let y=154;y<190;y++){w.set(101,y,Mat.Wall);w.set(127,y,Mat.Wall);}
  return {...basic,separator,kiln,press,crucible,mist,rareCollector:collector};
}
