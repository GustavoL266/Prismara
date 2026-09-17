import type { Exploration } from '../game/exploration';

const FEATHER=6;
/** Feather lives entirely on the known side; never reads physical materials. */
export class FogBoundary {
  private distance=new Uint8Array(0);
  private width=0;private height=0;private left=0;private top=0;
  private key='';private source?:Exploration;
  update(e:Exploration,left:number,top:number,right:number,bottom:number) {
    const key=[e.revision,left,top,right,bottom].join(',');if(this.source===e&&this.key===key)return;
    this.source=e;this.key=key;this.left=left-FEATHER;this.top=top-FEATHER;this.width=right-left+FEATHER*2;this.height=bottom-top+FEATHER*2;
    const size=this.width*this.height;if(this.distance.length!==size)this.distance=new Uint8Array(size);
    const d=this.distance,w=this.width,h=this.height;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)d[y*w+x]=e.knows(this.left+x,this.top+y)?FEATHER:0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(d[i])d[i]=Math.min(d[i],d[i-1]+1,d[i-w]+1,d[i-w-1]+1,d[i-w+1]+1);}
    for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){const i=y*w+x;if(d[i])d[i]=Math.min(d[i],d[i+1]+1,d[i+w]+1,d[i+w-1]+1,d[i+w+1]+1);}
  }
  strength(x:number,y:number) { const t=this.distance[(y-this.top)*this.width+x-this.left]/FEATHER;return t*t*(3-2*t); }
}
