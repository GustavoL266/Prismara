export interface MissionContext {
  mined: number; pulp: number; clay: number; quartz: number; pellet: number; impacts: number;
  molten: number; crystal: number; stored: number; tier: number; ruins: boolean; won: boolean;
}
export const MISSIONS: {title:string; detail:string; goal:number; value:(c:MissionContext)=>number; hint:string}[] = [
  {title:'Um punhado de possibilidades',detail:'Colete 40 grãos de areia',goal:40,value:c=>c.mined,hint:'Segure o botão esquerdo sobre a duna com Escavar [1]. A areia vai para sua mochila.'},
  {title:'Encontro entre terra e água',detail:'Crie 24 pixels de polpa mineral',goal:24,value:c=>c.pulp,hint:'Despeje areia [3] na água à direita. O contato transforma os dois grãos em polpa. Colete a mistura [2].'},
  {title:'Separar para descobrir',detail:'Produza 18 argilas e 3 quartzos',goal:21,value:c=>Math.min(c.clay,18)+Math.min(c.quartz,3),hint:'Construa um Tambor [B]. Inspecione-o e use Alimentar com polpa da mochila. Argila sai ao lado; quartzo, embaixo.'},
  {title:'O primeiro fogo',detail:'Produza 12 pelotas cerâmicas',goal:12,value:c=>c.pellet,hint:'Libere Cerâmica em Pesquisa [T]. Alimente o forno com argila. Seu aquecedor solar permite a primeira produção.'},
  {title:'A energia da queda',detail:'Gere 3 impactos válidos',goal:3,value:c=>c.impacts,hint:'Construa a Prensa. Colete pelotas e use Lançar no inspetor: elas caem 24 células. Quedas de menos de 18 não geram energia.'},
  {title:'Um rio de luz',detail:'Funda 12 grãos de quartzo',goal:12,value:c=>c.molten,hint:'Libere Vidro em Pesquisa [T]. Alimente o Cadinho com quartzo; sua energia vem da prensa.'},
  {title:'Choque de temperaturas',detail:'Produza 8 cristais prismáticos',goal:8,value:c=>c.crystal,hint:'Construa o Gerador de Névoa ao lado da saída inferior do Cadinho. Alimente com água. Névoa + vidro cria cristais ou fragmentos.'},
  {title:'Luz que se pode guardar',detail:'Armazene 12 cristais no cofre',goal:12,value:c=>c.stored,hint:'Colete os cristais e alimente o Cofre. Apenas os pixels que permanecem dentro dele contam como moeda.'},
  {title:'Uma fábrica que decide',detail:'Pesquise o nível 4',goal:1,value:c=>Number(c.tier>=4),hint:'Gaste 12 cristais no painel Pesquisa. Filtros, sensores e esteiras rápidas permitem automatizar a separação.'},
  {title:'O sinal sob as dunas',detail:'Encontre a Ruína Prismática',goal:1,value:c=>Number(c.ruins),hint:'Explore a leste, além da água. Use o propulsor [Espaço] e o mapa [M]. A ruína espera em x=550.'},
  {title:'Reacender Prismara',detail:'Entregue 24 cristais ao farol',goal:1,value:c=>Number(c.won),hint:'Com 24 cristais no cofre, visite a ruína e ative o farol pelo painel Pesquisa. Sua fábrica pode continuar após a expedição.'},
];
export const RESEARCH = [
  {tier:1,name:'Fundamentos',subtitle:'A matéria começa a se mover',cost:0,requires:'Disponível ao pousar',machines:'Esteira · Tambor · Cofre'},
  {tier:2,name:'Cerâmica & energia',subtitle:'Transforme altura em potência',cost:0,requires:'18 argilas e 3 quartzos produzidos',machines:'Forno · Elevador · Prensa · Triturador'},
  {tier:3,name:'Vidro & resfriamento',subtitle:'Aprenda a cultivar a luz',cost:0,requires:'3 impactos válidos na prensa',machines:'Cadinho · Névoa · Bomba · Tubo · Válvula'},
  {tier:4,name:'Controle de fluxo',subtitle:'Uma fábrica que responde',cost:12,requires:'12 cristais armazenados no cofre',machines:'Filtro · Sensor · Esteira rápida'},
];
