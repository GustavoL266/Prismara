import type { Machine } from './machines';
export const MODULE_SIZE=8;
export const MODULE_CENTER=4;
export const FLOW_ROW=4;
export const snapModule=(n:number)=>Math.floor(n/MODULE_SIZE)*MODULE_SIZE;
/** Clockwise quarter-turn shared by ports, masks, recipes, sprite and preview. */
export function globalCell(m:Pick<Machine,'x'|'y'|'rotation'>,x:number,y:number){
  const n=MODULE_SIZE-1;
  return m.rotation===1?{x:m.x+n-y,y:m.y+x}:m.rotation===2?{x:m.x+n-x,y:m.y+n-y}:m.rotation===3?{x:m.x+y,y:m.y+n-x}:{x:m.x+x,y:m.y+y};
}
export function localCell(m:Pick<Machine,'x'|'y'|'rotation'>,x:number,y:number){
  const n=MODULE_SIZE-1,xx=x-m.x,yy=y-m.y;
  return m.rotation===1?{x:yy,y:n-xx}:m.rotation===2?{x:n-xx,y:n-yy}:m.rotation===3?{x:n-yy,y:xx}:{x:xx,y:yy};
}
export function rotateVector(rotation:number,x:number,y:number){return rotation===1?{x:-y,y:x}:rotation===2?{x:-x,y:-y}:rotation===3?{x:y,y:-x}:{x,y};}
