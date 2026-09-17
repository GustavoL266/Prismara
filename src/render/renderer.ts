import { World, CHUNK_SIZE } from '../sim/world';
import { Mat, materials } from '../sim/materials';
import { machineSize, machinePorts, secondary, type Machine, type MachineKind, type Factory } from '../sim/machines';
import { surfaceLevel, chambers } from '../sim/terrain';
import type { Player } from '../game/player';
import type { Area, Blueprint } from '../game/game';
import type { Exploration } from '../game/exploration';
import { PRESENTATION } from './presentation';
import { drawMachine, operating } from './sprites';
import { Lighting } from './lighting';
import { geologicalNoise, mineralHash } from '../sim/geology';
import { FogBoundary } from './fog';

export interface RenderState {world:World;exploration:Exploration;factory:Factory;player:Player;time:number;pointer:{x:number;y:number};tool:string;building:MachineKind;rotation:number;selectedId:number;paused:boolean;shake:boolean;won:boolean;area?:Area;selection?:Set<number>;blueprint?:Blueprint[];dragging?:boolean}
export class Renderer {
  canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;mini:HTMLCanvasElement;
  camera={x:210,y:132,zoom:3};follow=true;width=1280;height=720;
  private terrain=document.createElement('canvas');private terrainCtx:CanvasRenderingContext2D;private pixels?:ImageData;
  private colors:number[][][];private source?:World;private origin={x:0,y:0};private miniTick=-1;
  private fog=document.createElement('canvas');private fogCtx=this.fog.getContext('2d')!;private fogPixels?:ImageData;
  lighting=new Lighting();private mapPixels?:ImageData;private mapPointer?:{x:number;y:number};
  private fogBoundary=new FogBoundary();
  private effectX=new Float32Array(320);private effectY=new Float32Array(320);private effectVX=new Float32Array(320);private effectVY=new Float32Array(320);private effectLife=new Float32Array(320);private effectColor=new Uint8Array(320);private effectIndex=0;
  constructor(canvas:HTMLCanvasElement,mini:HTMLCanvasElement){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false})!;this.mini=mini;this.terrainCtx=this.terrain.getContext('2d')!;
    this.colors=PRESENTATION.map(m=>m.palette.map(hex=>{const n=parseInt(hex.slice(1),16);return [n>>16,(n>>8)&255,n&255];}));
    this.resize();window.addEventListener('resize',()=>this.resize());
    mini.addEventListener('pointerdown',e=>{if(!mini.closest('.expanded'))return;this.mapPointer={x:e.clientX,y:e.clientY};mini.setPointerCapture(e.pointerId);});
    mini.addEventListener('pointermove',e=>{if(!this.mapPointer||!this.currentExploration)return;const scale=this.mapScale(),r=mini.getBoundingClientRect();this.currentExploration.map.x=Math.max(0,Math.min(this.source!.width,this.currentExploration.map.x-(e.clientX-this.mapPointer.x)*mini.width/r.width/scale));this.currentExploration.map.y=Math.max(0,Math.min(this.source!.height,this.currentExploration.map.y-(e.clientY-this.mapPointer.y)*mini.height/r.height/scale));this.mapPointer={x:e.clientX,y:e.clientY};this.miniTick=-1;});
    mini.addEventListener('pointerup',()=>this.mapPointer=undefined);
    mini.addEventListener('wheel',e=>{if(!mini.closest('.expanded')||!this.currentExploration)return;e.preventDefault();this.currentExploration.map.zoom=Math.max(.5,Math.min(8,this.currentExploration.map.zoom*(e.deltaY<0?1.25:.8)));this.miniTick=-1;},{passive:false});
  }
  private currentExploration?:Exploration;
  private mapScale(){return Math.min(this.mini.width/this.source!.width,this.mini.height/this.source!.height)*(this.currentExploration?.map.zoom??1);}
  resize(){this.width=innerWidth;this.height=innerHeight;const density=Math.min(2,Math.max(1,Math.round(devicePixelRatio||1)));this.canvas.width=this.width*density;this.canvas.height=this.height*density;this.canvas.style.width=this.width+'px';this.canvas.style.height=this.height+'px';this.ctx.setTransform(density,0,0,density,0,0);this.ctx.imageSmoothingEnabled=false;this.updateOrigin();}
  invalidate(){this.source=undefined;this.fogKey='';}
  invalidateMap(){this.miniTick=-1;}
  private updateOrigin(){this.origin.x=Math.round(this.width/2-this.camera.x*this.camera.zoom);this.origin.y=Math.round(this.height/2-this.camera.y*this.camera.zoom);}
  worldPoint(x:number,y:number){this.updateOrigin();return {x:Math.floor((x-this.origin.x)/this.camera.zoom),y:Math.floor((y-this.origin.y)/this.camera.zoom)};}
  screenPoint(x:number,y:number){this.updateOrigin();return {x:Math.round(x*this.camera.zoom+this.origin.x),y:Math.round(y*this.camera.zoom+this.origin.y)};}
  burst(x:number,y:number,color=0,count=8){for(let k=0;k<count;k++){const i=this.effectIndex++%320;this.effectX[i]=x;this.effectY[i]=y;this.effectVX[i]=(Math.random()-.5)*24;this.effectVY[i]=-Math.random()*20;this.effectLife[i]=.25+Math.random()*.3;this.effectColor[i]=color;}}
  private visible(x:number,y:number,w=1,h=1){const z=this.camera.zoom;return x+w> -this.origin.x/z&&x<(this.width-this.origin.x)/z&&y+h> -this.origin.y/z&&y<(this.height-this.origin.y)/z;}
  render(s:RenderState,dt:number){
    const w=s.world,c=this.ctx,z=this.camera.zoom;this.currentExploration=s.exploration;
    if(this.follow&&!s.dragging){
      const targetX=Math.max(40,Math.min(w.width-40,s.player.x+20));
      const targetY=Math.max(40,Math.min(w.height-40,s.player.y-16));
      this.camera.x+=(targetX-this.camera.x)*Math.min(1,dt*5);this.camera.y+=(targetY-this.camera.y)*Math.min(1,dt*5);
    }
    this.updateOrigin();c.save();
    if(s.shake&&!s.paused&&!s.dragging&&s.factory.machines.some(m=>m.kind==='press'&&m.flash>7&&this.visible(m.x,m.y,m.w,m.h)))c.translate(0,s.world.tick%2?1:-1);
    this.background(s);
    if(this.source!==w){
      this.source=w;this.terrain.width=w.width;this.terrain.height=w.height;
      this.pixels=this.terrainCtx.createImageData(w.width,w.height);w.dirty.fill(1);this.miniTick=-1;this.fogKey='';
    }
    this.paintVisible(w);
    c.save();c.translate(this.origin.x,this.origin.y);c.scale(z,z);c.imageSmoothingEnabled=false;
    this.scenery(s);
    const left=Math.max(0,Math.floor(-this.origin.x/z)),top=Math.max(0,Math.floor(-this.origin.y/z));
    const right=Math.min(w.width,Math.ceil((this.width-this.origin.x)/z)),bottom=Math.min(w.height,Math.ceil((this.height-this.origin.y)/z));
    if(right>left&&bottom>top)c.drawImage(this.terrain,left,top,right-left,bottom-top,left,top,right-left,bottom-top);
    for(const m of s.factory.machines)if(secondary(m.kind)&&this.visible(m.x,m.y,m.w,m.h))drawMachine(c,m,w.tick/30,s.factory.machines);
    for(const m of s.factory.machines)if(!secondary(m.kind)&&this.visible(m.x,m.y,m.w,m.h))drawMachine(c,m,w.tick/30,s.factory.machines);
    for(const m of s.factory.machines)if(m.id===s.selectedId&&m.kind==='sensor'&&m.targetId&&this.visible(m.x,m.y,m.w,m.h)){
      const target=s.factory.machines.find(t=>t.id===m.targetId);if(target&&s.exploration.knows(target.x,target.y)){c.strokeStyle=m.signal?'#c4cf85':'#8c5551';c.lineWidth=.5;c.beginPath();c.moveTo(m.x,m.y);c.lineTo(target.x,m.y-3);c.lineTo(target.x,target.y);c.stroke();}
    }
    this.explorer(s);
    for(let i=0;i<320;i++)if(this.effectLife[i]>0){
      if(!s.paused){this.effectLife[i]-=dt;this.effectX[i]+=this.effectVX[i]*dt;this.effectY[i]+=this.effectVY[i]*dt;this.effectVY[i]+=50*dt;}
      if(!this.visible(this.effectX[i],this.effectY[i]))continue;
      c.globalAlpha=Math.min(1,this.effectLife[i]*5);c.fillStyle=['#e1b866','#b6c4d0','#bf88e4','#ffb34e'][this.effectColor[i]];c.fillRect(Math.floor(this.effectX[i]),Math.floor(this.effectY[i]),1,1);
    }
    c.globalAlpha=1;
    if(s.tool==='build'&&s.exploration.knows(s.pointer.x,s.pointer.y)){
      const x=Math.floor(s.pointer.x/2)*2,y=Math.floor(s.pointer.y/2)*2;
      const ghosts=s.blueprint?.length?s.blueprint:[{kind:s.building,dx:0,dy:0,rotation:s.rotation,config:{}}];
      for(const b of ghosts){
        const size=machineSize(b.kind,b.rotation),m={id:0,kind:b.kind,x:x+b.dx,y:y+b.dy,...size,rotation:b.rotation,enabled:false,signal:false,status:'Prévia',filter:Mat.Quartz,densityMin:180,densityMax:260,mode:'material',flash:0,...b.config} as Machine;
        const p=s.player,playerBlocked=!secondary(b.kind)&&m.x<p.x+3&&m.x+m.w>p.x-3&&m.y<p.y+1&&m.y+m.h>p.y-9;
        if(!s.exploration.footprint(m.x,m.y,m.w,m.h))continue;
        const valid=s.factory.canPlace(b.kind,m.x,m.y,b.rotation)&&!playerBlocked;
        c.globalAlpha=.6;this.machine(c,m,w.tick/30);c.globalAlpha=1;c.strokeStyle=valid?'#d5da95':'#ec7463';c.lineWidth=.7;c.strokeRect(m.x-.5,m.y-.5,m.w+1,m.h+1);this.ports(m);
      }
    }else if(s.tool!=='none'&&s.exploration.knows(s.pointer.x,s.pointer.y)){
      c.strokeStyle=s.tool==='thermal'?'#ef9a43':s.tool==='collect'?'#b5c7d9':'#d6c28e';c.lineWidth=.6;c.strokeRect(s.pointer.x-3.5,s.pointer.y-3.5,8,8);
    }
    for(const m of s.factory.machines)if(s.exploration.knows(m.x,m.y)&&(m.id===s.selectedId||s.selection?.has(m.id))){c.strokeStyle='#e1b866';c.lineWidth=.7;c.strokeRect(m.x-1,m.y-1,m.w+2,m.h+2);if(m.id===s.selectedId)this.ports(m);}
    if(s.area){const a=s.area;c.fillStyle=a.remove?'#e6746328':'#e1b86622';c.strokeStyle=a.remove?'#e67463':'#e1b866';c.fillRect(a.x,a.y,a.endX-a.x,a.endY-a.y);c.strokeRect(a.x,a.y,a.endX-a.x,a.endY-a.y);}
    this.visibility(s,left,top,right,bottom);c.restore();c.restore();
    if(w.tick-this.miniTick>=12||this.miniTick<0){this.minimap(s);this.miniTick=w.tick;}
  }
  private paintVisible(w:World){
    const z=this.camera.zoom,data=this.pixels!.data;
    const xStart=Math.max(0,Math.floor(-this.origin.x/z/16)),xEnd=Math.min(w.chunksX-1,Math.floor((this.width-this.origin.x)/z/16));
    const yStart=Math.max(0,Math.floor(-this.origin.y/z/16)),yEnd=Math.min(w.chunksY-1,Math.floor((this.height-this.origin.y)/z/16));
    const wallColors=[[0,0,0],[32,28,24],[35,33,30],[26,37,46],[29,43,53],[39,27,24],[34,25,40]];
    for(let cy=yStart;cy<=yEnd;cy++)for(let cx=xStart;cx<=xEnd;cx++){
      const chunk=cy*w.chunksX+cx;if(!w.dirty[chunk])continue;w.dirty[chunk]=0;
      const x0=cx*CHUNK_SIZE,y0=cy*CHUNK_SIZE;
      for(let y=y0;y<Math.min(y0+16,w.height);y++)for(let x=x0;x<Math.min(x0+16,w.width);x++){
        const i=w.index(x,y),mat=w.cells[i],offset=i*4;
        if(mat===Mat.Air){
          const wall=w.backdrop[i];if(!wall){data[offset+3]=0;continue;}
          const color=wallColors[wall],patch=geologicalNoise(x,y,36,w.seed+919),shade=.86+patch*.27;
          const crack=mineralHash(x>>2,y>>2,w.seed+1031)>.982?.72:1;
          data[offset]=color[0]*shade*crack;data[offset+1]=color[1]*shade*crack;data[offset+2]=color[2]*shade*crack;data[offset+3]=255;continue;
        }
        const presentation=PRESENTATION[mat],palettes=this.colors[mat],fixed=!!w.consolidated[i]||materials[mat].state==='terrain';
        const variant=w.visualVariant[i],cluster=geologicalNoise(x,y*.67,23,w.seed+mat*13);
        const variation=fixed?(cluster>.69?1:cluster<.27?2:variant<6?1+variant%2:0):presentation.flecks&&variant<presentation.flecks?1+variant%(palettes.length-1):0;
        const color=palettes[variation%palettes.length];let shade=fixed?.94:1;
        const up=w.get(x,y-1),down=w.get(x,y+1),left=w.get(x-1,y),right=w.get(x+1,y),air=(up===Mat.Air?1:0)+(down===Mat.Air?1:0)+(left===Mat.Air?1:0)+(right===Mat.Air?1:0);
        // One-cell grains keep their principal color; only the exterior of a mass is outlined.
        if(air>0&&air<4){if(up===Mat.Air)shade*=presentation.highlight;else if(right===Mat.Air||down===Mat.Air)shade*=presentation.edge;}
        if(mat===Mat.Water&&!fixed){
          let depth=0;while(depth<8&&w.get(x,y-depth-1)===Mat.Water)depth++;
          shade*=1-depth*.019;if(up===Mat.Air)shade*=1.08;
        }
        if(fixed)shade*=.95+cluster*.09;
        const heat=Math.max(0,Math.min(.42,(w.temperature[i]-300)/1600));
        data[offset]=color[0]*shade*(1-heat)+255*heat;data[offset+1]=color[1]*shade*(1-heat)+150*heat;data[offset+2]=color[2]*shade*(1-heat)+50*heat;data[offset+3]=presentation.alpha;
      }
      this.terrainCtx.putImageData(this.pixels!,0,0,x0,y0,Math.min(16,w.width-x0),Math.min(16,w.height-y0));
    }
  }
  private background(s:RenderState){
    const c=this.ctx,ground=this.screenPoint(0,surfaceLevel(s.world)).y;
    c.fillStyle='#17191D';c.fillRect(0,0,this.width,this.height);
    if(ground>0){
      c.save();c.beginPath();c.rect(0,0,this.width,Math.min(this.height,ground));c.clip();c.fillStyle='#79B6D2';c.fillRect(0,0,this.width,Math.max(0,ground));
      c.fillStyle='#B4D5D9';c.fillRect(0,Math.max(0,ground-75*this.camera.zoom),this.width,75*this.camera.zoom);
      const sun=this.screenPoint(s.world.width*.16,surfaceLevel(s.world)-77);c.fillStyle='#F3D893';c.fillRect(sun.x-18,sun.y-16,36,32);c.fillRect(sun.x-22,sun.y-9,44,18);
      for(let layer=0;layer<3;layer++){
        c.fillStyle=['#8AABA9','#889786','#9F9B6D'][layer];c.beginPath();c.moveTo(0,ground);
        for(let x=0;x<=this.width+8;x+=8){const wx=x/this.camera.zoom+this.camera.x*(.12+layer*.08),ridge=Math.sin(wx*.018+layer*2)*7+Math.sin(wx*.043)*3;c.lineTo(x,Math.round(ground-(34-layer*9)*this.camera.zoom+ridge*this.camera.zoom));}
        c.lineTo(this.width,ground);c.fill();
      }c.restore();
    }
  }
  private scenery(s:RenderState){
    const c=this.ctx,top=surfaceLevel(s.world);
    for(let x=25;x<s.world.width;x+=97)if(this.visible(x,top-18,16,18)){
      const y=top+Math.floor(Math.sin(x*.026)*5);c.fillStyle='#343536';c.fillRect(x,y-11,2,11);c.fillRect(x-4,y-8,5,2);c.fillRect(x-5,y-14,2,8);c.fillRect(x+1,y-10,5,2);c.fillRect(x+5,y-15,2,7);c.fillStyle='#ad8750';c.fillRect(x-5,y-14,2,2);c.fillRect(x+5,y-15,2,2);
    }
    for(const chamber of chambers(s.world))if(this.visible(chamber.x-36,chamber.y-45,72,45)){
      const {x,y}=chamber;for(const d of [-1,1]){c.fillStyle='#39353f';c.fillRect(x+d*27-3,y-38,6,37);c.fillStyle='#6d6177';c.fillRect(x+d*27-3,y-38,6,2);c.fillRect(x+d*27-1,y-33,1,26);}
      c.fillStyle=s.won?'#c59ee2':'#6b5776';c.fillRect(x-3,y-33,6,9);c.fillRect(x-5,y-30,10,3);
      c.fillStyle='#2f2c34';c.fillRect(x-25,y-3,50,2);
    }
  }
  machine(c:CanvasRenderingContext2D,m:Machine,time:number){drawMachine(c,m,time);}
  private ports(m:Machine){const c=this.ctx;for(const p of machinePorts(m)){c.fillStyle=p.label==='Ouro'?'#F3CF4C':p.label==='Resíduo'?'#aaa092':p.label==='Entrada'?'#b0c6d6':'#D69B32';c.fillRect(p.x-1,p.y-1,3,1);c.fillRect(p.x,p.y,1,2);}}
  private explorer(s:RenderState){
    const c=this.ctx,p=s.player,x=Math.round(p.x),y=Math.round(p.y),walk=p.grounded&&p.vx!==0?Math.round(Math.sin(s.world.tick*.6)):0;
    c.fillStyle='#292d31';c.fillRect(x-3,y-7,6,6);c.fillStyle='#ac8051';c.fillRect(x-2,y-6,4,4);c.fillStyle='#D69B32';c.fillRect(x-3,y-11,6,2);c.fillRect(x-4,y-9,8,1);
    c.fillStyle='#bfd1db';c.fillRect(x+(p.facing>0?0:-2),y-8,3,2);c.fillStyle='#474D52';c.fillRect(x-p.facing*4,y-7,2,5);
    c.fillStyle='#17191D';c.fillRect(x-2,y-2+walk,2,2);c.fillRect(x+1,y-2-walk,2,2);c.fillStyle='#899096';c.fillRect(x-2,y+walk,2,1);c.fillRect(x+1,y-walk,2,1);
    const angle=Math.atan2(s.pointer.y-(y-5),s.pointer.x-x);for(let n=1;n<=7;n++){c.fillStyle=n>5?(s.tool==='thermal'?'#ffb354':'#D69B32'):'#B2C6CD';c.fillRect(x+Math.round(Math.cos(angle)*n),y-5+Math.round(Math.sin(angle)*n),1,2);}
    if(p.thrust&&!s.paused){c.fillStyle='#f3cf4c';c.fillRect(x-p.facing*4,y-2,2,2+s.world.tick%3);c.fillStyle='#e78030';c.fillRect(x-p.facing*4,y+1,1,2);this.burst(x-p.facing*4,y+2,3,1);}
  }
  private fogKey='';
  private visibility(s:RenderState,_left:number,_top:number,_right:number,_bottom:number){
    const w=s.world,z=this.camera.zoom,left=Math.floor(-this.origin.x/z),top=Math.floor(-this.origin.y/z),right=Math.ceil((this.width-this.origin.x)/z),bottom=Math.ceil((this.height-this.origin.y)/z);
    const width=right-left,height=bottom-top;
    if(width!==this.fog.width||height!==this.fog.height){this.fog.width=width;this.fog.height=height;this.fogPixels=this.fogCtx.createImageData(width,height);this.fogKey='';}
    const key=[w.tick,s.exploration.revision,left,top,s.player.x.toFixed(1),s.player.y.toFixed(1),...s.factory.machines.filter(m=>m.kind==='lamp').map(m=>m.id+':'+operating(m))].join(',');
    if(key!==this.fogKey){
      this.fogKey=key;
      const emissions:{x:number;y:number;r:number}[]=[];
      for(let cy=Math.max(0,top);cy<Math.min(w.height,bottom)&&emissions.length<8;cy+=16)for(let cx=Math.max(0,left);cx<Math.min(w.width,right)&&emissions.length<8;cx+=16){
        let found=false;
        for(let y=cy;y<Math.min(cy+16,w.height,bottom)&&!found;y++)for(let x=cx;x<Math.min(cx+16,w.width,right);x++){
          if(!s.exploration.knows(x,y))continue;const i=w.index(x,y),mat=w.cells[i],radius=PRESENTATION[mat].emission;
          if(!radius)continue;
          if(mat===Mat.Molten&&w.temperature[i]<650)continue;
          if(mat===Mat.Crystal&&[{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}].filter(p=>s.exploration.knows(p.x,p.y)&&w.get(p.x,p.y)===mat).length<2)continue;
          emissions.push({x:x+.5,y:y+.5,r:radius});found=true;break;
        }
      }
      this.lighting.update(w,s.player.x,s.player.y,s.factory.machines,left,top,right,bottom,emissions);
      this.fogBoundary.update(s.exploration,left,top,right,bottom);
      const data=this.fogPixels!.data,ground=surfaceLevel(w);
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        const i=((y-top)*width+x-left)*4;
        if(!s.exploration.knows(x,y)){data[i+3]=255;continue;}
        const daylight=y<ground?1:y<ground+16?.12:.055;
        const light=Math.max(daylight,this.lighting.intensity(x+.5,y+.5));
        data[i+3]=Math.round(255*(1-Math.min(1,light*.97+daylight*.1)*this.fogBoundary.strength(x,y)));
      }
      this.fogCtx.putImageData(this.fogPixels!,0,0);
    }
    this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(this.fog,left,top);
  }
  private minimap(s:RenderState){
    if(this.mini.closest('.map-panel')?.classList.contains('collapsed'))return;
    const expanded=!!this.mini.closest('.expanded'),desiredWidth=expanded?512:128,desiredHeight=expanded?768:192;
    if(this.mini.width!==desiredWidth||this.mini.height!==desiredHeight){this.mini.width=desiredWidth;this.mini.height=desiredHeight;this.mapPixels=undefined;}
    const c=this.mini.getContext('2d')!,width=this.mini.width,height=this.mini.height;c.imageSmoothingEnabled=false;
    const scale=expanded?this.mapScale():.65,centerX=expanded?s.exploration.map.x:s.player.x,centerY=expanded?s.exploration.map.y:s.player.y;
    const left=centerX-width/scale/2,top=centerY-height/scale/2;
    this.mapPixels??=c.createImageData(width,height);const data=this.mapPixels.data,step=Math.min(4,Math.max(1,Math.ceil(1/scale)));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const wx=Math.floor(left+x/scale),wy=Math.floor(top+y/scale);let known=0,mat=Mat.Air;
      for(let yy=0;yy<step;yy++)for(let xx=0;xx<step;xx++)if(s.exploration.knows(wx+xx,wy+yy)){
        known++;const sample=s.exploration.rememberedMaterial[(wy+yy)*s.world.width+wx+xx];
        if(mat!==Mat.Crystal&&mat!==Mat.Gold&&(sample!==Mat.Air||mat===Mat.Air))mat=sample;
      }
      const offset=(y*width+x)*4,color=mat===Mat.Air?[24,28,33]:this.colors[mat][0],coverage=known/(step*step);
      data[offset]=color[0]*coverage;data[offset+1]=color[1]*coverage;data[offset+2]=color[2]*coverage;data[offset+3]=255;
    }
    c.putImageData(this.mapPixels,0,0);
    const point=(x:number,y:number)=>({x:(x-left)*scale,y:(y-top)*scale});
    for(const chamber of chambers(s.world))if(s.exploration.points.includes(chamber.id)&&s.exploration.knows(chamber.x,chamber.y-20)){const p=point(chamber.x,chamber.y-20);c.fillStyle='#BF88E4';c.fillRect(p.x-1,p.y-1,3,3);}
    for(const m of s.factory.machines)if(s.exploration.footprint(m.x,m.y,m.w,m.h)){const p=point(m.x,m.y);c.fillStyle='#DA982C';c.fillRect(p.x,p.y,Math.max(1,m.w*scale),Math.max(1,m.h*scale));}
    const p=point(s.player.x,s.player.y);c.fillStyle='#FFF2BE';c.fillRect(p.x-1,p.y-1,3,3);
    c.strokeStyle='#899096';c.lineWidth=1;const camera=point(-this.origin.x/this.camera.zoom,-this.origin.y/this.camera.zoom);c.strokeRect(camera.x,camera.y,this.width/this.camera.zoom*scale,this.height/this.camera.zoom*scale);
  }

}
