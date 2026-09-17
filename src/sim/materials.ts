/** Original Prismara material catalogue. A cell stores one compact numeric id. */
export enum Mat {
  Air = 0, Sand, Water, Pulp, Clay, Quartz, Pellet, Shard, Molten,
  Crystal, Glass, Steam, Mist, Rock, Earth, Wall, Lumen,
  WetSand = 17, Gold = 18, Residue = 19, Calcined = 20, Ice = 21,
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
  material(Mat.Sand, 'Areia', '#BD914D', ['#E1B866', '#a5793e', '#ceaa65'], 'granular', 150, 0.14, 24, 1,
    'Contato com uma água consome o líquido e umedece um grão. Peneire para obter ouro.', 'fall', { pattern: 'grain' }),
  material(Mat.Water, 'Água', '#327ABA', ['#569cce', '#286598'], 'liquid', 100, 0.65, 24, 1,
    'Mistura areia, alimenta névoa e evapora acima de 100 °C.', 'flow', { pattern: 'wave' }),
  material(Mat.Pulp, 'Polpa Mineral', '#a7a787', ['#c0bda0', '#899476'], 'paste', 130, 0.28, 24, 1,
    'Polpa de partidas antigas; o Tambor de Argila aceita esta mistura pela abertura superior.', 'viscous', { pattern: 'fleck' }),
  material(Mat.Clay, 'Argila Mineral', '#b97155', ['#d99a74', '#975645'], 'granular', 170, 0.22, 24, 1,
    'O Forno Cerâmico transforma argila em Pelota Cerâmica.', 'fall', { pattern: 'stripe' }),
  material(Mat.Quartz, 'Quartzo Bruto', '#bcc6ce', ['#e8edf0', '#939faa', '#aab5bf'], 'granular', 220, 0.32, 24, 2,
    'Funda no Cadinho de Vidro e resfrie com Névoa Fria.', 'fall', { pattern: 'spark' }),
  material(Mat.Pellet, 'Pelota Cerâmica', '#e18b4d', ['#ffd096', '#b35c39'], 'granular', 190, 0.2, 24, 1,
    'Deixe cair 18 células sobre a Prensa Piezoelétrica para gerar energia.', 'fall', { pattern: 'stripe' }),
  material(Mat.Shard, 'Caco Cerâmico', '#a19080', ['#ccad87', '#746e6b'], 'granular', 160, 0.17, 24, 1,
    'O Triturador recicla cacos em areia.', 'fall', { pattern: 'fleck' }),
  material(Mat.Molten, 'Vidro Fundido', '#ffec9e', ['#fff8de', '#ffa542', '#f77732'], 'liquid', 180, 0.86, 1100, 2,
    'Toque Névoa Fria: 65% cristal e 35% fragmento. Tubos comuns não resistem.', 'flow',
    { glow: '#ffae50', pattern: 'wave', transportable: false }),
  material(Mat.Crystal, 'Cristal Raro', '#AA66DC', ['#e8bdff', '#8649bb', '#bf88e4'], 'granular', 250, 0.36, 24, 2,
    'Colete no Coletor de Minérios ou guarde no Cofre Prismático para melhorias especiais.', 'fall', { glow: '#b8a1ff', pattern: 'spark' }),
  material(Mat.Glass, 'Fragmento Vítreo', '#9fb9d5', ['#c9def0', '#7794bb'], 'granular', 180, 0.24, 24, 1,
    'Recicle no Triturador para recuperar areia ou quartzo.', 'fall', { pattern: 'fleck' }),
  material(Mat.Steam, 'Vapor', '#b6dce0', ['#d2e6e4', '#9dc1cd'], 'gas', 3, 0.16, 130, 1,
    'Sobe e condensa ao esfriar ou tocar uma superfície fria.', 'rise', { pattern: 'wave' }),
  material(Mat.Mist, 'Névoa Fria', '#b6ffff', ['#e4ffff', '#83d9e9'], 'gas', 8, 0.8, -55, 1,
    'Resfria Vidro Fundido por contato. Gerada com água e energia.', 'drift', { glow: '#79dae0', pattern: 'wave' }),
  material(Mat.Rock, 'Rocha', '#685f5b', ['#837266', '#514d4b', '#95816c'], 'terrain', 255, 0.25, 24, 7,
    'Terreno resistente. Escave para alcançar cavernas e veios minerais.', 'none', { pattern: 'fleck' }),
  material(Mat.Earth, 'Terra', '#805b46', ['#9e7450', '#644836', '#ba8b59'], 'terrain', 210, 0.12, 24, 3,
    'Escave para liberar areia e abrir acesso aos veios de quartzo e cristais.', 'none', { pattern: 'grain', flammability: 0.08 }),
  material(Mat.Wall, 'Liga de Construção', '#474D52', ['#899096', '#33373c'], 'structure', 255, 0.55, 24, 12,
    'Estrutura modular. Remova com a ferramenta de construção.', 'none', { pattern: 'stripe' }),
  material(Mat.Lumen, 'Pó de Lúmen', '#d6efb2', ['#ffffd9', '#a5c995'], 'floating', 12, 0.6, 24, 1,
    'Pó leve da flora local. Deriva lentamente e queima em contato com calor intenso, liberando vapor.', 'drift',
    { pattern: 'spark', glow: '#e3efab', flammability: 0.85 }),
  material(Mat.WetSand, 'Areia Úmida', '#8e7044', ['#b89555', '#735d40'], 'paste', 165, .3, 24, 1,
    'Coesa e lenta. A peneira deixa resíduo na grelha e ouro na saída inferior.', 'viscous', { pattern: 'grain' }),
  material(Mat.Gold, 'Ouro', '#F3CF4C', ['#fff39a', '#c69d25'], 'granular', 250, .75, 24, 1,
    'Cai pela grelha. Um Coletor de Minérios converte cada grão em uma moeda.', 'fall', { pattern: 'spark' }),
  material(Mat.Residue, 'Resíduo Mineral', '#746c61', ['#928779', '#59534e'], 'granular', 170, .2, 24, 1,
    'Permanece sobre a peneira. Calor e britagem recuperam argila ou quartzo.', 'fall', { pattern: 'fleck' }),
  material(Mat.Calcined, 'Resíduo Calcinado', '#b58062', ['#d0a080', '#905e47'], 'granular', 175, .3, 180, 1,
    'Resíduo aquecido a 420 °C; britar para recuperar argila e quartzo.', 'fall', { pattern: 'fleck' }),
  material(Mat.Ice, 'Gelo Estratificado', '#6592ae', ['#a2c4d9', '#4e758e'], 'terrain', 90, .65, -20, 4,
    'Ferramentas térmicas derretem barreiras e liberam água física.', 'none', { pattern: 'stripe' }),
];

export const MATERIALS = materials;
export const MAT_COUNT = materials.length;
export const isSolid = (mat: Mat): boolean => ['terrain', 'granular', 'structure'].includes(materials[mat].state);
export const materialName = (mat: Mat): string => materials[mat].name;
