import { Mat } from './materials';

/** Balance knobs live here, shared by contact physics, machines and tests. */
export const REACTIONS = {
  pulp: { inputs: [Mat.Sand, Mat.Water], outputs: [Mat.Pulp, Mat.Pulp] },
  boiling: { material: Mat.Water, temperature: 100, output: Mat.Steam },
  condensation: { material: Mat.Steam, temperature: 76, coldSurface: 12, output: Mat.Water },
  ceramic: { input: Mat.Clay, output: Mat.Pellet, temperature: 680 },
  melting: { input: Mat.Quartz, output: Mat.Molten, temperature: 1000, outputTemperature: 1100 },
  quench: { input: Mat.Molten, coolant: Mat.Mist, crystalChance: 0.65,
    crystal: Mat.Crystal, fallback: Mat.Glass, outputTemperature: 30 },
  glassCooling: { input: Mat.Molten, temperature: 440, output: Mat.Glass },
  ignition: { input: Mat.Lumen, temperature: 220, output: Mat.Steam, outputTemperature: 180 },
  separator: { input: Mat.Pulp, output: Mat.Clay, bonus: Mat.Quartz, bonusChance: 0.22 },
  piezo: { input: Mat.Pellet, output: Mat.Shard, minimumFall: 18, energy: 32 },
  crusher: { ceramicInput: Mat.Shard, glassInput: Mat.Glass, output: Mat.Sand,
    bonus: Mat.Quartz, quartzChance: 0.18 },
  physics: { pastePeriod: 3, mistPeriod: 2, liquidSpread: 4, gasSpread: 3,
    granularDensityGap: 30, granularSiftingChance: 0.09, heatExchange: 0.2,
    ambientTemperature: 24, ambientCoolingPeriod: 15 },
} as const;

export const CONTACT_REACTIONS = [
  { first: Mat.Sand, second: Mat.Water, firstOutput: Mat.Pulp, secondOutput: Mat.Pulp },
  { first: Mat.Molten, second: Mat.Mist, firstOutput: Mat.Crystal, secondOutput: Mat.Water,
    probability: REACTIONS.quench.crystalChance, alternate: Mat.Glass },
] as const;
