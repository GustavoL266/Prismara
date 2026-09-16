import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/sim/world';
import { Mat } from '../src/sim/materials';
import { Factory, RECIPES } from '../src/sim/machines';
import { Energy, ENERGY } from '../src/sim/energy';

const setup = () => { const world = new World(128, 100, 4103); return { world, factory: new Factory(world) }; };

test('separator conserves every pulp grain as clay and adds the configured quartz bonus', () => {
  const { world, factory } = setup();
  const m = factory.add('separator', 30, 20)!;
  for (let i = 0; i < 300; i++) {
    world.tick = i * RECIPES.separator.every;
    world.set(m.x + 3, m.y - 1, Mat.Pulp);
    factory.step();
    assert.equal(world.get(m.x + m.w, m.y + m.h - 3), Mat.Clay);
    world.set(m.x + m.w, m.y + m.h - 3, Mat.Air);
    world.set(m.x + Math.floor(m.w / 2), m.y + m.h, Mat.Air);
  }
  assert.equal(factory.counters.clay, 300);
  assert.equal(factory.counters.pulp, 300);
  assert.ok(factory.counters.quartz > 40 && factory.counters.quartz < 95);
});

test('blocked separator output preserves input material', () => {
  const { world, factory } = setup(); const m = factory.add('separator', 30, 20)!;
  world.set(m.x + 3, m.y - 1, Mat.Pulp);
  world.set(m.x + m.w, m.y + m.h - 3, Mat.Rock);
  factory.step();
  assert.equal(world.get(m.x + 3, m.y - 1), Mat.Pulp);
  assert.equal(m.status, 'Saída bloqueada');
});

test('kiln bootstraps pellets on slow solar heat without electrical energy', () => {
  const { world, factory } = setup(); const m = factory.add('kiln', 30, 20)!;
  factory.energy.value = 0; world.tick = RECIPES.kiln.solarEvery;
  world.set(m.x + 3, m.y - 1, Mat.Clay); factory.step();
  assert.equal(world.get(m.x + m.w, m.y + m.h - 3), Mat.Pellet);
  assert.equal(factory.energy.value, 0);
});

test('piezo requires a physical fall of 18 cells; weak pellets stay on the press', () => {
  const { world, factory } = setup(); const m = factory.add('press', 30, 55)!;
  world.set(m.x + 3, m.y - 1, Mat.Pellet);
  world.fall[world.index(m.x + 3, m.y - 1)] = 17; factory.step();
  assert.equal(world.get(m.x + 3, m.y - 1), Mat.Pellet);
  assert.equal(factory.counters.impacts, 0);
  world.fall[world.index(m.x + 3, m.y - 1)] = 18; factory.step();
  assert.equal(world.get(m.x + 3, m.y - 1), Mat.Air);
  assert.equal(world.get(m.x + m.w, m.y + m.h - 1), Mat.Shard);
  assert.equal(factory.energy.value, ENERGY.initial + ENERGY.impact);
  assert.equal(factory.counters.impacts, 1);
});

test('real falling pellet reaches the press and powers the electrical bus', () => {
  const { world, factory } = setup(); factory.add('press', 30, 55)!;
  world.set(36, 30, Mat.Pellet);
  for (let i = 0; i < 45; i++) { factory.step(); world.step(); }
  assert.equal(factory.counters.impacts, 1);
  assert.equal(factory.counters.energy, ENERGY.impact);
});

test('energy cannot become negative or exceed capacity', () => {
  const e = new Energy(); e.value = 2;
  assert.equal(e.spend(3), false); assert.equal(e.value, 2);
  assert.equal(e.spend(-1), false); assert.equal(e.spend(1.5), true);
  assert.equal(e.value, 0.5);
  e.add(10000); assert.equal(e.value, e.capacity);
});

test('crucible pays energy only when molten glass can be emitted physically', () => {
  const { world, factory } = setup(); const m = factory.add('crucible', 30, 20)!;
  world.set(m.x + 3, m.y - 1, Mat.Quartz); factory.energy.value = 0;
  factory.step(); assert.equal(m.status, 'Sem energia');
  assert.equal(world.get(m.x + 3, m.y - 1), Mat.Quartz);
  factory.energy.value = 10; factory.step();
  const output = world.index(m.x + Math.floor(m.w / 2), m.y + m.h);
  assert.equal(world.cells[output], Mat.Molten);
  assert.equal(world.temperature[output], RECIPES.crucible.temperature);
  assert.equal(factory.energy.value, 10 - ENERGY.melt);
});

test('crucible displaces outlet mist without deleting coolant and permits physical quenching', () => {
  const { world, factory } = setup(); const m = factory.add('crucible', 30, 20)!;
  const ox = m.x + Math.floor(m.w / 2), oy = m.y + m.h;
  world.set(m.x + 3, m.y - 1, Mat.Quartz);
  world.set(ox, oy, Mat.Mist, -45);
  factory.step();
  assert.equal(world.get(ox, oy), Mat.Molten);
  assert.equal(world.count(Mat.Mist), 1, 'displaced coolant remains in the world');
  world.step();
  assert.equal(world.count(Mat.Crystal) + world.count(Mat.Glass), 1);
  assert.equal(world.count(Mat.Water), 1, 'quenching returns the coolant as water');
});

test('sealed or structurally blocked gas outlet preserves quartz and energy', () => {
  for (const solidMachine of [false, true]) {
    const { world, factory } = setup(); const m = factory.add('crucible', 30, 20)!;
    const ox = m.x + Math.floor(m.w / 2), oy = m.y + m.h;
    world.set(m.x + 3, m.y - 1, Mat.Quartz); world.set(ox, oy, Mat.Mist, -45);
    if (solidMachine) assert.ok(factory.add('belt', m.x, oy));
    else for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0]]) world.set(ox + dx, oy + dy, Mat.Wall);
    const energyBefore = factory.energy.value;
    factory.step();
    assert.equal(world.count(Mat.Quartz), 1); assert.equal(world.count(Mat.Mist), 1);
    assert.equal(world.count(Mat.Molten), 0); assert.equal(factory.energy.value, energyBefore);
    assert.equal(m.status, 'Saída bloqueada');
  }
});

test('removing machine support wakes a settled sleeping pile', () => {
  const { world, factory } = setup(); const belt = factory.add('belt', 30, 30)!;
  belt.enabled = false;
  world.set(37, 29, Mat.Sand);
  for (let i = 0; i < 30; i++) { factory.step(); world.step(); }
  assert.equal(world.get(37, 29), Mat.Sand);
  assert.equal(world.active[1 * world.chunksX + 2], 0);
  assert.equal(factory.remove(belt.id), true);
  world.step();
  assert.equal(world.get(37, 30), Mat.Sand);
});

test('mist consumes physical water and emits a cold gas in the chosen direction', () => {
  const { world, factory } = setup(); const m = factory.add('mist', 30, 20, 1)!;
  world.set(m.x + 3, m.y - 1, Mat.Water); factory.step();
  assert.equal(world.get(m.x + 3, m.y - 1), Mat.Air);
  assert.equal(world.get(m.x + m.w, m.y), Mat.Mist);
  assert.ok(world.temperature[world.index(m.x + m.w, m.y)] < 0);
});

test('only physical crystals inside vaults fund research, and spending removes them', () => {
  const { world, factory } = setup(); const m = factory.add('vault', 30, 20)!;
  world.set(5, 5, Mat.Crystal);
  world.set(m.x + 3, m.y + 3, Mat.Crystal); world.set(m.x + 4, m.y + 3, Mat.Crystal);
  assert.equal(factory.countCrystals(), 2);
  assert.equal(factory.spendCrystals(3), false); assert.equal(factory.countCrystals(), 2);
  assert.equal(factory.spendCrystals(1), true); assert.equal(factory.countCrystals(), 1);
  factory.remove(m.id); assert.equal(world.count(Mat.Crystal), 2);
});

test('density gate drops accepted grains and conveys rejected grains', () => {
  const { world, factory } = setup(); const m = factory.add('filter', 30, 20)!;
  m.mode = 'density'; m.densityMin = 200; m.densityMax = 260;
  world.set(35, 19, Mat.Quartz); world.set(40, 19, Mat.Sand); factory.step();
  assert.equal(world.get(35, 24), Mat.Quartz);
  assert.equal(world.get(41, 19), Mat.Sand);
});

test('disconnected pipes retain separate liquids; a connected valve returns physical liquid', () => {
  const { world, factory } = setup();
  const a = factory.add('pump', 10, 20)!;
  factory.add('pipe', 16, 20)!; factory.add('valve', 20, 20)!;
  const b = factory.add('pump', 50, 20)!;
  world.set(9, 20, Mat.Water); world.set(49, 20, Mat.Pulp); factory.step();
  assert.equal(world.get(22, 24), Mat.Water);
  assert.equal(factory.pipes.inspect(a.id).count, 0);
  assert.equal(factory.pipes.inspect(b.id).material, Mat.Pulp);
  assert.equal(factory.pipes.inspect(b.id).count, 1);
  assert.notEqual(factory.pipes.inspect(a.id).networkId, factory.pipes.inspect(b.id).networkId);
});

test('removing a pipe conserves buffered liquid as particles', () => {
  const { world, factory } = setup(); const p = factory.add('pipe', 30, 20)!;
  p.buffer = { material: Mat.Water, count: 30, temperature: 42 };
  assert.equal(factory.remove(p.id), true);
  assert.equal(world.count(Mat.Water), 30);
});

test('molten glass is rejected by ordinary pumps', () => {
  const { world, factory } = setup(); const m = factory.add('pump', 30, 20)!;
  world.set(m.x - 1, m.y, Mat.Molten, 1100); factory.step();
  assert.equal(factory.pipes.inspect(m.id).count, 0);
  assert.equal(world.get(m.x - 1, m.y), Mat.Molten);
});

test('presence sensor produces a real machine control signal', () => {
  const { world, factory } = setup(); const belt = factory.add('belt', 30, 35)!;
  const sensor = factory.add('sensor', 35, 20)!;
  sensor.targetId = belt.id; sensor.filter = Mat.Sand;
  factory.step(); assert.equal(belt.signal, false);
  world.set(sensor.x + 1, sensor.y - 3, Mat.Sand); factory.step();
  assert.equal(belt.signal, true); assert.equal(sensor.status, 'Sinal ligado');
});
