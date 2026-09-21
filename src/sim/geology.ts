/** Seeded continuous value noise; does not consume the physics random sequence. */
export function mineralHash(x: number, y: number, seed: number): number {
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1442695041);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
export function generationSeed(seed:number,system:string,stage=0):number {let hash=(seed^Math.imul(stage+1,0x9e3779b1))>>>0;for(let i=0;i<system.length;i++)hash=Math.imul(hash^system.charCodeAt(i),16777619)>>>0;hash=Math.imul(hash^(hash>>>16),0x85ebca6b);hash=Math.imul(hash^(hash>>>13),0xc2b2ae35);return (hash^(hash>>>16))>>>0;}
export function generationRandom(seed:number,system:string,stage=0):()=>number {let state=generationSeed(seed,system,stage);return ()=>{let v=state+=0x6d2b79f5;v=Math.imul(v^(v>>>15),v|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296;};}
export function geologicalNoise(x: number, y: number, scale: number, seed: number): number {
  const xx=x/scale,yy=y/scale,ix=Math.floor(xx),iy=Math.floor(yy);
  const fx=xx-ix,fy=yy-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=mineralHash(ix,iy,seed),b=mineralHash(ix+1,iy,seed),c=mineralHash(ix,iy+1,seed),d=mineralHash(ix+1,iy+1,seed);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
