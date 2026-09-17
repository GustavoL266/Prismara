# Prismara

Jogo 2D de mineração e automação industrial em TypeScript, Vite e Canvas 2D. Escave depósitos consolidados, libere grãos físicos e molde a instalação com paredes, funis, comportas e esteiras. Misture areia com água finita, peneire a areia úmida e conduza o ouro até um coletor. O ouro financia pesquisa; cristais raros financiam melhorias especiais.

Código: [GustavoL266/Prismara](https://github.com/GustavoL266/Prismara). Arte em pixel, mapas por semente, tecnologias e efeitos sonoros procedurais próprios.

![Exploração subterrânea de Prismara](docs/images/04-exploracao-1280.png)

Capturas nas duas resoluções, resultados da fábrica autônoma e medições estão em [Validação](docs/validation.md).

## Executar e verificar

Requer Node.js 22 ou superior e npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:browser
npm run benchmark
```

O navegador não precisa de servidor de contas. O teste de navegador inicia o Vite se necessário; no Windows utiliza Chrome instalado. Em outros sistemas, instale Chromium com `npx playwright install chromium`. `CHROME_PATH` e `PRISMARA_TEST_URL` permitem configurar o navegador e o servidor. A suíte leva aproximadamente quatro minutos, incluindo **três minutos reais**, sem intervenção, de uma instalação autônoma.

## Primeira fábrica

1. O explorador começa com 48 células de areia para construção. A areia do terreno permanece consolidada até ser escavada com **1**; ela fica no mundo. **2** aspira os grãos liberados.
2. Há água num bolsão selado a cerca de 64 células à direita. Despeje areia nessa água com **3**: cada contato consome uma água e cria uma areia úmida. Selecione areia úmida no inventário e use **Shift + 2 + mouse** para aspirar apenas esse material.
3. Construa uma **Peneira Vibratória** num espaço escavado, um **Coletor de Minérios** abaixo e uma esteira na lateral. Deixe espaço entre a grelha e o coletor. Despeje areia úmida sobre a grelha.
4. Resíduo permanece sobre a peneira e avança lentamente para a lateral; ouro cai pela saída inferior. O coletor remove cada grão valioso e credita uma moeda uma única vez.
5. Por **6 ouro**, pesquise Hidráulica de Bolsões. Coloque a bomba em contato com água, conecte tubos pelas bordas e instale uma válvula sobre a alimentação. Regule a vazão no inspetor para economizar água.
6. Para operação contínua, escave uma câmara **abaixo** de um depósito arenoso. Uma esteira sob o depósito conduz os grãos à queda sobre a peneira, onde chega água da válvula. Paredes e funis evitam derramamento. Coloque várias peneiras em degraus descendentes e leve as saídas inferiores aos coletores.
7. Mais tarde, a Sonda Escavadora libera uma célula por operação no alcance de 28 células abaixo do motor; ela trabalha a partir da face inferior do depósito. O Transportador de Arraste e sensores complementam a automação.

Alimentação pelo inspetor é uma conveniência limitada a **16 unidades**, exige proximidade do explorador e usa células físicas livres. Uma fábrica alimentada por gravidade, correias e hidráulica continua produzindo sem repetir essa ação.

## Controles

A interface e o despachante de teclado usam o mesmo catálogo em [src/game/input.ts](src/game/input.ts). A tabela abaixo é gerada com `npm run docs:controls`.

<!-- controls:start -->
| Controle | Ação |
| --- | --- |
| A / D / ← → | Andar |
| Espaço / W / ↑ | Propulsor |
| 1 | Escavar e liberar grãos |
| 2 | Aspirar partículas |
| 3 | Despejar material |
| 4 | Construir por arraste |
| 5 | Selecionar conjunto em área |
| 6 | Lança térmica (pesquisa) |
| B | Catálogo de construção |
| T | Pesquisa |
| U | Melhorias |
| I | Inventário |
| H | Ajuda |
| M | Mapa geral (arraste e roda no painel) |
| N | Recolher minimapa |
| R | Girar ou inverter peça |
| Q | Material ou peça anterior |
| E | Próximo material ou peça |
| C | Copiar conjunto e configurações |
| V | Construir conjunto copiado |
| Delete | Recolher seleção |
| F | Câmera segue explorador |
| Esc | Pausa / fechar painel |
| Mouse esquerdo | Usar ferramenta / construir |
| Mouse direito | Recolher peça |
| Shift + mouse direito | Prévia e remoção em área |
| Shift + aspirar | Aspirar apenas o material selecionado |
| Roda do mouse | Zoom nítido |
| Mouse central + arraste | Mover câmera |
<!-- controls:end -->

## Construção e interface

Recursos no canto superior esquerdo, atalhos compactos, objetivo recolhível no canto superior direito, slots numerados na base e inspetor aberto somente para a máquina selecionada. **N** recolhe o minimapa; **M** alterna o mapa ampliado. A pausa oferece escala de interface de 85% a 140%.

O catálogo mostra categoria, ícone, custo, entrada, saída e política de orientação. Esteiras, peneiras, fornos, prensas e lançadores **invertem o sentido**. Paredes, plataformas, comportas e funis têm **rotação geométrica**, com troca de largura/altura. Bombas, tubos, coletores e sensores têm orientação fixa; névoa e válvulas giram a saída. A prévia, a colisão, o desenho e a operação usam a mesma geometria.

Arraste para construir continuamente. **5 + arraste** seleciona conjuntos; **C** copia as configurações; **V** constrói uma cópia pagando o custo. **Shift + botão direito + arraste** mostra uma prévia da remoção e aplica ao soltar. Recolher devolve o custo sem duplicar os grãos. Tubos só podem ser removidos quando existe espaço para devolver todo seu conteúdo ao mundo.

## Receitas

| Entrada e condição | Saída física |
| --- | --- |
| 1 areia + 1 água em contato | 1 areia úmida; água consumida |
| 1 areia úmida na peneira | 1 resíduo sobre a grelha + 25% de chance de 1 ouro abaixo |
| Ouro ou cristal no coletor | Uma moeda do respectivo tipo; grão removido |
| Resíduo ou polpa antiga no tambor | 1 argila lateral + 22% de chance de quartzo inferior |
| Argila no forno | Pelota cerâmica lateral |
| Pelota com queda ≥ 18 células sobre a prensa | 32 E + caco lateral |
| Quartzo + 3 E no cadinho | Vidro fundido inferior, a 1100 °C |
| Vidro fundido + névoa fria | 65% cristal raro / 35% fragmento; névoa vira água |
| Água + 0,35 E no gerador | Névoa fria na direção configurada |
| Resíduo aquecido a 420 °C | Resíduo calcinado |
| Resíduo + 0,6 E na câmara | Resíduo calcinado lateral, a 480 °C |
| Calcinado + 0,2 E no triturador | 70% argila / 30% quartzo inferior |
| Caco ou fragmento + 0,2 E no triturador | Areia; fragmentos têm 18% de chance de quartzo |
| Água > 100 °C | Vapor ascendente |
| Vapor frio ou contato com superfície fria | Água |
| Gelo aquecido acima de 0 °C | Água |

**Rendimento abstrato:** os bônus de ouro e quartzo representam concentração mineral por unidade processada e podem criar um subproduto adicional. Não há conservação estrita do número de pixels nessas receitas. Água é finita e consumida no umedecimento. Probabilidades variam em lotes pequenos; parâmetros ficam em [reactions.ts](src/sim/reactions.ts).

Máquinas reservam capacidade de saída antes de consumir entrada e energia. Material derramado permanece no mundo. Esteiras movem a camada em contato; pilhas e saídas cheias congestionam a instalação. Lançadores percorrem as células intermediárias e colidem com obstáculos. Grelhas bloqueiam o explorador e os rejeitos, mas permitem os materiais definidos por sua política de passagem.

## Pesquisa

| Ramo | Pesquisa | Custo | Dependências |
| --- | --- | --- | --- |
| Processamento | Tambor dos Sedimentos | 12 ouro | Fundamentos |
| Transporte | Impulso e Triagem | 8 ouro | Fundamentos |
| Gestão de líquidos | Hidráulica de Bolsões | 6 ouro | Fundamentos |
| Ferramentas | Mandíbula de Campo | 6 ouro | Fundamentos |
| Energia e calor | Ciclo da Cerâmica | 14 ouro | Tambor |
| Processamento | Têmpera de Facetas | 18 ouro | Cerâmica + Hidráulica |
| Automação | Cadência Autônoma | 24 ouro | Transporte + Cerâmica |
| Exploração | Cartografia dos Estratos | 10 ouro | Mandíbula |
| Ferramentas | Lança Térmica | 16 ouro | Cerâmica + Mandíbula |
| Ferramentas | Mochila de Facetas | 10 ouro + 3 cristais | Vidro + Mandíbula |
| Exploração | Jato de Profundidade | 8 ouro + 4 cristais | Cartografia + Vidro |

Nenhum ramo básico exige cristais. A fonte inicial de ouro está disponível sem pesquisa ou energia. Melhorias ampliam alcance, capacidade, força de escavação e propulsão.

## Mundo e objetivos

Novas partidas usam **1024 × 1536 células**, com uma galeria sinuosa conectando seis regiões: Planície Âmbar, Galerias do Sedimento, Aquíferos de Ardósia, Estratos de Geada, Fendas Incandescentes e Arquivo das Profundezas. Depósitos aparecem em veios e bolsões. Nomes de região aparecem na descoberta.

O personagem registra permanentemente um **disco de 80 células** ao se mover. O desconhecido fica preto opaco na cena e nos mapas. Zoom, câmera e resolução não aumentam a descoberta. O minimapa acompanha o entorno; **M** abre o mapa geral, navegável por arraste e roda. O mapa guarda a última matéria observada: alterações distantes aparecem ao retornar.

A luz do capacete tem alcance de 65 células na superfície e 45 nas profundezas, com atenuação ao atravessar terreno. **Cartografia dos Estratos** desbloqueia a **Luminária de Galeria**: custa 3 areia, consome 0,002 E por passo, revela 38 células e ilumina 42. Desligar ou remover elimina a luz e conserva a descoberta. Emissão de cristais conhecidos e vidro quente ilumina uma área pequena; não descobre o mapa. O [contrato de exploração](docs/EXPLORACAO.md) explica as três camadas.

Três arquivos contêm desafios distribuídos: drenar uma câmara, derreter uma barreira e conduzir 12 pelotas a um mecanismo. Descubra seis regiões, resolva os três arquivos e pesquise Cartografia para conectar a rede no painel de pesquisa. A conclusão permite continuar explorando e expandindo a fábrica.

## Salvamento e compatibilidade

Formato **v3**, com materiais antigos mantendo os IDs 0–16 e novos IDs acrescentados a partir de 17. A migração lê partidas **v1 e v2**, preserva materiais, máquinas, líquidos dos tubos, energia e inventário, e converte níveis antigos em pesquisas compatíveis. Mundos antigos conservam suas dimensões para preservar construções e partículas; novos mundos usam a geração profunda. Como saves antigos não registravam células exploradas, a migração revela o entorno atual e os footprints das construções. O caminho histórico não pode ser recuperado.

O salvamento usa **IndexedDB assíncrono**, com leitura de `prismara.world.v1` no localStorage para migração. Preserva células, consolidação dos depósitos, temperatura, queda, velocidades dos lançamentos, atividade dos chunks, estado aleatório, pesquisa, desafios, explorador, preferências, moedas e buffers de cada tubo. Não avança a simulação ao carregar. Filas de despejo são canceladas; material ainda na mochila permanece nela.

Também preserva máscara de descoberta, matéria cartográfica lembrada, pontos de interesse, posição/zoom do mapa, variantes visuais dos grãos e parede de fundo subterrânea. Variantes acompanham os grãos em trocas e conversões sem consumir o estado aleatório da física.

Salvamento automático a cada 25 segundos de simulação, ao ocultar a aba e ao sair. Fechar o processo imediatamente pode interromper uma gravação assíncrona; use **Salvar** ou exporte antes. Exportação/importação usa arquivos `.prismara` com validação de limites, IDs, sobreposições, dependências e cartografia. O armazenamento pertence ao navegador e ao endereço da instalação.

## Arquitetura e desempenho

A simulação permanece separada do desenho e usa passo fixo de **30 Hz**. TypedArrays armazenam a grade; chunks de 16 × 16 dormem após estabilizar e acordam ao perder suporte. Depósitos consolidados não sofrem gravidade até serem escavados.

A máscara de colisão muda somente com construções, orientação, filtros e comportas. Redes de tubos são reconstruídas ao mudar peças. O desenho atualiza apenas chunks visíveis alterados, recorta máquinas fora da câmera e reutiliza um conjunto fixo de 320 efeitos. Não faz varredura global de luz por quadro. Coordenadas da câmera são alinhadas aos pixels; o acompanhamento pausa durante arraste para estabilizar a construção.

Medições, ambiente e limitações ficam em [docs/validation.md](docs/validation.md). `npm run benchmark` mede 5.400 ticks em mundos de tamanho completo. A suíte no Chrome registra FPS, tempo de simulação/renderização e operação autônoma. Relatórios, capturas e saves de teste ficam em `.local/`, ignorada pelo Git.

## Publicação

[.github/workflows/pages.yml](.github/workflows/pages.yml) instala dependências, executa testes de simulação e navegador e gera o build com **/Prismara/**. Apenas a branch principal publica o artefato estático no GitHub Pages. A existência do workflow não comprova publicação; consulte o ambiente `github-pages` após a execução.

## Limites práticos

A física é discreta e estilizada; não simula pressão hidráulica ou termodinâmica contínua. A energia usa uma bateria compartilhada. O mundo é finito, a pesquisa tem um conjunto definido de tecnologias e os desafios são gerados por regras de semente. As medições usam um desktop Ryzen 7 e Chrome headless; não garantem desempenho em computadores mais lentos ou instalações de milhares de máquinas. A campanha completa ainda não passou por estudo de balanceamento com jogadores; o teste por controles normais comprova a primeira cadeia, pesquisa hidráulica e deslocamento subterrâneo.

Não há multiplayer, contas, sincronização em nuvem ou controles por toque.
