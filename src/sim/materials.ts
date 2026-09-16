/** Original Prismara material catalogue. A cell stores one compact numeric id. */
export enum Mat {
  Air = 0, Sand, Water, Pulp, Clay, Quartz, Pellet, Shard, Molten,
  Crystal, Glass, Steam, Mist, Rock, Earth, Wall, Lumen,
}

export type MatterState = 'empty' | 'terrain' | 'granular' | 'liquid' | 'gas' | 'paste' | 'floating' | 'structure';
export type Movement = 'none' | 'fall' | 'flow' | 'rise' | 'viscous' | 'drift';

export interface MaterialDefinition {
  id: Mat;
  name: string;
  color: string;
  palette: readonly string[];
  state: MatterState;
  density: number;
  flammability: number;
  conductivity: number;
  temperature: number;
  transportable: boolean;
  resistance: number;
  uses: string;
  movement: Movement;
  glow?: string;
  pattern?: 'grain' | 'stripe' | 'fleck' | 'spark' | 'wave';
}

function material(id: Mat, name: string, color: string, palette: string[], state: MatterState,
  density: number, conductivity: number, temperature: number, resistance: number,
  uses: string, movement: Movement, extra: Partial<MaterialDefinition> = {}): MaterialDefinition {
  return { id, name, color, palette: [color, ...palette], state, density, flammability: 0,
    conductivity, temperature, transportable: !['empty', 'terrain', 'structure'].includes(state),
    resistance, uses, movement, ...extra };
}

export const materials: readonly MaterialDefinition[] = [
  material(Mat.Air, 'Ar', '#000000', [], 'empty', 0, 0.01, 24, 0, 'Espaço livre para matéria e construção.', 'none'),
  material(Mat.Sand, 'Areia', '#dab56d', ['#f2d78e', '#bd8d46', '#eac675'], 'granular', 150, 0.14, 24, 1,
    'Misture com água: dois pixels tornam-se Polpa Mineral.', 'fall', { pattern: 'grain' }),
  material(Mat.Water, 'Água', '#45bada', ['#76d8e9', '#299ebf'], 'liquid', 100, 0.65, 24, 1,
    'Mistura areia, alimenta névoa e evapora acima de 100 °C.', 'flow', { pattern: 'wave' }),
  material(Mat.Pulp, 'Polpa Mineral', '#a7a787', ['#c0bda0', '#899476'], 'paste', 130, 0.28, 24, 1,
    'Alimente o Tambor Separador pela abertura superior.', 'viscous', { pattern: 'fleck' }),
  material(Mat.Clay, 'Argila Mineral', '#b97155', ['#d99a74', '#975645'], 'granular', 170, 0.22, 24, 1,
    'O Forno Cerâmico transforma argila em Pelota Cerâmica.', 'fall', { pattern: 'stripe' }),
  material(Mat.Quartz, 'Quartzo Bruto', '#d6e7dc', ['#ffffff', '#8bd4d5', '#acbfc4'], 'granular', 220, 0.32, 24, 2,
    'Funda no Cadinho de Vidro e resfrie com Névoa Fria.', 'fall', { pattern: 'spark' }),
  material(Mat.Pellet, 'Pelota Cerâmica', '#e18b4d', ['#ffd096', '#b35c39'], 'granular', 190, 0.2, 24, 1,
    'Deixe cair 18 células sobre a Prensa Piezoelétrica para gerar energia.', 'fall', { pattern: 'stripe' }),
  material(Mat.Shard, 'Caco Cerâmico', '#a19080', ['#ccad87', '#746e6b'], 'granular', 160, 0.17, 24, 1,
    'O Triturador recicla cacos em areia.', 'fall', { pattern: 'fleck' }),
  material(Mat.Molten, 'Vidro Fundido', '#ffec9e', ['#fff8de', '#ffa542', '#f77732'], 'liquid', 180, 0.86, 1100, 2,
    'Toque Névoa Fria: 65% cristal e 35% fragmento. Tubos comuns não resistem.', 'flow',
    { glow: '#ffae50', pattern: 'wave', transportable: false }),
  material(Mat.Crystal, 'Cristal Prismático', '#86eeed', ['#ffffff', '#d888e9', '#53bed6'], 'granular', 250, 0.36, 24, 2,
    'Guarde fisicamente no Cofre Prismático para financiar pesquisas.', 'fall', { glow: '#b8a1ff', pattern: 'spark' }),
  material(Mat.Glass, 'Fragmento Vítreo', '#9fb9d5', ['#c9def0', '#7794bb'], 'granular', 180, 0.24, 24, 1,
    'Recicle no Triturador para recuperar areia ou quartzo.', 'fall', { pattern: 'fleck' }),
  material(Mat.Steam, 'Vapor', '#b6dce0', ['#d2e6e4', '#9dc1cd'], 'gas', 3, 0.16, 130, 1,
    'Sobe e condensa ao esfriar ou tocar uma superfície fria.', 'rise', { pattern: 'wave' }),
  material(Mat.Mist, 'Névoa Fria', '#b6ffff', ['#e4ffff', '#83d9e9'], 'gas', 8, 0.8, -55, 1,
    'Resfria Vidro Fundido por contato. Gerada com água e energia.', 'drift', { glow: '#79dae0', pattern: 'wave' }),
  material(Mat.Rock, 'Rocha', '#685f5b', ['#837266', '#514d4b', '#95816c'], 'terrain', 255, 0.25, 24, 7,
    'Terreno resistente. Escave para alcançar cavernas e veios minerais.', 'none', { pattern: 'fleck' }),
  material(Mat.Earth, 'Terra', '#805b46', ['#9e7450', '#644836', '#ba8b59'], 'terrain', 210, 0.12, 24, 3,
    'Escavação pode revelar areia, pedra ou quartzo raro.', 'none', { pattern: 'grain', flammability: 0.08 }),
  material(Mat.Wall, 'Liga de Construção', '#355461', ['#60818a', '#233b48'], 'structure', 255, 0.55, 24, 12,
    'Estrutura modular. Remova com a ferramenta de construção.', 'none', { pattern: 'stripe' }),
  material(Mat.Lumen, 'Pó de Lúmen', '#d6efb2', ['#ffffd9', '#a5c995'], 'floating', 12, 0.6, 24, 1,
    'Pó leve da flora local. Deriva lentamente e queima em contato com calor intenso, liberando vapor.', 'drift',
    { pattern: 'spark', glow: '#e3efab', flammability: 0.85 }),
];

export const MATERIALS = materials;
export const MAT_COUNT = materials.length;
export const isSolid = (mat: Mat): boolean => ['terrain', 'granular', 'structure'].includes(materials[mat].state);
export const materialName = (mat: Mat): string => materials[mat].name;
