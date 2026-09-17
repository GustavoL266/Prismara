import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/sim/world';
import { Mat, materials } from '../src/sim/materials';
import { Factory, feedPoint, type Machine } from '../src/sim/machines';
import { ENERGY } from '../src/sim/energy';

type Feed = { machine: Machine; material: Mat; remaining: number };

/** Mirrors the player feeder: resources leave inventory only into an available physical cell. */
function advance(world: World, factory: Factory, ticks: number, feeds: Feed[] = [], inventory?: number[]) {
  for (let tick = 0; tick < ticks; tick++) {
    if (world.tick % 3 === 0) for (const feed of feeds) {
      if (feed.remaining < 1 || inventory && inventory[feed.material] < 1) continue;
      const p = feedPoint(feed.machine);
      if (feed.machine.kind === 'press') p.y = feed.machine.y - 26;
      for (const dx of [0, -1, 1, -2, 2]) {
        const x = p.x + dx, y = p.y;
        if (world.get(x, y) !== Mat.Air || world.blocked[world.index(x, y)]) continue;
        world.set(x, y, feed.material); feed.remaining--;
        if (inventory) inventory[feed.material]--;
        break;
      }
    }
    factory.step(); world.step();
  }
}

function harvest(world: World, inventory: number[], requested: Mat[]) {
  for (let i = 0; i < world.cells.length; i++) if (requested.includes(world.cells[i])) {
    inventory[world.cells[i]]++;
    world.set(i % world.width, Math.floor(i / world.width), Mat.Air);
  }
}

function thermalModule(world: World, factory: Factory) {
  const c = factory.add('crucible', 210, 102)!;
  const m = factory.add('mist', 219, 114, 3)!;
  assert.ok(c && m);
  for (let x = 208; x <= 234; x++) world.set(x, 135, Mat.Wall);
  for (let y = 114; y < 135; y++) { world.set(208, y, Mat.Wall); world.set(234, y, Mat.Wall); }
  for (let y = 111; y < 114; y++) world.set(225, y, Mat.Wall);
  return { c, m };
}

for (const seed of [4103, 91207]) test(`thermal module yields enough physical crystals for control research (seed ${seed})`, () => {
  const world = new World(320, 200, seed), factory = new Factory(world);
  const { c, m } = thermalModule(world, factory);
  factory.energy.value = 500;
  const feeds: Feed[] = [{ machine: c, material: Mat.Quartz, remaining: 40 }, { machine: m, material: Mat.Water, remaining: 80 }];
  advance(world, factory, 1200, feeds);
  assert.equal(factory.counters.molten, 40);
  assert.ok(world.count(Mat.Crystal) >= 12, `Only ${world.count(Mat.Crystal)} crystals; ${world.count(Mat.Glass)} fragments; ${world.count(Mat.Molten)} molten left`);
  assert.ok(factory.energy.value < 500);
});

test('magnetic lift gains height against gravity and throws only solid particles from its top', () => {
  const world = new World(128, 100, 4103), factory = new Factory(world);
  const lift = factory.add('lift', 30, 25)!;
  world.set(lift.x + 2, lift.y + lift.h - 3, Mat.Quartz);
  world.set(lift.x + 3, lift.y + lift.h - 3, Mat.Water);
  advance(world, factory, 12);
  const quartz: number[] = [], water: number[] = [];
  world.cells.forEach((mat, i) => { if (mat === Mat.Quartz) quartz.push(i); if (mat === Mat.Water) water.push(i); });
  assert.equal(quartz.length, 1); assert.equal(water.length, 1);
  assert.ok(Math.floor(quartz[0] / world.width) < lift.y + 16, 'solid should gain height each tick');
  assert.ok(Math.floor(water[0] / world.width) > lift.y + lift.h - 3, 'water should fall through the open lift');
  advance(world, factory, 20);
  const index = world.cells.findIndex(m => m === Mat.Quartz);
  assert.ok(index % world.width >= lift.x + lift.w, 'quartz should leave the lateral top port');
});

test('wet sand funds basic research with gold before the advanced ceramic energy and glass loop', () => {
  const world = new World(320, 200, 91207), factory = new Factory(world);
  factory.energy.value = 0;
  const inventory = Array(materials.length).fill(0) as number[];
  for (let x = 0; x < world.width; x++) world.set(x, 180, Mat.Wall);
  // Adjacent checkerboard of initial sand and water: reaction products are harvested, never synthesized.
  for (let y = 145; y < 165; y++) for (let x = 10; x < 50; x++) world.set(x, y, (x + y) % 2 ? Mat.Sand : Mat.Water);
  for (let y = 150; y < 158; y++) for (let x = 60; x < 70; x++) world.set(x, y, Mat.Water);
  advance(world, factory, 120);
  harvest(world, inventory, [Mat.WetSand, Mat.Water, Mat.Sand]);
  assert.equal(inventory[Mat.WetSand],400);
  const sieve=factory.add('sieve',30,30)!;
  advance(world,factory,2400,[{machine:sieve,material:Mat.WetSand,remaining:400}],inventory);
  harvest(world,inventory,[Mat.Residue,Mat.Gold]);
  assert.equal(inventory[Mat.Residue]+world.count(Mat.WetSand),400,'overflow grains stay physical instead of being deleted');
  assert.equal(factory.counters.wet,inventory[Mat.Residue]);assert.ok(inventory[Mat.Gold]>=70);
  const collector=factory.add('collector',270,50)!;
  advance(world,factory,180,[{machine:collector,material:Mat.Gold,remaining:16}],inventory);
  assert.equal(factory.gold,16);assert.equal(factory.energy.value,0);
  const separator = factory.add('separator', 30, 60)!;
  advance(world, factory, 2200, [{ machine: separator, material: Mat.Residue, remaining: inventory[Mat.Residue] }], inventory);
  harvest(world, inventory, [Mat.Clay, Mat.Quartz]);
  assert.ok(inventory[Mat.Clay] >= 18); assert.ok(inventory[Mat.Quartz] >= 40, `only ${inventory[Mat.Quartz]} quartz`);
  const kiln = factory.add('kiln', 65, 30)!;
  advance(world, factory, 1000, [{ machine: kiln, material: Mat.Clay, remaining: 16 }], inventory);
  harvest(world, inventory, [Mat.Pellet]); assert.ok(inventory[Mat.Pellet] >= 12);
  const press = factory.add('press', 85, 65)!;
  advance(world, factory, 180, [{ machine: press, material: Mat.Pellet, remaining: 12 }], inventory);
  assert.equal(factory.counters.impacts, 12); assert.equal(factory.counters.energy, 12 * ENERGY.impact);
  harvest(world, inventory, [Mat.Shard]); assert.equal(inventory[Mat.Shard], 12);
  const { c, m } = thermalModule(world, factory);
  advance(world, factory, 1200, [{ machine: c, material: Mat.Quartz, remaining: 40 }, { machine: m, material: Mat.Water, remaining: 80 }], inventory);
  harvest(world, inventory, [Mat.Crystal, Mat.Glass]);
  assert.ok(inventory[Mat.Crystal] >= 12, `only ${inventory[Mat.Crystal]} crystals after full chain`);
  const vault = factory.add('vault', 160, 100)!;
  advance(world, factory, 180, [{ machine: vault, material: Mat.Crystal, remaining: 12 }], inventory);
  assert.equal(factory.countCrystals(), 12); assert.equal(factory.spendCrystals(12), true); assert.equal(factory.countCrystals(), 0);
  const crusher = factory.add('crusher', 120, 70)!;
  const sandBefore = world.count(Mat.Sand);
  const wetBefore = world.reactionCounts.wet;
  advance(world, factory, 180, [{ machine: crusher, material: Mat.Shard, remaining: 12 }], inventory);
  assert.equal(factory.counters.recycled, 12);
  // Recycling may immediately wet a sand grain; count it once in either state.
  assert.equal(world.count(Mat.Sand) - sandBefore + world.reactionCounts.wet-wetBefore, 12);
  assert.ok(factory.energy.value > 0);
});
