import { World, CHUNK_SIZE } from '../sim/world';
import { Mat, materials } from '../sim/materials';
import { MACHINE_DEFS, machineSize, machineSolid, machinePorts, outlet, secondary, type Machine, type MachineKind, type Factory } from '../sim/machines';
import { surfaceLevel, chambers, regionAt } from '../sim/terrain';
import type { Player } from '../game/player';
import type { Area, Blueprint } from '../game/game';

export interface RenderState {world:World;factory:Factory;player:Player;time:number;pointer:{x:number;y:number};tool:string;building:MachineKind;rotation:number;selectedId:number;paused:boolean;shake:boolean;won:boolean;area?:Area;selection?:Set<number>;blueprint?:Blueprint[];dragging?:boolean}
export class Renderer {
  canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;mini:HTMLCanvasElement;
  camera={x:210,y:132,zoom:3};follow=true;width=1280;height=720;
  private terrain=document.createElement('canvas');private terrainCtx:CanvasRenderingContext2D;private pixels?:ImageData;
  private colors:number[][][];private source?:World;private origin={x:0,y:0};private miniTick=-1;
  private effectX=new Float32Array(320);private effectY=new Float32Array(320);private effectVX=new Float32Array(320);private effectVY=new Float32Array(320);private effectLife=new Float32Array(320);private effectColor=new Uint8Array(320);private effectIndex=0;
  constructor(canvas:HTMLCanvasElement,mini:HTMLCanvasElement){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false})!;this.mini=mini;this.terrainCtx=this.terrain.getContext('2d')!;
    this.colors=materials.map(m=>m.palette.map(hex=>{const n=parseInt(hex.slice(1),16);return [n>>16,(n>>8)&255,n&255];}));
    this.resize();window.addEventListener('resize',()=>this.resize());
  }
  resize(){this.width=innerWidth;this.height=innerHeight;this.canvas.width=this.width;this.canvas.height=this.height;this.ctx.imageSmoothingEnabled=false;this.updateOrigin();}
  invalidate(){this.source=undefined;}
  private updateOrigin(){this.origin.x=Math.round(this.width/2-this.camera.x*this.camera.zoom);this.origin.y=Math.round(this.height/2-this.camera.y*this.camera.zoom);}
  worldPoint(x:number,y:number){this.updateOrigin();return {x:Math.floor((x-this.origin.x)/this.camera.zoom),y:Math.floor((y-this.origin.y)/this.camera.zoom)};}
  screenPoint(x:number,y:number){this.updateOrigin();return {x:Math.round(x*this.camera.zoom+this.origin.x),y:Math.round(y*this.camera.zoom+this.origin.y)};}
  burst(x:number,y:number,color=0,count=8){for(let k=0;k<count;k++){const i=this.effectIndex++%320;this.effectX[i]=x;this.effectY[i]=y;this.effectVX[i]=(Math.random()-.5)*24;this.effectVY[i]=-Math.random()*20;this.effectLife[i]=.25+Math.random()*.3;this.effectColor[i]=color;}}
  private visible(x:number,y:number,w=1,h=1){const z=this.camera.zoom;return x+w> -this.origin.x/z&&x<(this.width-this.origin.x)/z&&y+h> -this.origin.y/z&&y<(this.height-this.origin.y)/z;}
  render(s:RenderState,dt:number){
    const w=s.world,c=this.ctx,z=this.camera.zoom;
    if(this.follow&&!s.dragging){
      const halfX=this.width/z/2,halfY=this.height/z/2;
      const targetX=Math.max(halfX,Math.min(w.width-halfX,s.player.x+32));
      const targetY=Math.max(halfY,Math.min(w.height-halfY,s.player.y-30));
      this.camera.x+=(targetX-this.camera.x)*Math.min(1,dt*5);this.camera.y+=(targetY-this.camera.y)*Math.min(1,dt*5);
    }
    this.updateOrigin();c.save();
    if(s.shake&&!s.paused&&!s.dragging&&s.factory.machines.some(m=>m.kind==='press'&&m.flash>7&&this.visible(m.x,m.y,m.w,m.h)))c.translate(0,s.world.tick%2?1:-1);
    this.background(s);
    if(this.source!==w){
      this.source=w;this.terrain.width=w.width;this.terrain.height=w.height;
      this.pixels=this.terrainCtx.createImageData(w.width,w.height);w.dirty.fill(1);this.miniTick=-1;
    }
    this.paintVisible(w);
    c.save();c.translate(this.origin.x,this.origin.y);c.scale(z,z);c.imageSmoothingEnabled=false;
    this.scenery(s);
    const left=Math.max(0,Math.floor(-this.origin.x/z)),top=Math.max(0,Math.floor(-this.origin.y/z));
    const right=Math.min(w.width,Math.ceil((this.width-this.origin.x)/z)),bottom=Math.min(w.height,Math.ceil((this.height-this.origin.y)/z));
    if(right>left&&bottom>top)c.drawImage(this.terrain,left,top,right-left,bottom-top,left,top,right-left,bottom-top);
    for(const m of s.factory.machines)if(secondary(m.kind)&&this.visible(m.x,m.y,m.w,m.h))this.machine(c,m,w.tick/30);
    for(const m of s.factory.machines)if(!secondary(m.kind)&&this.visible(m.x,m.y,m.w,m.h))this.machine(c,m,w.tick/30);
    for(const m of s.factory.machines)if(m.kind==='sensor'&&m.targetId&&this.visible(m.x,m.y,m.w,m.h)){
      const target=s.factory.machines.find(t=>t.id===m.targetId);if(target){c.strokeStyle=m.signal?'#c4cf85':'#8c5551';c.lineWidth=.5;c.beginPath();c.moveTo(m.x,m.y);c.lineTo(target.x,m.y-3);c.lineTo(target.x,target.y);c.stroke();}
    }
    this.explorer(s);
    for(let i=0;i<320;i++)if(this.effectLife[i]>0){
      if(!s.paused){this.effectLife[i]-=dt;this.effectX[i]+=this.effectVX[i]*dt;this.effectY[i]+=this.effectVY[i]*dt;this.effectVY[i]+=50*dt;}
      if(!this.visible(this.effectX[i],this.effectY[i]))continue;
      c.globalAlpha=Math.min(1,this.effectLife[i]*5);c.fillStyle=['#e1b866','#b6c4d0','#bf88e4','#ffb34e'][this.effectColor[i]];c.fillRect(Math.floor(this.effectX[i]),Math.floor(this.effectY[i]),1,1);
    }
    c.globalAlpha=1;
    if(s.tool==='build'){
      const x=Math.floor(s.pointer.x/2)*2,y=Math.floor(s.pointer.y/2)*2;
      const ghosts=s.blueprint?.length?s.blueprint:[{kind:s.building,dx:0,dy:0,rotation:s.rotation,config:{}}];
      for(const b of ghosts){
        const size=machineSize(b.kind,b.rotation),m={id:0,kind:b.kind,x:x+b.dx,y:y+b.dy,...size,rotation:b.rotation,enabled:false,signal:false,status:'Prévia',filter:Mat.Quartz,densityMin:180,densityMax:260,mode:'material',flash:0,...b.config} as Machine;
        const p=s.player,playerBlocked=!secondary(b.kind)&&m.x<p.x+3&&m.x+m.w>p.x-3&&m.y<p.y+1&&m.y+m.h>p.y-9;
        const valid=s.factory.canPlace(b.kind,m.x,m.y,b.rotation)&&!playerBlocked;
        c.globalAlpha=.6;this.machine(c,m,w.tick/30);c.globalAlpha=1;c.strokeStyle=valid?'#d5da95':'#ec7463';c.lineWidth=.7;c.strokeRect(m.x-.5,m.y-.5,m.w+1,m.h+1);this.ports(m);
      }
    }else if(s.tool!=='none'){
      c.strokeStyle=s.tool==='thermal'?'#ef9a43':s.tool==='collect'?'#b5c7d9':'#d6c28e';c.lineWidth=.6;c.strokeRect(s.pointer.x-3.5,s.pointer.y-3.5,8,8);
    }
    for(const m of s.factory.machines)if(m.id===s.selectedId||s.selection?.has(m.id)){c.strokeStyle='#e1b866';c.lineWidth=.7;c.strokeRect(m.x-1,m.y-1,m.w+2,m.h+2);if(m.id===s.selectedId)this.ports(m);}
    if(s.area){const a=s.area;c.fillStyle=a.remove?'#e6746328':'#e1b86622';c.strokeStyle=a.remove?'#e67463':'#e1b866';c.fillRect(a.x,a.y,a.endX-a.x,a.endY-a.y);c.strokeRect(a.x,a.y,a.endX-a.x,a.endY-a.y);}
    c.restore();c.restore();
    if(w.tick-this.miniTick>=12||this.miniTick<0){this.minimap(s);this.miniTick=w.tick;}
  }
  private paintVisible(w:World){
    const z=this.camera.zoom,data=this.pixels!.data;
    const xStart=Math.max(0,Math.floor(-this.origin.x/z/16)),xEnd=Math.min(w.chunksX-1,Math.floor((this.width-this.origin.x)/z/16));
    const yStart=Math.max(0,Math.floor(-this.origin.y/z/16)),yEnd=Math.min(w.chunksY-1,Math.floor((this.height-this.origin.y)/z/16));
    for(let cy=yStart;cy<=yEnd;cy++)for(let cx=xStart;cx<=xEnd;cx++){
      const chunk=cy*w.chunksX+cx;if(!w.dirty[chunk])continue;w.dirty[chunk]=0;
      const x0=cx*CHUNK_SIZE,y0=cy*CHUNK_SIZE;
      for(let y=y0;y<Math.min(y0+16,w.height);y++)for(let x=x0;x<Math.min(x0+16,w.width);x++){
        const i=w.index(x,y),mat=w.cells[i],offset=i*4;if(mat===Mat.Air){data[offset+3]=0;continue;}
        const palettes=this.colors[mat],fixed=!!w.consolidated[i]||materials[mat].state==='terrain';
        const cluster=(Math.imul((x>>3)+w.seed,73856093)^Math.imul(y>>2,19349663))>>>0;
        const grain=(Math.imul(x+11,317)^Math.imul(y+3,101))>>>0;
        const stripe=Math.floor(y+Math.sin(x*.025)*3)%11===0;
        const variation=fixed?(stripe?2:cluster%5===0?1:grain%11===0?2:0):grain%7===0?1:0;
        const color=palettes[variation%palettes.length],shade=fixed?.89:1;
        data[offset]=color[0]*shade;data[offset+1]=color[1]*shade;data[offset+2]=color[2]*shade;data[offset+3]=materials[mat].state==='gas'?150:255;
      }
      this.terrainCtx.putImageData(this.pixels!,0,0,x0,y0,Math.min(16,w.width-x0),Math.min(16,w.height-y0));
    }
  }
  private background(s:RenderState){
    const c=this.ctx,ground=this.screenPoint(0,surfaceLevel(s.world)).y;
    c.fillStyle='#17191D';c.fillRect(0,0,this.width,this.height);
    if(ground>0){
      c.save();c.beginPath();c.rect(0,0,this.width,Math.min(this.height,ground));c.clip();c.fillStyle='#373a40';c.fillRect(0,0,this.width,Math.max(0,ground));
      const sun=this.screenPoint(s.world.width*.63,55);c.fillStyle='#cfa862';c.fillRect(sun.x-18,sun.y-16,36,32);c.fillRect(sun.x-22,sun.y-9,44,18);
      for(let layer=0;layer<3;layer++){
        c.fillStyle=['#444548','#555049','#665b49'][layer];c.beginPath();c.moveTo(0,ground);
        for(let x=0;x<=this.width+8;x+=8){const wx=x/this.camera.zoom+this.camera.x*(.12+layer*.08),ridge=Math.sin(wx*.018+layer*2)*7+Math.sin(wx*.043)*3;c.lineTo(x,Math.round(ground-(34-layer*9)*this.camera.zoom+ridge*this.camera.zoom));}
        c.lineTo(this.width,ground);c.fill();
      }c.restore();
    }
    if(ground<this.height){c.save();c.beginPath();c.rect(0,Math.max(0,ground),this.width,this.height-Math.max(0,ground));c.clip();c.fillStyle='#25282B';const start=Math.max(ground,0);
      for(let y=start-100;y<this.height;y+=83){const offset=Math.floor(this.camera.x*.12)%120;c.fillRect(-offset,y,this.width+120,1);c.fillStyle='#212427';c.fillRect(60-offset,y+13,this.width*.4,22);c.fillStyle='#25282B';}
      c.restore();
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
  machine(c:CanvasRenderingContext2D,m:Machine,time:number){
    const {x,y,w,h,kind}=m,active=m.enabled&&m.signal!==false&&(m.status==='Ativa'||m.flash>0||m.status==='Aquecimento solar'),phase=active?Math.floor(time*10):0,dir=m.rotation%2?-1:1;
    const metal='#899096',dark='#33383d',gold='#D69B32';
    if(['block','platform','wall','gate','funnel'].includes(kind)){
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(machineSolid(m,xx,yy)){c.fillStyle=(xx+yy)%4===0?metal:'#474D52';c.fillRect(xx,yy,1,1);}
      if(kind==='gate'&&(!m.enabled||!m.signal)){c.fillStyle=gold;c.fillRect(x,y,2,2);c.fillRect(x+w-2,y+h-2,2,2);}return;
    }
    if(['belt','fastbelt','hauler'].includes(kind)){
      c.fillStyle=dark;c.fillRect(x,y,w,h);c.fillStyle=metal;c.fillRect(x,y,w,1);
      for(let i=0;i<w;i+=4){c.fillStyle=gold;c.fillRect(x+((i+phase*dir)%w+w)%w,y,2,1);c.fillStyle='#17191d';c.fillRect(x+i+1,y+1,2,2);c.fillStyle=metal;c.fillRect(x+i+1,y+1,1,1);}return;
    }
    if(kind==='sieve'||kind==='filter'){
      c.fillStyle=metal;c.fillRect(x,y,w,1);c.fillStyle=dark;c.fillRect(x,y+1,2,h-1);c.fillRect(x+w-2,y+1,2,h-1);
      const offset=active?phase%2:0;c.fillStyle=gold;for(let i=2;i<w-2;i+=3)c.fillRect(x+i,y+1+offset,1,1);
      c.fillStyle='#474D52';c.fillRect(x+3,y+h-1,2,1);c.fillRect(x+w-5,y+h-1,2,1);
      if(kind==='filter'){c.fillStyle=materials[m.filter].color;c.fillRect(x+w/2-1,y+2,2,1);}return;
    }
    if(kind==='collector'||kind==='vault'){
      c.fillStyle=dark;c.fillRect(x,y,2,h);c.fillRect(x+w-2,y,2,h);c.fillRect(x,y+h-2,w,2);c.fillStyle=metal;c.fillRect(x,y,1,h);c.fillRect(x+w-1,y,1,h);
      c.fillStyle=kind==='collector'?'#8d7436':'#77618b';c.fillRect(x+2,y+h-4,w-4,2);c.fillStyle=active?'#F3CF4C':'#D69B32';c.fillRect(x+2,y+h-2,w-4,1);return;
    }
    if(kind==='lift'){
      c.fillStyle=dark;c.fillRect(x,y,1,h);c.fillRect(x+w-1,y,1,h);c.fillStyle=metal;
      for(let i=0;i<h;i+=5)c.fillRect(x+1,y+(i+phase)%h,w-2,1);return;
    }
    if(kind==='pipe'){
      c.fillStyle=dark;c.fillRect(x,y,w,h);c.fillStyle=metal;c.fillRect(x,y,w,1);c.fillRect(x,y+h-1,w,1);c.fillStyle=m.buffer?.count?materials[m.buffer.material].color:'#474D52';c.fillRect(x,y+1,w,h-2);return;
    }
    if(kind==='pump'||kind==='valve'){
      c.fillStyle=dark;c.fillRect(x,y+1,w,h-2);c.fillStyle=metal;c.fillRect(x+1,y,w-2,h);c.fillStyle='#474D52';c.fillRect(x+2,y+2,Math.max(1,w-4),Math.max(1,h-4));
      c.fillStyle=active?'#569cce':gold;c.fillRect(x+2,y+2,1,2);if(kind==='pump'){c.fillStyle=metal;c.fillRect(x-1,y+2,2,2);c.fillRect(x+w-1,y+h-3,2,2);}
      else{const p=outlet(m);c.fillStyle=gold;c.fillRect(p.x,p.y,1,1);}return;
    }
    if(kind==='press'){
      c.fillStyle=dark;c.fillRect(x,y,w,h);c.fillStyle=m.flash>0?'#f3cf4c':metal;c.fillRect(x,y+(m.flash>7?1:0),w,2);
      c.fillStyle=gold;for(let i=1;i<w;i+=4)c.fillRect(x+i,y+h-1,2,1);return;
    }
    if(kind==='launcher'){
      c.fillStyle=dark;c.fillRect(x+2,y+2,w-4,h-2);c.fillStyle=metal;c.fillRect(x,y,w,1);c.fillRect(x+2,y+h-1,w-4,1);c.fillStyle=gold;
      c.save();c.translate(x+(dir>0?w-2:2),y+1);c.rotate(-(m.angle??35)*Math.PI/180*dir);c.fillRect(dir>0?0:-4,-1,4,2);c.restore();return;
    }
    if(kind==='sensor'){
      c.fillStyle=metal;c.fillRect(x,y,w,h);c.fillStyle=m.signal?'#d3d794':'#ad5b4e';c.fillRect(x+1,y+1,w-2,h-2);return;
    }
    c.fillStyle=dark;c.fillRect(x,y,w,h);c.fillStyle=metal;c.fillRect(x,y,w,1);c.fillRect(x,y,1,h);c.fillRect(x+w-1,y,1,h);c.fillStyle='#474D52';c.fillRect(x+2,y+2,w-4,h-4);
    if(['kiln','crucible','heater'].includes(kind)){
      c.fillStyle='#795443';c.fillRect(x+2,y+2,w-4,h-4);c.fillStyle='#342c29';c.fillRect(x+4,y+4,w-8,h-7);
      c.fillStyle=active?'#ea9036':'#674530';c.fillRect(x+4,y+4,w-8,h-7);if(active){c.fillStyle=phase%2?'#f3cf4c':'#ffb354';c.fillRect(x+5,y+5,w-10,2);}
      c.fillStyle=metal;c.fillRect(x+2,y+2,w-4,1);
    }else if(kind==='crusher'||kind==='separator'){
      for(let i=3;i<w-2;i+=3){c.fillStyle=(i+phase)%2?metal:gold;c.fillRect(x+i,y+3+(phase%2),1,h-6);}
    }else if(kind==='mist'){
      c.fillStyle='#7893a5';c.fillRect(x+2,y+2,w-4,h-4);const p=outlet(m);c.fillStyle=metal;c.fillRect(p.x,p.y,2,2);
    }else if(kind==='drill'){
      c.fillStyle=gold;c.fillRect(x+3,y+2,w-6,3);c.fillStyle=metal;for(let i=2;i<w-2;i+=3)c.fillRect(x+i,y+h-2+(phase%2),2,2);
    }
    c.fillStyle=!m.enabled?'#b76353':active?'#f3cf4c':m.status==='Saída bloqueada'?'#d5774b':'#8c9296';c.fillRect(x+w-3,y+2,1,1);
  }
  private ports(m:Machine){const c=this.ctx;for(const p of machinePorts(m)){c.fillStyle=p.label==='Ouro'?'#F3CF4C':p.label==='Resíduo'?'#aaa092':p.label==='Entrada'?'#b0c6d6':'#D69B32';c.fillRect(p.x-1,p.y-1,3,1);c.fillRect(p.x,p.y,1,2);}}
  private explorer(s:RenderState){
    const c=this.ctx,p=s.player,x=Math.round(p.x),y=Math.round(p.y),walk=p.grounded&&p.vx!==0?Math.round(Math.sin(s.world.tick*.6)):0;
    c.fillStyle='#292d31';c.fillRect(x-3,y-7,6,6);c.fillStyle='#ac8051';c.fillRect(x-2,y-6,4,4);c.fillStyle='#D69B32';c.fillRect(x-3,y-11,6,2);c.fillRect(x-4,y-9,8,1);
    c.fillStyle='#bfd1db';c.fillRect(x+(p.facing>0?0:-2),y-8,3,2);c.fillStyle='#474D52';c.fillRect(x-p.facing*4,y-7,2,5);
    c.fillStyle='#17191D';c.fillRect(x-2,y-2+walk,2,2);c.fillRect(x+1,y-2-walk,2,2);c.fillStyle='#899096';c.fillRect(x-2,y+walk,2,1);c.fillRect(x+1,y-walk,2,1);
    const angle=Math.atan2(s.pointer.y-(y-5),s.pointer.x-x);c.save();c.translate(x,y-5);c.rotate(angle);c.fillStyle='#899096';c.fillRect(1,-1,6,2);c.fillStyle=s.tool==='thermal'?'#ffb354':'#D69B32';c.fillRect(6,-1,2,2);c.restore();
    if(p.thrust&&!s.paused){c.fillStyle='#f3cf4c';c.fillRect(x-p.facing*4,y-2,2,2+s.world.tick%3);c.fillStyle='#e78030';c.fillRect(x-p.facing*4,y+1,1,2);this.burst(x-p.facing*4,y+2,3,1);}
  }
  private minimap(s:RenderState){
    if(this.mini.closest('.map-panel')?.classList.contains('collapsed'))return;
    const c=this.mini.getContext('2d')!,width=this.mini.width,height=this.mini.height,sx=width/s.world.width,sy=height/s.world.height;
    c.fillStyle='#17191D';c.fillRect(0,0,width,height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const wx=Math.min(s.world.width-1,Math.floor(x/sx)),wy=Math.min(s.world.height-1,Math.floor(y/sy)),mat=s.world.get(wx,wy);if(mat!==Mat.Air){c.fillStyle=materials[mat].color;c.fillRect(x,y,1,1);}}
    for(const chamber of chambers(s.world)){c.fillStyle='#bf88e4';c.fillRect(chamber.x*sx-1,chamber.y*sy-3,3,3);}
    for(const m of s.factory.machines){c.fillStyle='#D69B32';c.fillRect(m.x*sx,m.y*sy,Math.max(1,m.w*sx),Math.max(1,m.h*sy));}
    c.fillStyle='#fff2be';c.fillRect(s.player.x*sx-2,s.player.y*sy-2,4,4);
    c.strokeStyle='#a1a5a9';c.lineWidth=1;c.strokeRect(-this.origin.x/this.camera.zoom*sx,-this.origin.y/this.camera.zoom*sy,this.width/this.camera.zoom*sx,this.height/this.camera.zoom*sy);
    void regionAt;
  }
}
