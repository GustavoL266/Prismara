import { World } from '../sim/world';
import { chambers, surfaceAt } from '../sim/terrain';

export const DISCOVERY_RADIUS = 80;
export const LAMP_DISCOVERY_RADIUS = 38;
export interface DiscoverySource { id: number; x: number; y: number; radius: number }

/** Persistent knowledge and last observed matter; never participates in physics. */
export class Exploration {
  readonly width: number;
  readonly height: number;
  readonly discoveredCells: Uint8Array;
  readonly rememberedMaterial: Uint8Array;
  points: string[] = [];
  map = { x: 0, y: 0, zoom: 1 };
  revision = 0;
  updateMs = 0;
  private previous?: { x: number; y: number };
  private sourceKeys = new Map<number, string>();
  private observationTick = -1;

  constructor(private physical: World) {
    this.width = physical.width; this.height = physical.height;
    this.discoveredCells = new Uint8Array(this.width * this.height);
    this.rememberedMaterial = new Uint8Array(this.discoveredCells.length);
    this.map={x:this.width/2,y:this.height/2,zoom:1};
  }
  /** Reveal only the stored external profile, never flood-fill cavern air. */
  revealSurface() {
    for(let x=0;x<this.width;x++)for(let y=0;y<=Math.min(this.height-1,surfaceAt(this.physical,x)+3);y++){
      const i=y*this.width+x;
      if(!this.discoveredCells[i]){this.discoveredCells[i]=1;this.rememberedMaterial[i]=this.physical.cells[i];}
    }
    this.revision++;
  }
  matches(world: World) { return this.physical === world; }
  knows(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height && !!this.discoveredCells[y * this.width + x];
  }
  footprint(x: number, y: number, width: number, height: number): boolean {
    for (let yy=y; yy<y+height; yy++) for (let xx=x; xx<x+width; xx++) if (!this.knows(xx, yy)) return false;
    return true;
  }
  /** Observe exactly the cells in a world-space disk, including solid deposits. */
  reveal(x: number, y: number, radius = DISCOVERY_RADIUS) {
    const r2 = radius * radius;
    for (let yy=Math.max(0, Math.floor(y-radius)); yy<Math.min(this.height, Math.ceil(y+radius)); yy++) {
      const dy=yy+.5-y, half=Math.sqrt(Math.max(0,r2-dy*dy));
      for (let xx=Math.max(0, Math.ceil(x-half-.5)); xx<=Math.min(this.width-1, Math.floor(x+half-.5)); xx++) {
        if ((xx+.5-x)**2+dy*dy>r2) continue;
        const i=yy*this.width+xx;
        this.discoveredCells[i]=1; this.rememberedMaterial[i]=this.physical.cells[i];
      }
    }
    this.revision++;
  }
  update(x: number, y: number, sources: DiscoverySource[] = [], teleport = false) {
    const start=performance.now(), old=this.previous, distance=old?Math.hypot(x-old.x,y-old.y):Infinity;
    const moved=distance>1e-6 || teleport;
    if (moved) {
      const count=old&&!teleport?Math.max(1,Math.ceil(distance/(DISCOVERY_RADIUS/3))):1;
      for (let n=1;n<=count;n++) this.reveal(old&&!teleport?old.x+(x-old.x)*n/count:x,old&&!teleport?old.y+(y-old.y)*n/count:y);
      this.previous={x,y};
    } else if (this.physical.tick-this.observationTick>=12 || this.observationTick<0) this.reveal(x,y);
    const retained = new Set<number>();
    for (const source of sources) {
      retained.add(source.id); const key=source.x+':'+source.y+':'+source.radius;
      if (this.sourceKeys.get(source.id)!==key || this.physical.tick-this.observationTick>=12 || this.observationTick<0) this.reveal(source.x,source.y,source.radius);
      this.sourceKeys.set(source.id,key);
    }
    for (const id of this.sourceKeys.keys()) if (!retained.has(id)) this.sourceKeys.delete(id);
    if (this.physical.tick-this.observationTick>=12 || this.observationTick<0) this.observationTick=this.physical.tick;
    for (const c of chambers(this.physical)) if (this.knows(c.x,c.y-20) && !this.points.includes(c.id)) this.points.push(c.id);
    this.updateMs=performance.now()-start;
  }
  /** Old saves have footprints, but no evidence of the historical route. */
  migrate(x: number, y: number, machines: { x:number; y:number; w:number; h:number }[]) {
    this.update(x,y,[],true);
    for (const m of machines) for(let yy=m.y;yy<m.y+m.h;yy++) for(let xx=m.x;xx<m.x+m.w;xx++) {
      const i=yy*this.width+xx;this.discoveredCells[i]=1;this.rememberedMaterial[i]=this.physical.cells[i];
    }
    this.revision++;
  }
}
