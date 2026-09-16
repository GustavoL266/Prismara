import { Mat } from './materials';
import type { World } from './world';
import type { Machine } from './machines';

export const SIGNAL_RADIUS = 72;
export function updateSignals(world: World, machines: Machine[]): void {
  for (const m of machines) m.signal = true;
  for (const sensor of machines.filter(m => m.kind === 'sensor')) {
    let found = false;
    for (let y = sensor.y - 9; y < sensor.y; y++) for (let x = sensor.x - 4; x < sensor.x + sensor.w + 4; x++) {
      const material = world.get(x, y);
      if (material !== Mat.Air && (sensor.filter === Mat.Air || material === sensor.filter)) found = true;
    }
    sensor.signal = found && sensor.enabled;
    let target = machines.find(m => m.id === sensor.targetId && m.kind !== 'sensor');
    if (!target) {
      target = machines.filter(m => m.kind !== 'sensor' && m.kind !== 'pipe' && m.kind !== 'vault')
        .map(m => ({ m, d: Math.hypot(m.x - sensor.x, m.y - sensor.y) }))
        .filter(v => v.d <= SIGNAL_RADIUS).sort((a, b) => a.d - b.d)[0]?.m;
      sensor.targetId = target?.id;
    }
    if (target) target.signal = target.signal && sensor.signal;
    sensor.status = !sensor.enabled ? 'Desligada' : !target ? 'Sem destino' : found ? 'Sinal ligado' : 'Sinal desligado';
  }
}
