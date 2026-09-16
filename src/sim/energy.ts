import { REACTIONS } from './reactions';
export const ENERGY = { initial: 160, capacity: 1200, impact: REACTIONS.piezo.energy, melt: 3, kiln: 0.45, mist: 0.35, crush: 0.2 } as const;

/** Shared electrical bus. Costs are paid only when an operation can finish. */
export class Energy {
  value = ENERGY.initial as number;
  capacity = ENERGY.capacity as number;
  spend(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0 || this.value + 1e-6 < amount) return false;
    this.value = Math.max(0, this.value - amount);
    return true;
  }
  add(amount: number): number {
    const accepted = Math.max(0, Math.min(amount, this.capacity - this.value));
    this.value += accepted;
    return accepted;
  }
}
