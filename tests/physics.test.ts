import test from 'node:test';
import assert from 'node:assert/strict';
import { Mat, materials } from '../src/sim/materials';
import { REACTIONS } from '../src/sim/reactions';
import { World } from '../src/sim/world';
import { generateTerrain } from '../src/sim/terrain';

function advance(world: World, ticks: number): void { for (let n = 0; n < ticks; n++) world.step(); }

test('lumen pollen drifts downward slowly and intense heat converts it to vapor', () => {
  const world=new World(40,40,94);
  world.set(20,5,Mat.Lumen);advance(world,10);
  const i=world.cells.indexOf(Mat.Lumen);
  assert.equal(Math.floor(i/world.width),10);
  world.set(i%world.width,Math.floor(i/world.width),Mat.Lumen,300);world.step();
  assert.equal(world.count(Mat.Lumen),0);assert.equal(world.count(Mat.Steam),1);
});
function position(world: World, mat: Mat): { x: number; y: number } {
  const i = world.cells.indexOf(mat); return { x: i % world.width, y: Math.floor(i / world.width) };
}

test('sand falls exactly once per fixed step and accumulates impact distance', () => {
  const world = new World(16, 40, 4);
  world.set(8, 3, Mat.Sand);
  advance(world, 20);
  const p = position(world, Mat.Sand);
  assert.equal(p.y, 23);
  assert.equal(world.fall[world.index(p.x, p.y)], 20);
  assert.equal(world.count(Mat.Sand), 1);
});

test('liquid spreads across a floor and retains its volume', () => {
  const world = new World(24, 15, 29);
  for (let x = 0; x < 24; x++) world.set(x, 12, Mat.Rock);
  for (let y = 2; y < 9; y++) world.set(12, y, Mat.Water);
  advance(world, 100);
  assert.equal(world.count(Mat.Water), 7);
  const occupied = Array.from(world.cells.entries()).filter(([, mat]) => mat === Mat.Water);
  assert.ok(occupied.every(([i]) => Math.floor(i / world.width) === 11));
  assert.ok(new Set(occupied.map(([i]) => i % world.width)).size > 4);
});

test('steam rises and remains contained beneath a ceiling', () => {
  const world = new World(20, 24, 31);
  for (let x = 0; x < 20; x++) world.set(x, 2, Mat.Rock, 120);
  world.set(10, 18, Mat.Steam, 140);
  advance(world, 18);
  assert.equal(world.count(Mat.Steam), 1);
  assert.equal(position(world, Mat.Steam).y, 3);
});

test('dense quartz displaces water without losing either particle', () => {
  const world = new World(12, 18, 19);
  for (let y = 8; y < 17; y++) for (let x = 1; x < 11; x++) world.set(x, y, Mat.Water);
  world.set(6, 6, Mat.Quartz);
  advance(world, 30);
  assert.equal(position(world, Mat.Quartz).y, 17);
  assert.equal(world.count(Mat.Water), 90);
});

test('sand consumes one finite water cell and becomes one wet sand cell', () => {
  const world = new World(12, 16, 25);
  world.set(5, 8, Mat.Sand); world.set(6, 8, Mat.Water);
  world.step();
  assert.equal(world.count(Mat.WetSand), 1);
  assert.equal(world.count(Mat.Sand), 0);
  assert.equal(world.count(Mat.Water), 0);
  assert.equal(world.reactionCounts.wet, 1);
  assert.equal(world.count(Mat.Pulp), 0);
});

test('paste falls more slowly than water', () => {
  const world = new World(24, 35, 51);
  world.set(4, 2, Mat.Pulp); world.set(18, 2, Mat.Water);
  advance(world, 12);
  assert.ok(position(world, Mat.Pulp).y < position(world, Mat.Water).y);
});

test('heated water boils and steam condenses against a cold surface', () => {
  const world = new World(15, 16, 3);
  world.set(4, 9, Mat.Water, 140); world.step();
  assert.equal(world.count(Mat.Steam), 1);
  world.set(5, 9, Mat.Rock, -20); world.step();
  assert.equal(world.count(Mat.Water), 1);
});

test('hot quartz melts; mist quenches molten glass with configured yield', () => {
  const world = new World(12, 12, 317);
  world.set(6, 6, Mat.Quartz, REACTIONS.melting.temperature + 50); world.step();
  assert.equal(world.count(Mat.Molten), 1);
  world.set(7, 6, Mat.Mist); world.step();
  assert.equal(world.count(Mat.Molten), 0);
  assert.equal(world.count(Mat.Crystal) + world.count(Mat.Glass), 1);
  assert.equal(world.count(Mat.Water), 1);
  let crystals = 0;
  for (let n = 0; n < 1000; n++) {
    world.clear(); world.rngState = n * 139 + 7;
    world.set(5, 5, Mat.Molten); world.set(6, 5, Mat.Mist); world.step();
    crystals += world.count(Mat.Crystal);
  }
  assert.ok(crystals > 590 && crystals < 710, `yield was ${crystals}/1000`);
});

test('machine obstacles stop particles and preserve landing distance for presses', () => {
  const world = new World(10, 40, 15);
  for (let x = 0; x < 10; x++) world.blocked[world.index(x, 30)] = 1;
  world.set(5, 5, Mat.Pellet);
  advance(world, 35);
  const p = position(world, Mat.Pellet);
  assert.equal(p.y, 29);
  assert.equal(world.fall[world.index(p.x, p.y)], 24);
});

test('a sleeping pile wakes after support is excavated', () => {
  const world = new World(12, 25, 41);
  for (let x = 0; x < 12; x++) world.set(x, 12, Mat.Rock);
  world.set(5, 11, Mat.Sand); advance(world, 5);
  for (let x = 0; x < 12; x++) world.set(x, 12, Mat.Air);
  advance(world, 8);
  assert.ok(position(world, Mat.Sand).y > 12);
});

test('deep terrain generation is repeatable with accessible start resources and deposits', () => {
  const a = new World(), b = new World();
  generateTerrain(a); generateTerrain(b);
  assert.deepEqual(a.cells, b.cells);
  assert.equal(a.get(130, 154), Mat.Air);
  assert.ok(a.count(Mat.Water) > 200);
  assert.ok(a.count(Mat.Quartz) > 100);
  assert.ok(a.count(Mat.Crystal) >= 16);
  assert.equal(materials[Mat.Molten].transportable, false);
});

test('terrain landings reset stored impact while machine landings preserve it', () => {
  const world = new World(16, 42, 6);
  for (let x = 0; x < world.width; x++) world.set(x, 28, Mat.Rock);
  world.set(8, 3, Mat.Pellet); advance(world, 30);
  const p = position(world, Mat.Pellet);
  assert.equal(p.y, 27); assert.equal(world.fall[world.index(p.x, p.y)], 0);
});

test('starter basin retains water instead of completing the mixing objective on its own', () => {
  const world = new World(); generateTerrain(world);
  const initial = world.count(Mat.Water);
  advance(world, 150);
  assert.equal(world.reactionCounts.pulp, 0);
  assert.equal(world.reactionCounts.crystal, 0, 'ruin rewards are not manufactured crystals');
  assert.equal(world.count(Mat.Water), initial);
  assert.equal(world.reactionCounts.wet,0);
  world.clear(); assert.deepEqual(world.reactionCounts, { pulp: 0, crystal: 0, glass: 0, wet:0,calcined:0 });
});
