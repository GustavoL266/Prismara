/** Seeded continuous value noise; does not consume the physics random sequence. */
export function mineralHash(x: number, y: number, seed: number): number {
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1442695041);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
export function geologicalNoise(x: number, y: number, scale: number, seed: number): number {
  const xx=x/scale,yy=y/scale,ix=Math.floor(xx),iy=Math.floor(yy);
  const fx=xx-ix,fy=yy-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=mineralHash(ix,iy,seed),b=mineralHash(ix+1,iy,seed),c=mineralHash(ix,iy+1,seed),d=mineralHash(ix+1,iy+1,seed);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
