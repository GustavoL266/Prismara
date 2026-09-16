import { World, CHUNK_SIZE } from '../sim/world';
import { Mat, materials } from '../sim/materials';
import { MACHINE_DEFS, type Machine, type MachineKind, type Factory } from '../sim/machines';
import type { Player } from '../game/player';

export interface RenderState { world:World; factory:Factory; player:Player; time:number; pointer:{x:number,y:number}; tool:string; building:MachineKind; rotation:number; selectedId:number; paused:boolean; shake:boolean; won:boolean }
export class Renderer {
  canvas:HTMLCanvasElement; ctx:CanvasRenderingContext2D; mini:HTMLCanvasElement;
  camera={x:210,y:124,zoom:3}; follow=true;
  private terrain=document.createElement('canvas'); private terrainCtx:CanvasRenderingContext2D;
  private pixels?:ImageData; private colors:number[][][];
  private effectX=new Float32Array(320);private effectY=new Float32Array(320);private effectVX=new Float32Array(320);private effectVY=new Float32Array(320);private effectLife=new Float32Array(320);private effectColor=new Uint8Array(320);private effectIndex=0;
  width=1280;height=720;
  constructor(canvas:HTMLCanvasElement,mini:HTMLCanvasElement){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false})!;this.mini=mini;this.terrainCtx=this.terrain.getContext('2d')!;
    this.colors=materials.map(m=>m.palette.map(hex=>{const n=parseInt(hex.slice(1),16);return [n>>16,(n>>8)&255,n&255];}));
    this.resize();window.addEventListener('resize',()=>this.resize());
  }
  resize(){this.width=window.innerWidth;this.height=window.innerHeight;this.canvas.width=this.width;this.canvas.height=this.height;this.ctx.imageSmoothingEnabled=false;}
  worldPoint(x:number,y:number){return {x:Math.floor((x-this.width/2)/this.camera.zoom+this.camera.x),y:Math.floor((y-this.height/2)/this.camera.zoom+this.camera.y)};}
  screenPoint(x:number,y:number){return {x:(x-this.camera.x)*this.camera.zoom+this.width/2,y:(y-this.camera.y)*this.camera.zoom+this.height/2};}
  burst(x:number,y:number,color=0,count=8){for(let k=0;k<count;k++){const i=this.effectIndex++%320;this.effectX[i]=x;this.effectY[i]=y;this.effectVX[i]=(Math.random()-.5)*35;this.effectVY[i]=-Math.random()*28;this.effectLife[i]=.35+Math.random()*.5;this.effectColor[i]=color;}}
  render(s:RenderState,dt:number){
    const {ctx:c}=this,w=s.world,z=this.camera.zoom;
    if(this.follow){const desiredX=Math.max(190,Math.min(w.width-120,s.player.x+50));const desiredY=s.player.y<185?124:s.player.y-18;this.camera.x+=(desiredX-this.camera.x)*Math.min(1,dt*3);this.camera.y+=(desiredY-this.camera.y)*Math.min(1,dt*3);}
    this.background(s);
    if(this.terrain.width!==w.width||this.terrain.height!==w.height){this.terrain.width=w.width;this.terrain.height=w.height;this.pixels=this.terrainCtx.createImageData(w.width,w.height);}
    const data=this.pixels!.data;
    // Only changed chunks repaint the reused one-pixel-per-cell texture.
    let changed=false;
    for(let chunk=0;chunk<w.dirty.length;chunk++){
      if(!w.dirty[chunk])continue;w.dirty[chunk]=0;changed=true;
      const x0=(chunk%w.chunksX)*CHUNK_SIZE,y0=Math.floor(chunk/w.chunksX)*CHUNK_SIZE;
      for(let y=y0;y<Math.min(y0+CHUNK_SIZE,w.height);y++)for(let x=x0;x<Math.min(x0+CHUNK_SIZE,w.width);x++){
        const i=w.index(x,y),m=w.cells[i],offset=i*4;
        if(m===Mat.Air){data[offset+3]=0;continue;}
        let hash=Math.imul(i^(i>>>13),0x45d9f3b);hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=(hash^(hash>>>16))>>>0;
        const palette=this.colors[m],pattern=materials[m].pattern;
        const variation=pattern==='stripe'?((x+y)%4===0?1:hash%palette.length):pattern==='wave'?(y%3===0?1:hash%palette.length):pattern==='spark'?(hash%5===0?1:hash%palette.length):hash%palette.length;
        const color=palette[variation%palette.length];
        data[offset]=color[0];data[offset+1]=color[1];data[offset+2]=color[2];
        data[offset+3]=(m===Mat.Steam?145:m===Mat.Mist?165:255);
      }
    }
    if(changed)this.terrainCtx.putImageData(this.pixels!,0,0);
    const shake=s.shake&&s.factory.machines.some(m=>m.kind==='press'&&m.flash>8)?Math.sin(s.time*100)*1.2:0;
    c.save();c.translate(Math.round(this.width/2-this.camera.x*z+shake),Math.round(this.height/2-this.camera.y*z));c.scale(z,z);c.imageSmoothingEnabled=false;
    this.scenery(s);
    for(const m of s.factory.machines)if(['pipe','pump','valve'].includes(m.kind))this.machine(c,m,s.time,true);
    c.drawImage(this.terrain,0,0);
    for(const m of s.factory.machines)if(!['pipe','pump','valve'].includes(m.kind))this.machine(c,m,s.time,false);
    this.signals(s);
    this.explorer(s);
    for(let i=0;i<320;i++)if(this.effectLife[i]>0){if(!s.paused){this.effectLife[i]-=dt;this.effectX[i]+=this.effectVX[i]*dt;this.effectY[i]+=this.effectVY[i]*dt;this.effectVY[i]+=40*dt;}c.globalAlpha=Math.min(1,this.effectLife[i]*3);c.fillStyle=['#f5d884','#d4fff2','#cf9af3','#ffb864'][this.effectColor[i]];c.fillRect(Math.floor(this.effectX[i]),Math.floor(this.effectY[i]),1,1);}
    c.globalAlpha=1;
    this.worldLabels(s);
    if(s.tool==='build'){
      const def=MACHINE_DEFS[s.building],x=Math.floor(s.pointer.x/2)*2,y=Math.floor(s.pointer.y/2)*2;
      const playerBlocked=!['pipe','pump','valve','sensor'].includes(s.building)&&x<s.player.x+3&&x+def.w>s.player.x-3&&y<s.player.y+1&&y+def.h>s.player.y-12;
      const valid=s.factory.canPlace(s.building,x,y)&&!playerBlocked;
      c.globalAlpha=.45;this.machine(c,{id:0,kind:s.building,x,y,w:def.w,h:def.h,rotation:s.rotation,enabled:true,status:'Prévia',filter:Mat.Sand,densityMin:0,densityMax:300,mode:'material',flash:0} as Machine,s.time,false);c.globalAlpha=1;
      c.strokeStyle=valid?'#9df1bb':'#ff7979';c.lineWidth=.6;c.strokeRect(x-1,y-1,def.w+2,def.h+2);c.fillStyle=c.strokeStyle;
      c.beginPath();c.moveTo(x+def.w/2-2,y-6);c.lineTo(x+def.w/2+2,y-6);c.lineTo(x+def.w/2,y-3);c.fill();
      c.font='3px monospace';c.textAlign='center';c.fillText('ENTRADA',x+def.w/2,y-8);c.fillText('R · GIRAR',x+def.w/2,y+def.h+6);
    }else{
      c.strokeStyle=s.tool==='collect'?'#9cf0d7':s.tool==='pour'?'#b9a4ec':'#e7d3a7';c.lineWidth=.5;c.setLineDash([2,2]);c.strokeRect(s.pointer.x-4,s.pointer.y-4,9,9);c.setLineDash([]);
    }
    const selected=s.factory.machines.find(m=>m.id===s.selectedId);
    if(selected){c.strokeStyle='#e7fbb0';c.lineWidth=.6;c.strokeRect(selected.x-2,selected.y-2,selected.w+4,selected.h+4);this.ports(selected);}
    c.restore();this.lighting(s);
    if(s.time%8<1/30)this.minimap(s);else if(w.tick%6===0)this.minimap(s);
  }
  private background(s:RenderState){
    const c=this.ctx,z=this.camera.zoom,h=this.height,w=this.width,ground=this.screenPoint(0,174).y;
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#123b4c');sky.addColorStop(.45,'#4f9294');sky.addColorStop(.8,'#b9c9ad');sky.addColorStop(1,'#c6b98d');c.fillStyle=sky;c.fillRect(0,0,w,h);
    const sunX=w*.67-this.camera.x*.13,sunY=Math.max(70,ground-105*z);
    const halo=c.createRadialGradient(sunX,sunY,0,sunX,sunY,180);halo.addColorStop(0,'#ffeab859');halo.addColorStop(1,'#ffeab800');c.fillStyle=halo;c.fillRect(sunX-180,sunY-180,360,360);c.fillStyle='#f3deb0';c.beginPath();c.arc(sunX,sunY,22*z/3,0,Math.PI*2);c.fill();
    c.strokeStyle='#bfd6bf30';c.lineWidth=1;c.beginPath();c.ellipse(sunX,sunY,41,11,-.35,0,Math.PI*2);c.stroke();
    for(let layer=0;layer<4;layer++){
      c.fillStyle=['#6b9e9d','#759d91','#9aaa88','#b8b582'][layer];c.beginPath();c.moveTo(0,h);
      for(let x=0;x<=w+12;x+=12){const wx=x/z+this.camera.x*(.16+layer*.11);const ridge=Math.sin(wx*.013+layer*2)*11+Math.sin(wx*.03+layer)*5;const y=ground-(42-layer*10)*z+ridge*z;c.lineTo(x,Math.floor(y/3)*3);}
      c.lineTo(w,h);c.fill();
    }
    const underground=this.screenPoint(0,190).y;
    const cave=c.createLinearGradient(0,underground-20,0,underground+240);cave.addColorStop(0,'#25333200');cave.addColorStop(.2,'#182b30');cave.addColorStop(1,'#101923');c.fillStyle=cave;c.fillRect(0,underground-20,w,h-underground+20);
    c.fillStyle='#e9ebc53d';for(let i=0;i<25;i++){const x=((i*177+s.time*(3+i%3)-this.camera.x*.1)%(w+40)+w+40)%(w+40);const y=90+(i*91)%(Math.max(20,ground-90));c.fillRect(x,y,2,1);}
  }
  private scenery(s:RenderState){
    const c=this.ctx;
    // Angular native desert flora, antenna markers and a distant symmetrical ruin.
    for(const [x,y,scale] of [[35,170,1],[74,170,.65],[370,178,1.15],[443,170,.8],[496,168,.8]] as number[][]){
      c.fillStyle='#214b4a';c.fillRect(x,y-13*scale,2,13*scale);c.fillRect(x-5,y-9*scale,6,2);c.fillRect(x-6,y-15*scale,2,7);c.fillRect(x+1,y-13*scale,7,2);c.fillRect(x+6,y-19*scale,2,7);c.fillStyle='#a3c597';c.fillRect(x+5,y-20*scale,4,2);c.fillRect(x-7,y-16*scale,4,2);c.fillStyle='#ddbd83';c.fillRect(x-3,y,8,1);
    }
    c.fillStyle='#17353b';c.fillRect(93,150,2,20);c.fillStyle='#e1ce94';c.fillRect(95,150,10,6);c.fillStyle='#246f6d';c.fillRect(98,151,5,3);c.fillStyle='#94c9b2';c.fillRect(87,169,15,2);
    const rx=550,ry=164;
    for(const dir of [-1,1]){
      c.fillStyle='#243c46';c.fillRect(rx+dir*30-5,ry-42,11,44);c.fillStyle='#aebeb0';c.fillRect(rx+dir*30-4,ry-43,8,42);c.fillStyle='#d4d5ba';c.fillRect(rx+dir*30-5,ry-43,10,3);
      c.fillStyle=dir<0?'#78dcca':'#d797e5';c.fillRect(rx+dir*30,ry-36,1,28);
      c.fillStyle='#adc0b8';c.fillRect(rx+dir*19-7,ry-32,14,4);c.fillRect(rx+dir*13-5,ry-36,10,4);
    }
    c.fillStyle='#849e9c';c.fillRect(rx-38,ry,76,4);c.fillStyle='#d3d5b8';c.fillRect(rx-42,ry+4,84,3);
    const bob=Math.sin(s.time*1.5)*1.5;c.fillStyle=s.won?'#c6fff1':'#d1a0e5';c.beginPath();c.moveTo(rx,ry-30+bob);c.lineTo(rx+5,ry-21+bob);c.lineTo(rx,ry-12+bob);c.lineTo(rx-5,ry-21+bob);c.fill();c.fillStyle='#edf7de';c.fillRect(rx-1,ry-25+bob,2,8);
    c.strokeStyle='#a4e9d535';c.lineWidth=.6;c.beginPath();c.arc(rx,ry-21,12,0,Math.PI*2);c.stroke();
    for(let i=0;i<22;i++){const x=20+(i*137)%600,y=212+(i*37)%88;if(s.world.get(x,y)===Mat.Air){c.fillStyle=i%2?'#35595a':'#524961';c.fillRect(x,y,2,5);c.fillStyle='#709d96';c.fillRect(x,y,1,2);}}
  }
  machine(c:CanvasRenderingContext2D,m:Machine,time:number,secondary:boolean){
    const {x,y,w,h,kind}=m,def=MACHINE_DEFS[kind],active=m.enabled&&m.status==='Ativa',dir=m.rotation%2===0?1:-1;
    c.fillStyle='#102630';c.fillRect(x,y,w,h);c.fillStyle='#3b565b';c.fillRect(x+1,y+1,w-2,h-2);c.fillStyle='#263d45';c.fillRect(x+2,y+3,w-4,h-4);c.fillStyle='#789187';c.fillRect(x+1,y+1,w-2,1);
    if(kind==='belt'||kind==='fastbelt'){
      c.fillStyle='#c2b883';c.fillRect(x,y,w,1);for(let i=0;i<w-2;i+=4){const offset=Math.floor(time*(kind==='fastbelt'?12:6))*dir;c.fillStyle='#8fa7a0';c.fillRect(x+1+((i+offset)%Math.max(1,w-3)+w-3)%(w-3),y+1,2,1);}c.fillStyle='#142b34';c.fillRect(x+2,y+h-1,2,2);c.fillRect(x+w-4,y+h-1,2,2);
    }else if(kind==='separator'){
      c.fillStyle='#a6b99d';c.fillRect(x+3,y+3,w-6,h-7);c.fillStyle='#507b76';for(let i=0;i<3;i++)c.fillRect(x+4+i*3,y+4+((Math.floor(time*5)+i)%3),1,h-10);c.fillStyle='#e1c46f';c.fillRect(x+2,y+3,2,h-7);c.fillStyle='#0f2933';c.fillRect(x+w-2,y+h-5,3,3);c.fillRect(x+w/2-2,y+h-2,4,2);
    }else if(kind==='kiln'||kind==='crucible'){
      c.fillStyle='#ad7956';c.fillRect(x+2,y+3,w-4,h-5);c.fillStyle='#593e36';c.fillRect(x+4,y+5,w-8,h-9);c.fillStyle=active?'#ffce75':'#ca8c58';c.fillRect(x+5,y+6,w-10,Math.max(2,h-11));c.fillStyle='#f3e4a2';c.fillRect(x+6,y+7,Math.max(1,w-12),2);c.fillStyle='#c8b996';c.fillRect(x+3,y+2,w-6,1);c.fillStyle='#1d333a';c.fillRect(x+w/2-2,y+h-3,4,3);
    }else if(kind==='press'){
      c.fillStyle=m.flash>0?'#f2f7b3':'#b5baa1';c.fillRect(x,y,w,2);c.fillStyle='#efc15f';for(let i=1;i<w;i+=4)c.fillRect(x+i,y+2,2,2);c.fillStyle='#648d83';c.fillRect(x+2,y+5,w-4,h-6);
    }else if(kind==='vault'){
      // Preserve the view into the physical crystal cavity.
      c.fillStyle='#142d38';c.fillRect(x+2,y+2,w-4,h-4);c.drawImage(this.terrain,x+2,y+2,w-4,h-4,x+2,y+2,w-4,h-4);c.fillStyle='#96ded0';c.fillRect(x,y,2,h);c.fillRect(x+w-2,y,2,h);c.fillStyle='#78a7a0';c.fillRect(x,y+h-2,w,2);c.fillStyle='#d9a6e7';c.fillRect(x+1,y+h-2,w-2,1);
    }else if(kind==='mist'){
      c.fillStyle='#a8d7cc';c.fillRect(x+3,y+3,w-6,h-5);c.fillStyle='#5b999e';c.fillRect(x+4,y+4,w-8,h-7);c.fillStyle='#d2f5e4';c.fillRect(x+(m.rotation===3?0:m.rotation===1?w-2:w/2-1),y+(m.rotation===0?h-2:0),3,3);c.fillStyle='#80d3c5';for(let i=0;i<3;i++)c.fillRect(x+4,y+5+i*2,w-8,1);
    }else if(kind==='lift'){
      c.drawImage(this.terrain,x+1,y,w-2,h,x+1,y,w-2,h);
      c.fillStyle='#7d9a92';c.fillRect(x+1,y,1,h);c.fillRect(x+w-2,y,1,h);for(let i=0;i<h;i+=5){c.fillStyle='#c3c089';c.fillRect(x+2,y+(i+Math.floor(time*8))%h,w-4,1);}
    }else if(kind==='filter'){
      c.fillStyle='#94bcba';c.fillRect(x,y,w,2);c.fillStyle=materials[m.filter]?.color??'#91cbaa';c.fillRect(x+w/2-2,y+2,4,h-2);
    }else if(kind==='sensor'){
      c.fillStyle=m.signal?'#96e5ac':'#d87972';c.fillRect(x+2,y+2,w-4,h-4);c.fillStyle='#dfedc3';c.fillRect(x+3,y+3,1,1);
    }else if(secondary){
      c.fillStyle='#20363e';c.fillRect(x,y+1,w,h-2);c.fillStyle='#85b9bb';c.fillRect(x,y+1,w,1);c.fillRect(x,y+h-2,w,1);c.fillStyle=m.buffer?.count?'#67b4c4':'#3c6872';c.fillRect(x,y+2,w,h-4);if(kind!=='pipe'){c.fillStyle='#c4caa9';c.fillRect(x+2,y+2,w-4,h-4);c.fillStyle='#4a8087';c.fillRect(x+3,y+3,w-6,h-6);}
    }else if(kind==='crusher'){
      c.fillStyle='#b6c1a2';for(let i=0;i<3;i++){c.fillRect(x+3+i*3,y+3+(i%2),2,h-7);}c.fillStyle='#d8ad6f';c.fillRect(x+2,y+h-3,w-4,1);
    }
    c.fillStyle=m.enabled?(active?'#9bf0ba':'#e5bd70'):'#e37772';c.fillRect(x+w-3,y+2,1,1);
    if(m.flash>0&&kind==='press'){c.fillStyle='#fff9c2';c.fillRect(x-1,y-1,w+2,1);c.font='4px monospace';c.textAlign='center';c.fillText('+ energia',x+w/2,y-4-(14-m.flash)*.2);}
    if(!['pipe','belt','fastbelt','sensor'].includes(kind)){c.fillStyle='#102630';c.fillRect(x+1,y+h,2,2);c.fillRect(x+w-3,y+h,2,2);}
    void def;
  }
  private ports(m:Machine){
    const c=this.ctx,cx=m.x+Math.floor(m.w/2),side=m.rotation%2?m.x-3:m.x+m.w+3;
    const arrow=(x:number,y:number,dir:number,color:string)=>{c.save();c.translate(x,y);c.rotate(dir*Math.PI/2);c.fillStyle=color;c.beginPath();c.moveTo(-1.6,-2);c.lineTo(1.6,-2);c.lineTo(0,1);c.fill();c.restore();};
    if(!['pipe','sensor','pump','valve'].includes(m.kind))arrow(cx,m.y-3,0,'#b9eab4');
    if(['separator','kiln','press'].includes(m.kind))arrow(side,m.y+m.h-3,m.rotation%2?1:3,'#e1bf83');
    if(['separator','crucible','crusher','filter','valve'].includes(m.kind))arrow(cx,m.y+m.h+3,0,'#a4e5e4');
    if(m.kind==='mist'){
      const d=m.rotation,x=d===1?m.x+m.w+3:d===3?m.x-3:cx,y=d===0?m.y+m.h+3:d===2?m.y-3:m.y;
      arrow(x,y,(4-d)%4,'#a4e5e4');
    }
  }
  private explorer(s:RenderState){
    const c=this.ctx,p=s.player,x=Math.round(p.x),y=Math.round(p.y),step=Math.abs(p.vx)>0?Math.sin(s.time*17):0;
    c.fillStyle='#25414a55';c.fillRect(x-5,y+1,10,1);
    c.fillStyle='#102831';c.fillRect(x-3,y-7,6,6);c.fillRect(x-3,y-11,6,5);c.fillStyle='#e2d4a0';c.fillRect(x-2,y-10,5,3);c.fillStyle='#8fe0d8';c.fillRect(x+(p.facing>0?0:-2),y-9,3,2);c.fillStyle='#d1ac74';c.fillRect(x-2,y-6,4,4);c.fillStyle='#558789';c.fillRect(x-p.facing*4,y-7,2,5);c.fillStyle='#233841';c.fillRect(x-2,y-2+Math.round(step),2,3);c.fillRect(x+1,y-2-Math.round(step),2,3);c.fillStyle='#e8cf8e';c.fillRect(x+p.facing*3,y-5,3,2);c.fillStyle='#9de1d3';c.fillRect(x+p.facing*5,y-5,2,1);
    if(p.thrust){c.fillStyle='#d6ffe2';c.fillRect(x-p.facing*4,y-2,2,2+Math.floor(s.time*50)%4);this.burst(x-p.facing*3,y+1,1,1);}
    c.strokeStyle='#d9ebad70';c.lineWidth=.4;c.strokeRect(x-5,y-13,10,15);
  }
  private signals(s:RenderState){const c=this.ctx;for(const m of s.factory.machines)if(m.kind==='sensor'&&m.targetId){const target=s.factory.machines.find(t=>t.id===m.targetId);if(!target)continue;c.strokeStyle=m.signal?'#9cecad':'#dd7e7c';c.lineWidth=.5;c.beginPath();c.moveTo(m.x+m.w/2,m.y+m.h/2);c.lineTo(target.x+target.w/2,m.y-3);c.lineTo(target.x+target.w/2,target.y);c.stroke();}}
  private worldLabels(s:RenderState){
    const c=this.ctx;c.font='3px monospace';c.textAlign='left';c.fillStyle='#163941';c.fillText('POSTO 01 / AURORA',92,143);c.fillStyle='#305b5d';c.fillText('ÁGUA •',323,143);
    c.fillStyle='#c2dac1';c.fillText('CAVERNAS MINERAIS',188,231);c.fillStyle='#e5d0ec';c.fillText('FAROL DOS ECOS',522,108);
    for(const m of s.factory.machines)if(m.kind==='vault'){c.fillStyle='#d8faf0';c.textAlign='center';c.fillText(String(s.factory.countCrystals())+' ◇',m.x+m.w/2,m.y-4);}
  }
  private lighting(s:RenderState){
    const c=this.ctx,p=this.screenPoint(s.player.x,s.player.y),depth=Math.max(0,Math.min(.8,(s.player.y-180)/100));
    if(depth>0){const dark=c.createRadialGradient(p.x,p.y,15,p.x,p.y,210);dark.addColorStop(0,'#07151a00');dark.addColorStop(.5,`rgba(7,15,25,${depth*.2})`);dark.addColorStop(1,`rgba(7,15,25,${depth})`);c.fillStyle=dark;c.fillRect(0,0,this.width,this.height);}
    const glow=(x:number,y:number,color:string,r:number)=>{const q=this.screenPoint(x,y);if(q.x< -r||q.x>this.width+r)return;const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(q.x-r,q.y-r,r*2,r*2);};
    glow(s.player.x+6,s.player.y-5,'#e2fcb61e',75);glow(550,143,'#bd87ed32',120);
    for(const m of s.factory.machines){if(['kiln','crucible'].includes(m.kind))glow(m.x+m.w/2,m.y+m.h/2,'#ffa45722',60);if(m.kind==='mist')glow(m.x+m.w/2,m.y,'#94ffec18',50);if(m.kind==='vault')glow(m.x+m.w/2,m.y+m.h/2,'#c2aaff1b',60);}
    // Sample emissive particles without blurring their one-pixel physical representation.
    for(let i=0;i<s.world.cells.length;i+=23){const m=s.world.cells[i];if(m===Mat.Crystal||m===Mat.Molten)glow(i%s.world.width,Math.floor(i/s.world.width),m===Mat.Crystal?'#9af6ed14':'#ffbd6b18',14);}
  }
  private minimap(s:RenderState){const c=this.mini.getContext('2d')!;const w=this.mini.width,h=this.mini.height;c.imageSmoothingEnabled=false;c.fillStyle='#244750';c.fillRect(0,0,w,h);c.drawImage(this.terrain,0,0,w,h);const sx=w/s.world.width,sy=h/s.world.height;c.fillStyle='#dcb3ed';c.fillRect(541*sx,122*sy,5,12);c.fillStyle='#fff9c1';c.fillRect(s.player.x*sx-2,s.player.y*sy-2,4,4);for(const m of s.factory.machines){c.fillStyle='#83dccb';c.fillRect(m.x*sx,m.y*sy,Math.max(2,m.w*sx),Math.max(2,m.h*sy));}c.strokeStyle='#dbe6bd88';c.strokeRect((this.camera.x-this.width/this.camera.zoom/2)*sx,(this.camera.y-this.height/this.camera.zoom/2)*sy,this.width/this.camera.zoom*sx,this.height/this.camera.zoom*sy);}
}
