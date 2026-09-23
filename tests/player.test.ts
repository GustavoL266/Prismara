import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/sim/world';
import { Mat } from '../src/sim/materials';
import { Player } from '../src/game/player';

function setup(): { world: World; player: Player } {
  const world = new World(100, 90, 6), player = new Player();
  for (let x = 0; x < world.width; x++) world.set(x, 70, Mat.Rock);
  player.x = 30; player.y = 69;
  return { world, player };
}
function advance(world: World, player: Player, keys: string[], count: number): void {
  for (let n = 0; n < count; n++) player.update(world, new Set(keys), 1 / 30);
}

test('explorer walks with D/A and arrows while staying on terrain', () => {
  const { world, player } = setup(); advance(world, player, ['KeyD'], 15);
  assert.ok(player.x > 45 && player.x < 50);
  assert.ok(player.y < 70); assert.equal(player.grounded, true); assert.equal(player.facing, 1);
  advance(world, player, ['ArrowLeft'], 10);
  assert.ok(player.x < 40); assert.equal(player.facing, -1);
});

test('solid terrain and machine walls block horizontal motion without tunnelling', () => {
  const { world, player } = setup();
  for (let y = 30; y < 70; y++) world.set(50, y, Mat.Earth);
  advance(world, player, ['KeyD'], 50); assert.ok(player.x < 48, `position ${player.x} crossed terrain`);
  player.x = 30;
  for (let y = 30; y < 70; y++) world.blocked[world.index(40, y)] = 7;
  advance(world, player, ['KeyD'], 50); assert.ok(player.x < 38, `position ${player.x} crossed machine`);
});

test('propulsor lifts the explorer, spends fuel, and release restores fuel', () => {
  const { world, player } = setup(); advance(world, player, ['Space'], 20);
  assert.ok(player.y < 50); assert.ok(player.vy < 0);
  assert.equal(player.thrust, true); assert.ok(player.fuel < 100);
  const fuel = player.fuel; advance(world, player, [], 10);
  assert.equal(player.thrust, false); assert.ok(player.fuel > fuel);
  advance(world, player, [], 80); assert.ok(player.y < 70); assert.equal(player.grounded, true);
});

test('ceiling collision stops upward flight and zero fuel prevents immediate thrust', () => {
  const { world, player } = setup();
  for (let x = 0; x < world.width; x++) world.set(x, 45, Mat.Rock);
  advance(world, player, ['Space'], 50); assert.ok(player.y >= 54); assert.equal(player.vy, 0);
  player.fuel = 0; player.update(world, new Set(['Space']), 1 / 30);
  assert.equal(player.thrust, false); assert.ok(player.fuel > 0);
});

test('explorer stays within world and passes through settled granular piles and lands on terrain', () => {
  const { world, player } = setup(); advance(world, player, ['KeyA'], 100); assert.ok(player.x >= 5);
  player.x = 30; player.y = 52;
  for (let x = 20; x < 42; x++) world.set(x, 61, Mat.Sand);
  advance(world, player, [], 30); assert.ok(player.y > 69 && player.y < 70);assert.equal(world.count(Mat.Sand),22); assert.equal(player.grounded, true);
});

test('explorer walks through a sand dune without climbing or deleting grains', () => {
  const { world, player } = setup();
  for (let x = 25; x < 80; x++) {
    const surface = 69 - Math.min(12, Math.floor((x - 25) / 3));
    for (let y = surface; y < 70; y++) world.set(x, y, Mat.Sand);
  }
  player.x = 27; player.y = 68;
  advance(world, player, ['KeyD'], 35);
  assert.ok(player.x > 62, `stuck at x=${player.x}`);
  assert.ok(player.y >=69 && player.y <70, `loose grains incorrectly supported y=${player.y}`);
});
