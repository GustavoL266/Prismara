import { materials } from '../sim/materials';
import { machineSolid, globalCell, type Machine } from '../sim/machines';
import { isPipeMachine } from '../sim/pipes';

const INK='#15191D',CAVITY='#242B32',STEEL='#404D59',MID='#6B8493',LIGHT='#B2C6CD',BLUE='#399CC9',PALE='#70C7DF',AMBER='#DA982C',SHINE='#F1BD4F';
export function operating(m:Machine) { return m.enabled&&m.signal&&(m.status==='Ativa'||m.flash>0||m.status==='Aquecimento solar'); }
export function pipeConnections(m:Machine, peers:Machine[]) {
  const fluid=peers.filter(p=>p.id!==m.id&&isPipeMachine(p));
  return {
    left:fluid.some(p=>p.x+p.w===m.x&&p.y<m.y+m.h&&p.y+p.h>m.y),
    right:fluid.some(p=>m.x+m.w===p.x&&p.y<m.y+m.h&&p.y+p.h>m.y),
    up:fluid.some(p=>p.y+p.h===m.y&&p.x<m.x+m.w&&p.x+p.w>m.x),
    down:fluid.some(p=>m.y+m.h===p.y&&p.x<m.x+m.w&&p.x+p.w>m.x),
  };
}
/** Original eight-cell sprites. Every solid pixel shares the physical transform. */
export function drawMachine(c:CanvasRenderingContext2D,m:Machine,time:number,peers:Machine[]=[]) {
  const run=operating(m),phase=run?Math.floor(time*10):0,kind=m.kind;
  const px=(x:number,y:number,color:string)=>{const p=globalCell(m,x,y);c.fillStyle=color;c.fillRect(p.x,p.y,1,1);};
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)px(xx,yy,color);};
  const body=()=>{rect(0,0,8,8,INK);rect(1,1,6,6,STEEL);rect(1,1,6,1,LIGHT);px(1,6,AMBER);px(6,6,AMBER);};
  if(['block','platform','wall','gate','funnel'].includes(kind)){
    for(let y=m.y;y<m.y+8;y++)for(let x=m.x;x<m.x+8;x++)if(machineSolid(m,x,y)){c.fillStyle=(x+y)%4===0?LIGHT:STEEL;c.fillRect(x,y,1,1);}
    if(kind==='gate'&&(!m.enabled||!m.signal)){px(0,7,AMBER);px(7,7,AMBER);}return;
  }
  if(['belt','fastbelt','hauler'].includes(kind)){
    rect(0,5,8,2,INK);for(let x=0;x<8;x++){px(x,5,(x+phase)%3===0?AMBER:LIGHT);px(x,6,x%2?MID:CAVITY);}
    if(kind==='hauler')for(let x=1;x<8;x+=3)px(x,6,AMBER);return;
  }
  if(kind==='sieve'||kind==='filter'){
    for(let x=0;x<8;x++)px(x,5,(x+phase)%2===0?LIGHT:STEEL);
    rect(0,6,1,2,AMBER);rect(7,6,1,2,AMBER);
    px(0,5,run?SHINE:MID);px(7,5,AMBER);
    if(kind==='filter')px(0,6,materials[m.filter].color);return;
  }
  if(kind==='collector'||kind==='vault'){
    rect(0,0,1,8,LIGHT);rect(7,0,1,8,MID);rect(0,7,8,1,STEEL);
    px(0,0,AMBER);px(7,0,AMBER);rect(2,7,4,1,kind==='vault'?'#aa66dc':run?'#f3cf4c':AMBER);return;
  }
  if(kind==='lift'){
    rect(0,0,1,8,LIGHT);rect(7,0,1,8,MID);for(let y=0;y<8;y++)if((y+phase)%3===0){px(1,y,AMBER);px(6,y,AMBER);}return;
  }
  if(kind==='pipe'){
    const links=pipeConnections(m,peers);const r=(x:number,y:number,w:number,h:number)=>{c.fillStyle=STEEL;c.fillRect(m.x+x,m.y+y,w,h);c.fillStyle=BLUE;c.fillRect(m.x+x,m.y+y,Math.max(1,w-1),Math.max(1,h-1));};
    r(3,3,2,2);if(links.left)r(0,3,4,2);if(links.right)r(4,3,4,2);if(links.up)r(3,0,2,4);if(links.down)r(3,4,2,4);if(!Object.values(links).some(Boolean))r(3,0,2,8);return;
  }
  if(kind==='pump'){
    rect(3,0,2,8,STEEL);rect(1,2,6,4,INK);rect(2,2,4,4,MID);rect(3,3,2,2,BLUE);
    if(phase%2){px(2,3,LIGHT);px(5,4,LIGHT);}else{px(3,2,LIGHT);px(4,5,LIGHT);}px(3,0,BLUE);return;
  }
  if(kind==='valve'){
    rect(3,0,2,8,STEEL);rect(1,2,6,3,INK);rect(2,3,4,1,AMBER);px(phase%2?4:3,2,LIGHT);rect(3,7,2,1,run?PALE:BLUE);return;
  }
  if(kind==='launcher'){
    rect(0,5,8,2,STEEL);rect(1,6,2,1,AMBER);rect(4,3,3,2,MID);px(7,2,LIGHT);px(6,3,INK);px(5,4,AMBER);return;
  }
  if(kind==='sensor'){
    rect(2,2,4,4,INK);rect(3,3,2,2,m.enabled&&m.signal?'#acbd76':'#90554e');px(3,1,MID);px(1,3,MID);px(6,4,MID);return;
  }
  if(kind==='lamp'){
    rect(3,4,2,4,MID);rect(1,0,6,4,INK);rect(2,1,4,2,run?SHINE:'#73643d');rect(2,7,4,1,STEEL);return;
  }
  body();
  if(['kiln','heater','crucible'].includes(kind)){
    rect(2,3,4,3,CAVITY);rect(3,4,2,2,run?'#ed843e':'#614330');if(run)px(3+phase%2,4,'#f4cf70');
    if(kind==='crucible'){px(2,3,AMBER);px(5,3,AMBER);rect(3,7,2,1,run?'#f6b04e':MID);}else if(kind==='heater')px(6,3,'#db723a');
  }else if(kind==='crusher'){
    rect(1,3,6,3,CAVITY);for(let x=2;x<6;x++){px(x,3+(x+phase)%2,LIGHT);px(x,5-(x+phase)%2,MID);}rect(3,7,2,1,INK);
  }else if(kind==='press'){
    rect(1,2,6,4,CAVITY);rect(3,1,2,run?2+phase%2:2,MID);rect(2,run?3+phase%2:3,4,1,LIGHT);rect(2,6,4,1,AMBER);
  }else if(kind==='separator'){
    rect(2,2,4,4,CAVITY);for(let y=2;y<6;y++)px(2+(y+phase)%4,y,AMBER);px(7,4,SHINE);rect(3,7,2,1,MID);
  }else if(kind==='mist'){
    for(let y=3;y<6;y++)rect(2,y,4,1,(y+phase)%2?BLUE:STEEL);rect(3,7,2,1,run?PALE:MID);
  }else if(kind==='drill'){
    rect(2,2,4,3,CAVITY);rect(3,3,2,4,MID);px(3+phase%2,5,AMBER);px(4,7,LIGHT);
  }
  px(6,1,run?SHINE:CAVITY);
}
