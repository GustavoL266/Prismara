import { Mat, materials } from './materials';
import { World } from './world';
import { geologicalNoise } from './geology';
export const WORLD_WIDTH=1024,WORLD_HEIGHT=1536;
export const SURFACE_LEVEL=172;
export const REGION_NAMES=['Planície Âmbar','Galerias do Sedimento','Aquíferos de Ardósia','Estratos de Geada','Fendas Incandescentes','Arquivo das Profundezas'];
export function surfaceLevel(w:World){return Math.min(SURFACE_LEVEL,Math.floor(w.height*.32));}
export function spawnPoint(w:World){return {x:Math.min(130,Math.floor(w.width*.2)),y:surfaceLevel(w)-9};}
export function regionAt(w:World,_x:number,y:number):number {
  if(y<surfaceLevel(w)+38)return 0;
  const depth=(y-surfaceLevel(w))/(w.height-surfaceLevel(w));
  return depth<.23?1:depth<.46?2:depth<.66?3:depth<.84?4:5;
}
export function chambers(w:World){
  const top=surfaceLevel(w),remaining=w.height-top;
  return [{id:'drain',name:'Arquivo Inundado',x:Math.floor(w.width*.6),y:Math.floor(top+remaining*.34)},
    {id:'thaw',name:'Porta de Geada',x:Math.floor(w.width*.6),y:Math.floor(top+remaining*.57)},
    {id:'feed',name:'Balança dos Estratos',x:Math.floor(w.width*.6),y:Math.floor(top+remaining*.9)}];
}
export const REGIONS=REGION_NAMES.map((name,id)=>({id,name}));
/** Deposits are consolidated; connected corridors scale with world dimensions. */
export function generateTerrain(w:World):void {
  w.clear();const top=surfaceLevel(w),remaining=w.height-top,phase=w.rng()*6.28;
  const spawn=spawnPoint(w);
  for(let x=0;x<w.width;x++) {
    let surface=Math.round(top+Math.sin(x*.026+phase)*6+Math.sin(x*.061)*3);
    if(x>spawn.x-70&&x<spawn.x+190)surface=top;
    for(let y=surface;y<w.height;y++) {
      const depth=(y-top)/remaining;
      const large=geologicalNoise(x,y,92,w.seed),small=geologicalNoise(x,y,29,w.seed+83);
      const warp=(large-.5)*48;
      const band=geologicalNoise(x+warp,y*.72,47,w.seed+127);
      const cave=y>top+55 && (large*.62+small*.38>.64 || (Math.abs(band-.5)<.047 && small>.46));
      const strata=geologicalNoise(x,y*.58,58,w.seed+43);
      let mat=depth<.04?Mat.Sand:depth<.23?Mat.Earth:Mat.Rock;
      if(cave)mat=Mat.Air;
      else if(depth>.04) {
        const vein=geologicalNoise(x+warp,y*1.2,41,w.seed+211);
        if(Math.abs(vein-.5)<.025+small*.018 && large>.54)mat=Mat.Quartz;
        if(depth>.46&&depth<.66&&strata>.54)mat=Mat.Ice;
        if(depth>.24&&Math.abs(vein-.68)<.012&&small>.68)mat=Mat.Crystal;
        if(depth>.66&&depth<.84&&strata>.63)mat=Mat.Residue;
      }
      if(x<2||x>=w.width-2||y>=w.height-3)mat=Mat.Rock;
      const i=w.index(x,y);w.cells[i]=mat;
      w.backdrop[i]=regionAt(w,x,y)+1;w.visualVariant[i]=mat===Mat.Air?0:w.variantAt(i);
      if(mat!==Mat.Air)w.consolidated[i]=1;
      w.temperature[i]=materials[mat].temperature;
    }
  }
  const carve=(x:number,y:number,r:number)=>{
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r&&w.inBounds(x+dx,y+dy)&&x+dx>3&&x+dx<w.width-4&&y+dy<w.height-4)w.set(x+dx,y+dy,Mat.Air);
  };
  for(let y=top-6;y<w.height-25;y+=5)carve(Math.floor(w.width*.38+Math.sin(y*.009+phase)*24),y,14);
  for(const c of chambers(w)) {
    for(let x=Math.floor(w.width*.32);x<c.x+38;x+=6)carve(x,c.y-32,11);
    for(let y=c.y-45;y<=c.y;y++)for(let x=c.x-36;x<=c.x+36;x++){
      if(!w.inBounds(x,y))continue;
      const doorway=x===c.x-36&&y>c.y-43&&y<c.y-25;
      w.set(x,y,!doorway&&(y===c.y||x===c.x-36||x===c.x+36)?Mat.Rock:Mat.Air);
    }
    if(c.id==='drain')for(let y=c.y-22;y<c.y;y++)for(let x=c.x-35;x<c.x+36;x++)w.set(x,y,Mat.Water);
    if(c.id==='thaw')for(let y=c.y-42;y<c.y;y++)for(let x=c.x-8;x<c.x-2;x++)w.set(x,y,Mat.Ice,-20);
    if(c.id==='feed')for(let x=c.x-5;x<=c.x+5;x++)w.set(x,c.y-4,Mat.Wall);
    for(let n=0;n<12;n++){const x=c.x+15+n%6,y=c.y-1-Math.floor(n/6);w.set(x,y,Mat.Crystal);w.consolidated[w.index(x,y)]=1;}
  }
  const left=spawn.x+64,right=left+28;
  if(right<w.width-3)for(let y=top-16;y<=top+6;y++)for(let x=left;x<=right;x++)w.set(x,y,y===top+6||x===left||x===right?Mat.Earth:y>top-11?Mat.Water:Mat.Air);
  if(w.height>600)for(const pocket of [{x:Math.floor(w.width*.2),y:top+Math.floor(remaining*.28),mat:Mat.Water},{x:Math.floor(w.width*.75),y:top+Math.floor(remaining*.75),mat:Mat.Steam}]){
    for(let y=pocket.y-18;y<=pocket.y+8;y++)for(let x=pocket.x-22;x<=pocket.x+22;x++)w.set(x,y,y===pocket.y+8||y===pocket.y-18||x===pocket.x-22||x===pocket.x+22?Mat.Rock:pocket.mat,pocket.mat===Mat.Steam?180:24);
  }
  w.rebuildActivity();
}
