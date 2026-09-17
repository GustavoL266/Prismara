import { Mat, materials } from '../sim/materials';
import { machineSolid, outlet, type Machine } from '../sim/machines';
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
/** Hand-drawn logical pixels. Mechanics retain their original footprints. */
export function drawMachine(c:CanvasRenderingContext2D,m:Machine,time:number,peers:Machine[]=[]) {
  const {x,y,w,h,kind}=m,run=operating(m),phase=run?Math.floor(time*10):0,pulse=run?m.flash:0,dir=m.rotation%2?-1:1;
  const pixel=(xx:number,yy:number,ww:number,hh:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.floor(xx),Math.floor(yy),ww,hh);};
  const body=()=>{
    pixel(x,y,w,h,INK);pixel(x+1,y+1,w-2,h-2,STEEL);pixel(x+1,y+1,w-2,1,LIGHT);pixel(x+1,y+2,1,h-3,MID);
    pixel(x+w-2,y+2,1,h-3,CAVITY);pixel(x+2,y+h-2,w-4,1,CAVITY);
  };
  if(['block','platform','wall','gate','funnel'].includes(kind)) {
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(machineSolid(m,xx,yy)) {
      const top=!machineSolid(m,xx,yy-1)||yy===y,edge=xx===x+w-1||yy===y+h-1;
      pixel(xx,yy,1,1,top?SHINE:edge?'#98611E':(xx+yy)%7===0?'#B07925':AMBER);
    }
    if(kind==='gate'&&(!m.enabled||!m.signal)){pixel(x,y,2,2,SHINE);pixel(x+w-2,y+h-2,2,2,AMBER);}return;
  }
  if(['belt','fastbelt','hauler'].includes(kind)) {
    pixel(x,y,w,h,INK);pixel(x,y,w,1,CAVITY);
    for(let i=1;i<w-1;i+=4){pixel(x+i,y+1,2,1,MID);pixel(x+i,y+1,1,1,LIGHT);pixel(x+i+2,y+2,1,1,BLUE);}
    for(let i=2;i<w-2;i+=4)pixel(x+((i+phase*dir)%w+w)%w,y,1,1,AMBER);
    pixel(x,y+1,1,h-1,AMBER);pixel(x+w-1,y+1,1,h-1,AMBER);
    if(kind==='fastbelt')for(let i=3;i<w-1;i+=4)pixel(x+i,y+1,1,1,PALE);
    if(kind==='hauler')for(let i=2;i<w-1;i+=6)pixel(x+i,y+2,3,1,AMBER);return;
  }
  if(kind==='sieve'||kind==='filter') {
    pixel(x,y,w,1,INK);pixel(x+1,y+1,w-2,1,MID);
    for(let i=2;i<w-2;i+=3){pixel(x+i,y+(kind==='sieve'&&pulse>0?phase%2:0),1,1,LIGHT);pixel(x+i+1,y+1,1,1,CAVITY);}
    pixel(x,y+1,2,h-1,AMBER);pixel(x+w-2,y+1,2,h-1,AMBER);pixel(x+3,y+h-1,2,1,STEEL);pixel(x+w-5,y+h-1,2,1,STEEL);
    pixel(dir>0?x+w-2:x,y,2,1,SHINE);
    if(kind==='sieve'){pixel(x+1,y+2,2,2,CAVITY);pixel(x+1,y+2+(pulse>0?phase%2:0),1,1,BLUE);}
    else{pixel(x+6,y+2,4,1,INK);pixel(x+7,y+2,2,1,materials[m.filter].color);pixel(x+2,y+2,2,1,BLUE);}return;
  }
  if(kind==='collector'||kind==='vault') {
    pixel(x,y,2,h,INK);pixel(x+w-2,y,2,h,INK);pixel(x,y+h-2,w,2,INK);
    pixel(x,y,1,h-1,LIGHT);pixel(x+w-2,y,1,h-1,MID);pixel(x+1,y+h-2,w-2,1,STEEL);
    pixel(x+2,y+h-4,w-4,2,kind==='vault'?'#6D527E':CAVITY);
    if(kind==='collector'){pixel(x+2,y+2,2,h-6,AMBER);pixel(x+w-4,y+2,2,h-6,AMBER);pixel(x+6,y+h-3,w-12,1,pulse>0?'#F3CF4C':BLUE);}
    else{pixel(x+3,y+2,1,h-5,MID);pixel(x+w-4,y+2,1,h-5,MID);pixel(x+5,y+h-3,w-10,1,'#9A6BB8');}return;
  }
  if(kind==='lift') {
    pixel(x,y,1,h,STEEL);pixel(x+w-1,y,1,h,INK);pixel(x,y,1,2,LIGHT);pixel(x+1,y,w-2,1,AMBER);
    for(let n=0;n<h-2;n+=5){const yy=y+1+(n+phase)%(h-2);pixel(x+1,yy,w-2,1,MID);pixel(x+1,yy,1,1,BLUE);}pixel(x+1,y+h-1,w-2,1,AMBER);return;
  }
  if(kind==='pipe') {
    const a=pipeConnections(m,peers),fluid=m.buffer?.count?materials[m.buffer.material].color:BLUE;
    const horizontal=a.left||a.right||(!a.up&&!a.down);
    if(horizontal){pixel(x,y+1,w,2,STEEL);pixel(x,y+1,w,1,LIGHT);pixel(x+1,y+2,w-2,1,fluid);}
    if(a.up||a.down){pixel(x+1,y,2,h,STEEL);pixel(x+1,y,1,h,LIGHT);pixel(x+2,y+1,1,h-2,fluid);}
    if(!a.left&&!a.right&&!a.up&&!a.down){pixel(x,y+1,1,2,AMBER);pixel(x+w-1,y+1,1,2,AMBER);}return;
  }
  if(kind==='pump') {
    body();pixel(x+1,y+2,w-2,h-3,CAVITY);pixel(x+2,y+2,2,2,run&&phase%2?PALE:BLUE);pixel(x,y+2,1,2,AMBER);pixel(x+w-1,y+h-3,1,2,AMBER);return;
  }
  if(kind==='valve') {
    pixel(x,y,w,h,INK);pixel(x+1,y+1,2,2,MID);pixel(x,y,w,1,LIGHT);pixel(x+1,y+1,1,1,AMBER);
    const p=outlet(m),dx=Math.sign(p.x-(x+w/2)),dy=Math.sign(p.y-(y+h/2));pixel(dx<0?x:dx>0?x+w-1:x+1,dy<0?y:dy>0?y+h-1:y+1,dx?1:2,dy?1:2,run?PALE:BLUE);return;
  }
  if(kind==='press') {
    pixel(x,y,w,h,INK);pixel(x,y+(pulse>7?1:0),w,1,pulse>7?SHINE:LIGHT);pixel(x+1,y+2,w-2,1,STEEL);
    for(let i=2;i<w-1;i+=4){pixel(x+i,y+1,1,2,BLUE);pixel(x+i,y+h-1,2,1,AMBER);}return;
  }
  if(kind==='launcher') {
    pixel(x,y,w,1,LIGHT);pixel(x+1,y+1,w-2,h-1,INK);pixel(x+2,y+h-2,w-4,1,AMBER);
    for(let n=2;n<w-2;n+=2)pixel(x+n,y+2,1,2,MID);
    const a=(m.angle??35)*Math.PI/180;
    for(let n=0;n<4;n++)pixel(x+(dir>0?5:4)+Math.round(Math.cos(a)*n)*dir,y+4-Math.round(Math.sin(a)*n),1,1,n===3?(pulse>0?SHINE:PALE):MID);return;
  }
  if(kind==='sensor') {body();pixel(x+1,y+2,3,2,CAVITY);pixel(x+2,y+2,1,1,!m.enabled?MID:m.signal?'#A5C96A':'#CB6652');return;}
  if(kind==='lamp') {
    pixel(x,y,w,h,INK);pixel(x+1,y+1,w-2,2,run?SHINE:STEEL);pixel(x+1,y+1,1,1,run?'#FFF1BB':LIGHT);pixel(x+2,y+3,2,h-4,MID);pixel(x+1,y+h-1,w-2,1,AMBER);return;
  }
  body();
  if(['kiln','crucible','heater'].includes(kind)) {
    const chamberX=kind==='crucible'?x+3:x+4, chamberWidth=kind==='crucible'?w-6:w-8;
    pixel(x+2,y+2,w-4,h-4,'#855D43');
    for(let yy=y+2;yy<y+h-2;yy+=3)for(let xx=x+2;xx<x+w-2;xx+=4)pixel(xx,yy,3,1,'#61483A');
    pixel(chamberX-1,y+3,chamberWidth+2,h-6,INK);pixel(chamberX,y+4,chamberWidth,h-8,run?'#E98532':CAVITY);
    if(run)pixel(chamberX+1,y+4,chamberWidth-2,1,phase%2?'#FFD16E':'#F4AB48');
    if(kind==='kiln'){pixel(x+2,y+2,2,1,MID);pixel(dir>0?x+w-2:x+1,y+h-3,1,1,AMBER);}
    if(kind==='crucible'){pixel(x+5,y+2,w-10,1,LIGHT);pixel(x+w/2-1,y+h-2,2,1,AMBER);}
    if(kind==='heater')for(let n=3;n<w-3;n+=3)pixel(x+n,y+2,1,1,BLUE);
  }else if(kind==='crusher') {
    pixel(x+2,y+3,w-4,h-5,CAVITY);
    for(let n=0;n<2;n++){const xx=x+3+n*4;pixel(xx,y+3,3,4,MID);pixel(xx+1,y+3,1,4,BLUE);pixel(xx,y+3+phase%3,3,1,LIGHT);}pixel(x+5,y+h-2,2,1,AMBER);
  }else if(kind==='separator') {
    pixel(x+3,y+3,w-6,h-5,INK);pixel(x+4,y+3,w-8,h-5,MID);pixel(x+5,y+3,2,h-5,LIGHT);
    for(let n=3;n<h-3;n+=3)pixel(x+4,y+n+(phase%2),w-8,1,STEEL);pixel(dir>0?x+w-2:x+1,y+h-3,1,1,AMBER);
  }else if(kind==='mist') {
    pixel(x+2,y+2,w-4,h-4,BLUE);pixel(x+3,y+2,1,h-4,PALE);pixel(x+1,y+h-3,w-2,1,STEEL);
  }else if(kind==='drill') {
    pixel(x+2,y+2,w-4,3,AMBER);pixel(x+3,y+2,w-6,1,SHINE);pixel(x+4,y+3,2,1,BLUE);
    for(let n=2;n<w-2;n+=3){pixel(x+n,y+h-2,2,1,MID);pixel(x+n+(pulse>0?phase%2:0),y+h-1,1,1,LIGHT);}
  }
  const indicator=!m.enabled?'#CB6652':run?SHINE:m.status==='Saída bloqueada'?'#DE7A42':MID;
  pixel(x+w-3,y+2,1,1,indicator);
}
