import { World } from '../sim/world';
import { surfaceLevel } from '../sim/terrain';
import { operating } from './sprites';
import { materials } from '../sim/materials';
import type { Machine } from '../sim/machines';

export const lightRadius=(world:World,y:number)=>65-20*Math.max(0,Math.min(1,(y-surfaceLevel(world))/(world.height-surfaceLevel(world))));
/** Rays on a reusable 2-cell grid. Knowledge is deliberately absent from this class. */
export class Lighting {
  private field=new Float32Array(0);
  private smooth=new Float32Array(0);
  private sourceField=new Float32Array(0);
  private left=0;private top=0;private width=0;private height=0;
  private signature='';
  private physical?:World;
  updateMs=0;
  update(world:World,px:number,py:number,machines:Machine[],left:number,top:number,right:number,bottom:number,emissions:{x:number;y:number;r:number}[]=[]) {
    const lamps=machines.filter(m=>m.kind==='lamp'&&operating(m));
    if(this.physical!==world){this.physical=world;this.signature='';}
    const signature=[world.seed,world.tick,px.toFixed(1),py.toFixed(1),left,top,right,bottom,...lamps.map(m=>m.id+':'+m.x+':'+m.y),...emissions.map(s=>s.x+':'+s.y+':'+s.r)].join(',');
    if(signature===this.signature)return;this.signature=signature;
    const start=performance.now();this.left=left;this.top=top;this.width=Math.ceil((right-left)/2)+1;this.height=Math.ceil((bottom-top)/2)+1;
    const size=this.width*this.height;if(this.field.length!==size){this.field=new Float32Array(size);this.smooth=new Float32Array(size);this.sourceField=new Float32Array(size);}else this.field.fill(0);
    const sources=[{x:px,y:py-5,r:lightRadius(world,py)},...lamps.map(m=>({x:m.x+3,y:m.y+2,r:42})),...emissions];
    for(const source of sources) {
      if(source.x+source.r<left||source.x-source.r>right||source.y+source.r<top||source.y-source.r>bottom)continue;
      this.sourceField.fill(0);
      for(let ray=0;ray<160;ray++) {
        const a=ray*Math.PI*2/160,dx=Math.cos(a),dy=Math.sin(a);let transmission=1;
        for(let d=0;d<source.r;d++) {
          const x=Math.floor(source.x+dx*d),y=Math.floor(source.y+dy*d);
          const gx=Math.floor((x-left)/2),gy=Math.floor((y-top)/2),i=gy*this.width+gx;
          const intensity=(1-(d/source.r)**1.7)*transmission;
          if(gx>=0&&gy>=0&&gx<this.width&&gy<this.height)this.sourceField[i]=Math.max(this.sourceField[i],intensity);
          if(world.inBounds(x,y)){const i=world.index(x,y);if(world.consolidated[i]||materials[world.cells[i]].state==='terrain')transmission*=.83;}
          if(transmission<.018)break;
        }
      }
      const x0=Math.max(0,Math.floor((source.x-source.r-left)/2)),x1=Math.min(this.width-1,Math.ceil((source.x+source.r-left)/2));
      const y0=Math.max(0,Math.floor((source.y-source.r-top)/2)),y1=Math.min(this.height-1,Math.ceil((source.y+source.r-top)/2));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*this.width+x;this.field[i]=1-(1-this.field[i])*(1-this.sourceField[i]);}
    }
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++) {
      let sum=0,weight=0;
      for(let yy=Math.max(0,y-1);yy<=Math.min(this.height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(this.width-1,x+1);xx++) {
        const n=xx===x&&yy===y?4:1;sum+=this.field[yy*this.width+xx]*n;weight+=n;
      }
      this.smooth[y*this.width+x]=sum/weight;
    }
    this.updateMs=performance.now()-start;
  }
  intensity(x:number,y:number):number {
    const fx=(x-this.left)/2,fy=(y-this.top)/2,xx=Math.max(0,Math.min(this.width-2,Math.floor(fx))),yy=Math.max(0,Math.min(this.height-2,Math.floor(fy)));
    const u=Math.max(0,Math.min(1,fx-xx)),v=Math.max(0,Math.min(1,fy-yy)),i=yy*this.width+xx;
    return (this.smooth[i]*(1-u)+this.smooth[i+1]*u)*(1-v)+(this.smooth[i+this.width]*(1-u)+this.smooth[i+this.width+1]*u)*v;
  }
}
