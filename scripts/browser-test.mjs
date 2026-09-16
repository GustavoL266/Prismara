import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

// This browser suite has two parts: real keyboard/pointer smoke tests in the
// generated world, then an explicitly controlled integration fixture. The latter
// supplies ONLY raw sand/water and an empty factory, advances the real simulation,
// and transfers its physical products to inventory to avoid repetitive collection.
// It never grants research, crystals, quartz, pellets, production counts, or energy.
// This is regression coverage, not a measurement of a human's campaign duration.
const origin = process.env.PRISMARA_TEST_URL ?? 'http://127.0.0.1:5173';
const artifacts = resolve('.local/browser');
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined);
const report = { startedAt: new Date().toISOString(), checks: [], consoleErrors: [], fixture: 'Raw sand/water, construction sand, zero energy; real recipes and research requirements.' };
mkdirSync(artifacts, { recursive: true });
let server, browser, page;
const pass = (name, detail) => { report.checks.push({ name, detail }); console.log(`PASS ${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`); };
const ready = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };

try {
  if (!await ready()) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore', windowsHide: true });
    for (let n = 0; n < 100 && !await ready(); n++) await delay(100);
    assert.ok(await ready(), `Vite is unavailable at ${origin}`);
  }
  browser = await chromium.launch({ headless: true, ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${origin}/?test=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__prismara));
  await page.locator('.start-logo').waitFor();
  assert.equal(await page.locator('.start-logo').textContent(), 'PRISMARA');
  await page.screenshot({ path: resolve(artifacts, '01-title-1280.png') });
  await page.locator('[data-action="new"]').click();
  await page.waitForFunction(() => window.__prismara.started && window.__prismara.panel === null);
  pass('Start screen creates a playable world');

  const position = () => page.evaluate(() => ({ x: window.__prismara.player.x, y: window.__prismara.player.y, fuel: window.__prismara.player.fuel }));
  const initial = await position();
  await page.keyboard.down('d'); await delay(550); await page.keyboard.up('d');
  const moved = await position(); assert.ok(moved.x > initial.x + 5, 'D must move the explorer');
  await page.keyboard.down('a'); await delay(220); await page.keyboard.up('a');
  assert.ok((await position()).x < moved.x - 2, 'A must move back');
  const grounded = await position();
  await page.keyboard.down('Space'); await delay(420); await page.keyboard.up('Space');
  const flying = await position(); assert.ok(flying.y < grounded.y - 4, 'Space must lift the explorer');
  assert.ok(flying.fuel < 100, 'Propulsion must use fuel');
  pass('A/D movement and Space propulsion', { initial, moved, flying });
  await delay(650);

  // Choose a real nearby surface grain, then hold the pointer using the actual tool.
  await page.keyboard.press('1');
  const miningTarget = await page.evaluate(() => {
    const g = window.__prismara;
    g.renderer.follow = false; g.renderer.camera.x = g.player.x + 30;
    for (let y = 171; y < 185; y++) for (let x = Math.floor(g.player.x + 15); x < g.player.x + 60; x++)
      if (g.world.get(x, y) === 1 && Math.hypot(x - g.player.x, y - g.player.y) < 90)
        return { ...g.renderer.screenPoint(x, y), before: g.inventory[1] };
    throw new Error('No accessible sand grain near the spawn');
  });
  await page.mouse.move(miningTarget.x, miningTarget.y); await page.mouse.down(); await delay(450); await page.mouse.up();
  assert.ok(await page.evaluate(before => window.__prismara.inventory[1] > before, miningTarget.before), 'Mining should collect real sand');
  pass('Pointer mining collects sand from generated terrain');
  await page.keyboard.press('b');
  await page.locator('[data-machine="separator"]').waitFor();
  assert.equal(await page.locator('[data-machine="crucible"]').isDisabled(), true);
  await page.locator('[data-machine="separator"]').hover();
  assert.ok((await page.locator('[data-machine="separator"]').getAttribute('title')).includes('Polpa'));
  await page.screenshot({ path: resolve(artifacts, '02-catalogue-1280.png') });
  await page.keyboard.press('Escape');
  pass('B opens the catalogue, machine tooltips and research locks');

  const layout = async (width, height, name) => {
    await page.setViewportSize({ width, height }); await delay(200);
    const boxes = await page.evaluate(() => ['.resource-strip', '.objectives', '.map-panel', '.dock', '.inspector'].map(selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }));
    for (const box of boxes) assert.ok(box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0 && box.right <= width + 1 && box.bottom <= height + 1, `HUD outside ${width}x${height}: ${JSON.stringify(box)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal page overflow');
    await page.screenshot({ path: resolve(artifacts, name) });
    pass(`HUD fits ${width}×${height}`, boxes);
  };
  await layout(1280, 720, '03-world-1280.png');
  await layout(1920, 1080, '04-world-1920.png');
  await page.setViewportSize({ width: 1280, height: 720 });

  // Fixed laboratory geometry for reproducible end-to-end production. All higher
  // materials below must come from simulation outputs, never from test assignment.
  await page.evaluate(() => {
    const g = window.__prismara; g.newWorld(91207); g.world.clear();
    g.factory.energy.value = 0; g.inventory[1] = 400;
    g.renderer.follow = false; g.player.x = 140; g.player.y = 179;
    for (let x = 0; x < g.world.width; x++) g.world.set(x, 180, 15);
    for (let y = 145; y < 161; y++) for (let x = 10; x < 42; x++) g.world.set(x, y, (x + y) % 2 ? 1 : 2);
    for (let y = 145; y < 161; y++) for (let x = 70; x < 90; x++) g.world.set(x, y, 2);
    for (let i = 0; i < 150; i++) g.step();
  });
  const advance = async ticks => page.evaluate(n => { const g = window.__prismara; g.input.release(); for (let i = 0; i < n; i++) g.step(); g.updateProgress(); g.ui.update(true); }, ticks);
  const harvest = async mats => page.evaluate(requested => {
    const g = window.__prismara, harvested = {};
    for (let i = 0; i < g.world.cells.length; i++) {
      const mat = g.world.cells[i]; if (!requested.includes(mat)) continue;
      g.inventory[mat]++; harvested[mat] = (harvested[mat] ?? 0) + 1;
      g.world.set(i % g.world.width, Math.floor(i / g.world.width), 0);
    }
    g.ui.update(true); return harvested;
  }, mats);
  const mixture = await harvest([1, 2, 3]); assert.ok(mixture[3] >= 400, `Only ${mixture[3]} pulp formed`);
  pass('Raw sand and water physically react into mineral pulp', mixture);

  const build = async (kind, x, y) => {
    await page.evaluate(({ x, y }) => { const g = window.__prismara; g.setPanel(null); g.renderer.follow = false; g.renderer.camera.x = x; g.renderer.camera.y = y; }, { x, y });
    await page.keyboard.press('b'); await page.locator(`[data-machine="${kind}"]`).click();
    const point = await page.evaluate(({ x, y }) => window.__prismara.renderer.screenPoint(x, y), { x, y });
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await delay(100); await page.mouse.up();
    await page.waitForFunction(({ kind, x, y }) => window.__prismara.factory.machines.some(m => m.kind === kind && Math.abs(m.x - x) <= 2 && Math.abs(m.y - y) <= 2), { kind, x, y });
    return page.evaluate(({ kind, x }) => window.__prismara.factory.machines.find(m => m.kind === kind && Math.abs(m.x - x) <= 2).id, { kind, x });
  };
  const select = async id => page.evaluate(id => { const g = window.__prismara; g.setPanel(null); g.selectedId = id; g.ui.update(true); }, id);
  const feed = async id => { await select(id); await page.locator('[data-action="feed"]').click(); };
  const counters = () => page.evaluate(() => ({ ...window.__prismara.factory.counters }));
  const research = async tier => {
    await page.keyboard.press('t');
    assert.equal(await page.locator(`[data-research="${tier}"]`).isEnabled(), true, `Tier ${tier} must be earned through production`);
    await page.locator(`[data-research="${tier}"]`).click();
    assert.equal(await page.evaluate(() => window.__prismara.progress.tier), tier);
    await page.keyboard.press('Escape');
  };
  const separator = await build('separator', 30, 30);
  for (let n = 0; n < 5; n++) { await feed(separator); await advance(600); }
  const separated = await harvest([4, 5]);
  assert.ok(separated[4] >= 250 && separated[5] >= 40, `Insufficient separator products: ${JSON.stringify(separated)}`);
  pass('B + pointer builds a drum; inspector feeds real pulp', separated);
  await research(2);
  const kiln = await build('kiln', 66, 30);
  await feed(kiln); await advance(2800);
  const fired = await harvest([6]); assert.ok(fired[6] >= 12, 'Solar kiln should produce at least 12 pellets');
  const press = await build('press', 96, 70);
  await feed(press); await advance(350);
  const impacts = await counters(); assert.ok(impacts.impacts >= 12); assert.ok(impacts.energy >= 384);
  const sharded = await harvest([7]); assert.ok(sharded[7] >= 12);
  pass('Solar ceramics → physical falling pellets → piezoelectric energy', { pellets: fired[6], impacts: impacts.impacts, generatedEnergy: impacts.energy });
  await research(3);
  await page.keyboard.press('b'); await page.locator('[data-action="blueprint"]').click();
  const thermal = await page.evaluate(() => window.__prismara.factory.machines.filter(m => m.kind === 'mist' || m.kind === 'crucible').map(m => ({ id: m.id, kind: m.kind })));
  assert.equal(thermal.length, 2, 'Thermal module must build both machines');
  const crucible = thermal.find(m => m.kind === 'crucible').id, mist = thermal.find(m => m.kind === 'mist').id;
  await feed(crucible); await feed(mist); await advance(600);
  await feed(mist); await advance(600);
  const crystals = await harvest([9, 10]); assert.ok(crystals[9] >= 12, `Thermal module produced only ${crystals[9] ?? 0} crystals`);
  assert.ok((await counters()).molten >= 12);
  pass('Quartz melts and physically cools with cold mist', crystals);
  const vault = await build('vault', 160, 100);
  await feed(vault); await advance(400);
  const stored = await page.evaluate(() => window.__prismara.factory.countCrystals()); assert.ok(stored >= 12);
  await research(4);
  assert.equal(await page.evaluate(() => window.__prismara.factory.countCrystals()), stored - 12);
  pass('Physical vault occupancy funds Control research', { storedBefore: stored, spent: 12 });

  const crusher = await build('crusher', 124, 72);
  await feed(crusher); await advance(300); assert.ok((await counters()).recycled >= 12);
  const filter = await build('filter', 350, 90);
  await select(filter); await page.locator('#filter-mode').selectOption('density');
  await page.locator('#density-min').fill('175'); await page.locator('#density-min').press('Tab');
  await page.locator('#density-max').fill('255'); await page.locator('#density-max').press('Tab');
  assert.deepEqual(await page.evaluate(id => { const m = window.__prismara.factory.machines.find(m => m.id === id); return [m.mode, m.densityMin, m.densityMax]; }, filter), ['density', 175, 255]);
  const sensor = await build('sensor', 350, 112);
  await select(sensor); await page.locator('#sensor-target').selectOption(String(filter));
  await advance(2);
  assert.equal(await page.evaluate(id => window.__prismara.factory.machines.find(m => m.id === id).signal, filter), false);
  pass('Recycling and configurable density filter/sensor controls');

  // Save with already emitted pulp on the drum so that continued production after
  // reload proves the factory resumes from actual persisted world particles.
  await feed(separator); await advance(45);
  await page.keyboard.press('Escape'); await page.locator('[data-action="save"]').click();
  const saved = await page.evaluate(() => {
    const g = window.__prismara;
    return { raw: localStorage.getItem('prismara.world.v1'), tier: g.progress.tier, machines: g.factory.machines.length,
      inventory: [...g.inventory], counters: { ...g.factory.counters }, energy: g.factory.energy.value,
      cells: Array.from(g.world.cells), temperature: Array.from(g.world.temperature), fall: Array.from(g.world.fall), tick: g.world.tick };
  });
  assert.ok(saved.raw);
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('[data-action="continue"]').waitFor();
  // Dispatch and pause in one browser task, before a simulation frame can mutate
  // the restored state. This still invokes the same visible Continue UI handler.
  const restored = await page.evaluate(() => {
    document.querySelector('[data-action="continue"]').click();
    const g = window.__prismara; g.setPanel('pause');
    return { tier: g.progress.tier, machines: g.factory.machines.length, inventory: [...g.inventory], counters: { ...g.factory.counters },
      energy: g.factory.energy.value, cells: Array.from(g.world.cells), temperature: Array.from(g.world.temperature), fall: Array.from(g.world.fall), tick: g.world.tick };
  });
  const { raw: _raw, ...expected } = saved; assert.deepEqual(restored, expected);
  await page.keyboard.press('Escape'); await advance(800);
  assert.ok((await counters()).clay > saved.counters.clay, 'Persisted input grains must resume producing after reload');
  pass('Save/Continue exactly restores particles, temperature, fall, machines, energy, research and inventory; factory resumes');
  await page.evaluate(() => { const g = window.__prismara; g.renderer.follow = false; g.renderer.camera.x = 188; g.renderer.camera.y = 102; g.renderer.camera.zoom = 3; g.selectedId = 0; g.tool = 'collect'; g.ui.update(true); });
  await delay(200); await page.screenshot({ path: resolve(artifacts, '05-factory-fixture-1280.png') });
  await page.keyboard.press('Escape'); await page.locator('[data-panel="new"]').click();
  await page.locator('[data-action="new"]').click();
  assert.equal(await page.evaluate(() => window.__prismara.progress.tier), 1);
  assert.equal(await page.evaluate(() => window.__prismara.factory.machines.length), 0);
  pass('New world resets expedition through its confirmation screen');
  assert.deepEqual(report.consoleErrors, [], 'Browser must have no JavaScript or console errors');
  pass('No browser runtime/console errors');
  report.ok = true;
} catch (error) {
  report.ok = false; report.error = error.stack ?? String(error);
  if (page) {
    await page.screenshot({ path: resolve(artifacts, 'failure.png') }).catch(() => {});
    report.debug = await page.evaluate(() => { const g = window.__prismara; return g ? { panel: g.panel, inventory: g.inventory, progress: g.progress, counters: g.factory.counters, machines: g.factory.machines, toast: document.querySelector('#toast')?.textContent } : null; }).catch(() => null);
  }
  console.error(error); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(resolve(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close(); if (server) server.kill();
  console.log(`Browser evidence: ${artifacts}`);
}
