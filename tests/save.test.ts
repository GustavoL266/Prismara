import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/sim/world';
import { Mat, materials } from '../src/sim/materials';
import { Factory } from '../src/sim/machines';
import { Player } from '../src/game/player';
import { deserialize, serialize, SAVE_VERSION, type Saveable } from '../src/game/save';

function sample(): Saveable {
  const world = new World(128, 96, 9123), factory = new Factory(world), player = new Player();
  const vault = factory.add('vault', 20, 65)!;
  factory.add('separator', 48, 22);
  const filter = factory.add('filter', 78, 45)!;
  filter.mode = 'density'; filter.densityMin = 155; filter.densityMax = 225; filter.rotation = 1;
  const pump = factory.add('pump', 8, 12)!;
  factory.add('pipe', 14, 12);
  const valve = factory.add('valve', 18, 12)!;
  valve.rotation = 1; valve.enabled = false;
  pump.buffer = { material: Mat.Water, count: 23, temperature: 68.5 };
  const sensor = factory.add('sensor', 67, 15)!;
  sensor.targetId = filter.id; sensor.filter = Mat.Clay; sensor.signal = false;
  world.set(vault.x + 3, vault.y + vault.h - 2, Mat.Crystal, 27);
  world.set(vault.x + 4, vault.y + vault.h - 2, Mat.Crystal, 29);
  world.set(52, 21, Mat.Pulp, 42);
  world.set(103, 8, Mat.Pellet, 179); world.fall[world.index(103, 8)] = 19;
  world.set(106, 12, Mat.Steam, 145);
  world.set(110, 26, Mat.Mist, -51);
  world.set(40, 63, Mat.Water, 38);
  factory.energy.value = 317.25; factory.energy.capacity = 1800;
  factory.counters.pulp = 35; factory.counters.energy = 160; factory.counters.stored = 8;
  factory.nextId += 7;
  world.tick = 117; world.rng(); world.rng();
  world.reactionCounts = { pulp: 104, crystal: 7, glass: 4 };
  factory.pipes.rebuild(factory.machines);
  player.x = 56.25; player.y = 63.5; player.vx = 36; player.vy = -23.75;
  player.fuel = 72.5; player.facing = -1; player.thrust = true;
  const inventory = new Array<number>(materials.length).fill(0);
  inventory[Mat.Sand] = 371; inventory[Mat.Water] = 93; inventory[Mat.Quartz] = 8;
  return { world, factory, player, inventory,
    progress: { mined: 527, mixed: 202, crystalsMade: 14, tier: 3, ruins: true, won: false, elapsed: 631.5, mission: 9 },
    preferences: { volume: 0.28, shake: false, zoom: 4.25 } };
}

test('save roundtrip retains particles, heat, fall, RNG, reaction counters and sleeping chunks', () => {
  const original = sample(); original.world.active[0] = 0;
  const restored = deserialize(serialize(original));
  for (const field of ['cells', 'temperature', 'fall', 'active', 'blocked'] as const)
    assert.deepEqual(restored.world[field], original.world[field], field);
  assert.equal(restored.world.seed, original.world.seed);
  assert.equal(restored.world.tick, original.world.tick);
  assert.deepEqual(restored.world.reactionCounts, original.world.reactionCounts);
  assert.equal(restored.world.rngState, original.world.rngState);
  assert.equal(restored.world.rng(), original.world.rng());
});

test('save restores factory, physical vault, networks, research, explorer and preferences without stepping', () => {
  const original = sample(), restored = deserialize(serialize(original));
  assert.deepEqual(restored.factory.machines, original.factory.machines);
  assert.deepEqual(restored.factory.counters, original.factory.counters);
  assert.equal(restored.factory.nextId, original.factory.nextId);
  assert.deepEqual(restored.factory.energy, original.factory.energy);
  assert.equal(restored.factory.countCrystals(), 2);
  const pump = restored.factory.machines.find(m => m.kind === 'pump')!;
  assert.deepEqual(restored.factory.pipes.inspect(pump.id), original.factory.pipes.inspect(pump.id));
  assert.equal(restored.factory.pipes.inspect(pump.id).count, 23);
  assert.deepEqual(restored.player, original.player);
  assert.deepEqual(restored.inventory, original.inventory);
  assert.deepEqual(restored.progress, original.progress);
  assert.deepEqual(restored.preferences, original.preferences);
  assert.equal(restored.world.get(52, 21), Mat.Pulp, 'loading must not process the separator');
});

test('a restored operating factory continues deterministically for 90 fixed ticks', () => {
  const a = sample();
  for (let i = 0; i < 13; i++) { a.factory.step(); a.world.step(); }
  const b = deserialize(serialize(a));
  for (let i = 0; i < 90; i++) {
    a.factory.step(); a.world.step(); b.factory.step(); b.world.step();
    a.player.update(a.world, new Set(['KeyD', 'Space']), 1 / 30);
    b.player.update(b.world, new Set(['KeyD', 'Space']), 1 / 30);
  }
  assert.deepEqual(b.world.cells, a.world.cells);
  assert.deepEqual(b.world.temperature, a.world.temperature);
  assert.deepEqual(b.world.fall, a.world.fall);
  assert.equal(b.world.rngState, a.world.rngState);
  assert.deepEqual(b.factory.machines, a.factory.machines);
  assert.deepEqual(b.factory.counters, a.factory.counters);
  assert.deepEqual(b.factory.energy, a.factory.energy);
  assert.deepEqual(b.player, a.player);
});

test('early v1 saves without optional movement and activity fields remain loadable', () => {
  const data = JSON.parse(serialize(sample()));
  delete data.world.active; delete data.world.reactionCounts; delete data.nextId; delete data.preferences;
  for (const key of ['vx', 'vy', 'facing', 'thrust', 'grounded']) delete data.player[key];
  const restored = deserialize(JSON.stringify(data));
  assert.equal(restored.world.active.every(n => n === 1), true);
  assert.equal(restored.player.vx, 0); assert.equal(restored.preferences.volume, 0.18);
});

test('corrupt, incompatible, truncated and resource-duplicating saves are rejected', () => {
  for (const raw of ['not json', 'null', '[]', '{', JSON.stringify({ version: SAVE_VERSION + 1 })])
    assert.throws(() => deserialize(raw));
  const mutations: Array<(data: any) => void> = [
    data => { data.world.width = 640.5; }, data => { data.world.seed = -1; },
    data => { data.world.tick = 1.5; }, data => { data.world.cells = [Mat.Sand, 999999]; },
    data => { data.world.temperature = [40000, 1]; }, data => { data.world.fall.pop(); },
    data => { data.world.active = [2, 48]; }, data => { data.world.reactionCounts.crystal = -1; },
    data => { data.machines[1].id = data.machines[0].id; }, data => { data.machines[0].filter = 99; },
    data => { data.machines[0].densityMin = 999; }, data => { data.machines[0].enabled = 'true'; },
    data => { data.machines.push({ ...data.machines[0], id: 90 }); data.nextId = 91; },
    data => { data.machines.find((m: any) => m.kind === 'pump').buffer.count = 49; },
    data => { data.machines.find((m: any) => m.kind === 'pump').buffer.material = Mat.Molten; },
    data => { data.machines.find((m: any) => m.kind === 'pump').buffer.temperature = null; },
    data => { data.energy.value = data.energy.capacity + 1; }, data => { data.counters.pulp = -1; },
    data => { data.nextId = 1; }, data => { data.player.fuel = -1; }, data => { data.player.vy = null; },
    data => { data.inventory[Mat.Sand] = -10; }, data => { data.progress.mission = 8.5; },
    data => { data.progress.won = 1; }, data => { data.preferences.shake = 'yes'; },
  ];
  mutations.forEach((mutate, index) => {
    const data = JSON.parse(serialize(sample())); mutate(data);
    assert.throws(() => deserialize(JSON.stringify(data)), `corrupt case ${index}`);
  });
});

test('loading cannot overwrite explorer methods or retain unrecognized object properties', () => {
  const data = JSON.parse(serialize(sample()));
  data.player.update = 'broken'; data.progress.extra = 'ignored'; data.preferences.extra = 'ignored';
  const restored = deserialize(JSON.stringify(data));
  assert.equal(typeof restored.player.update, 'function');
  assert.equal('extra' in restored.progress, false); assert.equal('extra' in restored.preferences, false);
});
