import { Mat, materials } from './materials';
import type { World } from './world';

/** Loose matter never supports or obstructs the explorer, even in sleeping chunks. */
export function blocksPlayer(world: World, x: number, y: number): boolean {
  if (!world.inBounds(x,y)) return true;
  const i=world.index(x,y);
  return !!world.blocked[i] || !!world.consolidated[i] || world.cells[i]===Mat.Wall || materials[world.cells[i]].state==='terrain';
}
