import { blocksPlayer } from '../sim/player-collision';
import type { World } from '../sim/world';
export const PLAYER_BODY={halfWidth:2,height:9} as const;
export function playerOverlaps(px:number,py:number,solid:(x:number,y:number)=>boolean):boolean {
  for(let y=Math.floor(py-PLAYER_BODY.height+1);y<=Math.floor(py);y++)for(let x=Math.floor(px-PLAYER_BODY.halfWidth);x<=Math.floor(px+PLAYER_BODY.halfWidth);x++)if(solid(x,y))return true;return false;
}
export class Player {
  x = 130; y = 151; vx = 0; vy = 0; facing = 1; grounded = false; thrust = false; fuel = 100;
  propulsion = 0;
  update(world: World, keys: Set<string>, dt: number) {
    const direction = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    this.vx = direction * 36;
    if (direction) this.facing = direction;
    this.thrust = (keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp')) && this.fuel > 0;
    if (this.thrust) { this.vy = Math.max(-43-this.propulsion*8, this.vy - (190+this.propulsion*30) * dt); this.fuel = Math.max(0, this.fuel - (15-this.propulsion*2) * dt); }
    else { this.vy = Math.min(72, this.vy + 92 * dt); this.fuel = Math.min(100, this.fuel + 24 * dt); }
    this.move(world, this.vx * dt, 0);
    this.grounded = false; this.move(world, 0, this.vy * dt);
    this.x = Math.max(5, Math.min(world.width - 5, this.x));
    this.y = Math.max(8, Math.min(world.height - 10, this.y));
  }
  private move(world: World, dx: number, dy: number) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), 1));
    for (let step = 0; step < steps; step++) {
      const nx = this.x + dx / steps, ny = this.y + dy / steps;
      if (this.collides(world, nx, ny)) {
        if (dy > 0) this.grounded = true;
        if (dy) this.vy = 0;
        return;
      }
      this.x = nx; this.y = ny;
    }
  }
  private collides(world: World, px: number, py: number): boolean {
    return playerOverlaps(px,py,(x,y)=>blocksPlayer(world,x,y));
  }
}
