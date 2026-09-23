# Descoberta e leitura do mundo

Contrato da revisão, registrado antes da implementação:

- Física, conhecimento e iluminação são dados independentes. A fábrica continua funcionando em áreas desconhecidas.
- Céu e superfície começam conhecidos em toda a largura, até três células sob cada altura armazenada em `generation.surface`. Não há busca por ar conectado nem descoberta automática de câmaras. A carga de uma partida une essa faixa à máscara existente.
- O personagem revela um disco de raio 80 células, usando o centro de cada célula. Zoom, câmera, resolução e mapa não alteram esse raio.
- Deslocamentos contínuos unem discos; teleporte revela apenas o destino.
- Conhecimento é permanente. Material cartográfico guarda a última observação; alterações distantes aparecem ao retornar.
- Nunca descoberto é preto opaco na cena e nos mapas, inclusive decoração, efeitos e marcadores. Nome de região não revela suas células.
- Luz atual varia de 65 células na superfície a 45 nas profundezas. Terreno atenua luz forte. O raio de luz não altera o disco de descoberta.
- Luminárias locais revelam e iluminam enquanto ligadas e alimentadas; remoção conserva conhecimento.
- Salvamentos anteriores revelam o entorno atual e as construções existentes. O caminho histórico não pode ser reconstruído de dados ausentes.

Os raios são decisões de projeto; medições e capturas finais são registradas na validação.

## Implementação

`src/game/exploration.ts` separa `discoveredCells` e `rememberedMaterial`, duas Uint8Arrays de dimensão igual à grade. Em 1024 × 1536 usam 3 MiB no total. Movimento revela discos e amostra trajetos longos a intervalos de raio/3; o argumento explícito de teleporte impede corredores fictícios. Parado, o entorno observado atualiza a cada 12 ticks. Luminárias estáticas revelam uma vez e atualizam a memória nessa mesma cadência. O mapa recolhido não interrompe a observação.

`src/render/lighting.ts` usa raios em uma grade reduzida de duas células e buffers reutilizados. Luz atual atravessa cavidades e perde intensidade no terreno; o conhecimento radial não usa oclusão. Sobreposições combinam `1 − (1 − luzA) × (1 − luzB)`, limitadas a 1. A máscara final cobre todo o viewport, inclusive sprites, tubos, ruínas, efeitos e áreas fora dos limites do mundo. Células desconhecidas usam alpha 255, sem suavização que mostre seu conteúdo.

`src/render/fog.ts` suaviza seis células exclusivamente dentro do lado conhecido da fronteira. Distância aproximada usa vizinhança de oito células, buffer reutilizável e padding para não escurecer artificialmente as bordas da câmera. Esse desenho não modifica a máscara de conhecimento. O brilho de um grupo mineral também exige vizinhos já conhecidos.

A parede de fundo fica em `world.backdrop`, sem colisão. Ruído contínuo por semente cria galerias, manchas e veios sem consumir o RNG da física. A textura dos grãos usa `world.visualVariant`; bordas observam vizinhos e invalidam chunks adjacentes. Descritores de apresentação ficam em `src/render/presentation.ts`, separados das receitas e propriedades físicas. Calor aparente acompanha a temperatura atual.

O minimapa local e o mapa geral usam escala igual nos dois eixos. Agregam apenas matéria lembrada de células descobertas e escurecem amostras com cobertura parcial. Marcadores de câmaras exigem descoberta do centro interno; seleção e inspetor recusam máquinas desconhecidas. Prévia e construção exigem todo o footprint conhecido.

Canvas do mundo usa uma densidade de pixels inteira, arredondada e limitada a 2×, com CSS em tamanho de viewport. Câmera e mira usam a mesma origem em coordenadas CSS. Zoom lógico é inteiro, e o desenho mantém smoothing desligado; mapas e sprites também usam pixels sem interpolação.

## Persistência e limites

Saves v5 preservam os dados v3/v4 e comprimem descoberta, memória, variantes e fundo junto ao estado físico no worker. A leitura valida comprimento, valores, bounds, marcadores e memória fora da máscara. Importação/exportação inclui os mesmos dados. V1 e v2 recebem apenas o entorno atual e footprints existentes; a lista de regiões visitadas não revela suas extensões. Novo mundo cria buffers novos.

A descoberta radial funciona como leitura do subsolo, inclusive depósitos atrás de paredes. A luz reduzida aproxima oclusão; não calcula óptica contínua ou sombras exatas de cada máquina. A memória cartográfica registra materiais, sem histórico de todos os estados de máquinas. Telemetria industrial remota não foi adicionada. A galeria de comparação é um cenário de teste, ausente dos controles normais.
