import { Mat, materials } from '../sim/materials';
import type { World } from '../sim/world';
import { blocksPlayer } from '../sim/player-collision';

export const GRIP_SIZE=5;
export interface HeldPixel { dx:number;dy:number;temperature:number;fall:number;velocityX:number;velocityY:number;variant:number }
export interface ManualLoad { state:'empty'|'loaded'|'partial';material:Mat;pixels:HeldPixel[] }
export interface GripContext {world:World;player:{x:number;y:number};reach:number;exploration:{knows(x:number,y:number):boolean}}
export const emptyLoad=():ManualLoad=>({state:'empty',material:Mat.Air,pixels:[]});
/** The renderer and interaction use this exact grid footprint. */
export function gripBounds(x:number,y:number){return {x:Math.floor(x)-2,y:Math.floor(y)-2,w:GRIP_SIZE,h:GRIP_SIZE};}
export const manualEligible=(mat:Mat)=>materials[mat]?.transportable && (materials[mat].state==='granular'||mat===Mat.WetSand);

/** Supercover ray: even diagonal corner contacts cannot reach through a solid wall. */
export function toolReachable(g:GripContext,x:number,y:number):boolean {
  const w=g.world,ox=g.player.x,oy=g.player.y-4;
  if(!w.inBounds(x,y)||!g.exploration.knows(x,y)||Math.hypot(x+.5-ox,y+.5-oy)>g.reach)return false;
  let cx=Math.floor(ox),cy=Math.floor(oy);const dx=x+.5-ox,dy=y+.5-oy,sx=Math.sign(dx),sy=Math.sign(dy);
  const tx=dx?1/Math.abs(dx):Infinity,ty=dy?1/Math.abs(dy):Infinity;
  let nx=dx?(sx>0?cx+1-ox:ox-cx)*tx:Infinity,ny=dy?(sy>0?cy+1-oy:oy-cy)*ty:Infinity;
  while(cx!==x||cy!==y){
    if(nx===ny){if(blocksPlayer(w,cx+sx,cy)||blocksPlayer(w,cx,cy+sy))return false;cx+=sx;cy+=sy;nx+=tx;ny+=ty;}
    else if(nx<ny){cx+=sx;nx+=tx;}else{cy+=sy;ny+=ty;}
    if(blocksPlayer(w,cx,cy))return false;
  }
  return !blocksPlayer(w,x,y);
}
export function pickLoad(g:GripContext,load:ManualLoad,x:number,y:number):number {
  if(load.pixels.length)return 0;
  const b=gripBounds(x,y),candidates:{x:number;y:number;dx:number;dy:number}[]=[];
  for(let dy=0;dy<GRIP_SIZE;dy++)for(let dx=0;dx<GRIP_SIZE;dx++)candidates.push({x:b.x+dx,y:b.y+dy,dx,dy});
  candidates.sort((a,b)=>(a.dx-2)**2+(a.dy-2)**2-((b.dx-2)**2+(b.dy-2)**2)||a.dy-b.dy||a.dx-b.dx);
  const valid=candidates.filter(p=>manualEligible(g.world.get(p.x,p.y))&&toolReachable(g,p.x,p.y));
  const material=valid.length?g.world.get(valid[0].x,valid[0].y):Mat.Air;
  for(const p of valid){if(g.world.get(p.x,p.y)!==material)continue;
    const w=g.world,i=w.index(p.x,p.y);
    load.pixels.push({dx:p.dx,dy:p.dy,temperature:w.temperature[i],fall:w.fall[i],velocityX:w.velocityX[i],velocityY:w.velocityY[i],variant:w.visualVariant[i]});
    w.set(p.x,p.y,Mat.Air);
  }
  if(load.pixels.length){load.material=material;load.state='loaded';}
  return load.pixels.length;
}
export function dropTargets(g:GripContext,load:ManualLoad,x:number,y:number){
  const b=gripBounds(x,y);return load.pixels.map(pixel=>{const xx=b.x+pixel.dx,yy=b.y+pixel.dy;return {pixel,x:xx,y:yy,valid:g.world.get(xx,yy)===Mat.Air&&toolReachable(g,xx,yy)&&g.world.accepts(xx,yy,load.material)};});
}
export function dropLoad(g:GripContext,load:ManualLoad,x:number,y:number):number {
  const targets=dropTargets(g,load,x,y),remaining:HeldPixel[]=[];let count=0;
  for(const t of targets){if(!t.valid){remaining.push(t.pixel);continue;}
    const w=g.world,p=t.pixel;w.set(t.x,t.y,load.material,p.temperature);const i=w.index(t.x,t.y);
    w.fall[i]=p.fall;w.velocityX[i]=p.velocityX;w.velocityY[i]=p.velocityY;w.visualVariant[i]=p.variant;count++;
  }
  load.pixels=remaining;
  if(!remaining.length){load.state='empty';load.material=Mat.Air;}else if(count)load.state='partial';
  return count;
}
/** Explicit conversion to stock; used only when the player invokes Guardar carga. */
export function storeLoad(load:ManualLoad,inventory:number[],capacity:number):number {
  const count=Math.min(load.pixels.length,Math.max(0,capacity-inventory.reduce((a,b)=>a+b,0)));
  inventory[load.material]+=count;load.pixels.splice(0,count);
  if(!load.pixels.length){load.state='empty';load.material=Mat.Air;}else if(count)load.state='partial';return count;
}
