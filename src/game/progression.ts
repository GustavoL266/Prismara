export interface Research {id:string;branch:string;name:string;gold:number;crystals:number;requires:string[];unlocks:string;}
export const RESEARCH:Research[]=[
  {id:'processing',branch:'Processamento',name:'Tambor dos Sedimentos',gold:12,crystals:0,requires:[],unlocks:'Tambor de Argila · Triturador'},
  {id:'transport',branch:'Transporte',name:'Impulso e Triagem',gold:8,crystals:0,requires:[],unlocks:'Lançador · Elevador · Filtro · Esteira Rápida'},
  {id:'liquids',branch:'Gestão de líquidos',name:'Hidráulica de Bolsões',gold:6,crystals:0,requires:[],unlocks:'Bomba · Tubo · Válvula'},
  {id:'tools',branch:'Ferramentas',name:'Mandíbula de Campo',gold:6,crystals:0,requires:[],unlocks:'Alcance +25 · Força +1 · Mochila +200'},
  {id:'heat',branch:'Energia e calor',name:'Ciclo da Cerâmica',gold:14,crystals:0,requires:['processing'],unlocks:'Forno · Prensa · Câmara de Calcinação'},
  {id:'glass',branch:'Processamento',name:'Têmpera de Facetas',gold:18,crystals:0,requires:['heat','liquids'],unlocks:'Cadinho · Névoa · Cofre'},
  {id:'automation',branch:'Automação',name:'Cadência Autônoma',gold:24,crystals:0,requires:['transport','heat'],unlocks:'Sonda Escavadora · Transportador · Sensor'},
  {id:'exploration',branch:'Exploração',name:'Cartografia dos Estratos',gold:10,crystals:0,requires:['tools'],unlocks:'Propulsor +1 · Luminária · Análise das câmaras'},
  {id:'thermal',branch:'Ferramentas',name:'Lança Térmica',gold:16,crystals:0,requires:['heat','tools'],unlocks:'Ferramenta térmica · Derreter gelo'},
  {id:'capacity',branch:'Ferramentas',name:'Mochila de Facetas',gold:10,crystals:3,requires:['glass','tools'],unlocks:'Mochila +600 · Alcance +25'},
  {id:'propulsion',branch:'Exploração',name:'Jato de Profundidade',gold:8,crystals:4,requires:['exploration','glass'],unlocks:'Propulsor +2 · Força +2'},
];
export interface MissionContext {mined:number;wet:number;gold:number;stored:number;machines:number;research:number;discovered:number;challenges:number;won:boolean}
export const MISSIONS:{title:string;detail:string;goal:number;value:(c:MissionContext)=>number;hint:string}[]=[
  {title:'Liberar o depósito',detail:'Escave 24 células',goal:24,value:c=>c.mined,hint:'[1] rompe o terreno. Os grãos ficam no mundo. [2] aspira; [3] despeja. A mochila começa com areia de construção.'},
  {title:'Umedecer a areia',detail:'Misture 24 grãos com água',goal:24,value:c=>c.wet,hint:'Colete água no bolsão à direita. Construa a peneira no ar e despeje areia e água sobre a grelha. Cada grão consome uma água.'},
  {title:'O primeiro ouro',detail:'Colete 6 moedas',goal:6,value:c=>c.gold,hint:'Peneira no alto, coletor abaixo com espaço livre. Ouro cai; resíduo anda para a lateral. Instale uma esteira na margem para receber o excesso.'},
  {title:'Ramos industriais',detail:'Compre 2 pesquisas',goal:2,value:c=>c.research,hint:'[T] mostra custos e dependências. Hidráulica antecipa bombas para manter a mistura sem cliques repetidos.'},
  {title:'Uma instalação que trabalha',detail:'Construa 8 peças',goal:8,value:c=>c.machines,hint:'Feche um reservatório com paredes. Bomba → tubos → válvula sobre a peneira. Esteiras levam areia à água; o coletor recebe a saída inferior.'},
  {title:'Ler as profundezas',detail:'Descubra as 6 regiões',goal:6,value:c=>c.discovered,hint:'O eixo sinuoso à direita liga os estratos. [M] amplia o mapa; [F] acompanha o explorador. Pesquisa melhora ferramentas e propulsor.'},
  {title:'Abrir os arquivos',detail:'Resolva 3 câmaras',goal:3,value:c=>c.challenges,hint:'Drene o Arquivo Inundado; derreta a Porta de Geada; leve 12 pelotas à Balança dos Estratos. A geometria resolve cada desafio.'},
  {title:'Prismara continua',detail:'Ative a rede dos arquivos',goal:1,value:c=>Number(c.won),hint:'Com Cartografia, seis regiões e três arquivos resolvidos, ative a rede em Pesquisa. A fábrica continua aberta.'},
];
export function researchById(id:string){return RESEARCH.find(r=>r.id===id);}
