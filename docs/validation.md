# Validação de Prismara 0.5

Execução local em 24/09/2026. Esta entrega implementa as mudanças pendentes de manipulação, colisão, módulos e migração. O gerador e a persistência existentes foram preservados.

## Testes e build

- **152 testes aprovados**: 128 cenários anteriores atualizados onde a regra mudou e 24 novos cenários de manipulação, rotação, transporte, migração e sementes.
- TypeScript sem erros e build Vite com base **/Prismara/**: 36 módulos, JavaScript principal de 160,09 kB, worker de 16,99 kB e imagem existente de superfície de 1.048,00 kB.
- Teste integral de navegador no Chrome **153.0.8010.53**, sem erros JavaScript ou de console.
- Benchmark: 5.400 passos por cenário, equivalentes a 180 segundos em 30 Hz.

Neste ambiente local, o executável npm não estava disponível; foram executados diretamente os mesmos programas configurados nos scripts: tsx, TypeScript, Vite e o teste de navegador. O workflow do repositório mantém npm ci, npm test, npm run test:browser e npm run build. Os testes são executados em série para que medições de geração não concorram entre arquivos por CPU e memória.

As verificações mantêm mistura consumindo água, saída bloqueada sem perda, crédito único, projeção com colisão, líquidos finitos, pesquisas sem ciclos, temperatura, RNG e validação atômica de saves. Foram alteradas explicitamente as expectativas antigas de apoio sobre areia: todos os grãos soltos são atravessáveis, mesmo parados ou em chunks adormecidos. Terreno e partes sólidas de máquinas continuam bloqueando.

## Escala e geometria

Todas as **27 peças** ocupam **8 × 8 células**, ou 24 × 24 pixels no zoom padrão. O corpo físico do explorador mede 5 × 9 células; a comparação nas duas resoluções confirmou espaço para identificar as silhuetas e construir por arraste. Caixa de construção, seleção, portas, prévia e processamento compartilham a transformação de rotação. Correias, filtros e grelhas usam superfície interna; elevadores empilham; tubos mantêm 48 células por módulo.

## Partida por controles normais

A campanha da semente 91207 usa apenas teclado, mouse e menus para alterar a partida. Leituras do estado escolhem grãos visíveis e uma rota livre para o corpo; não adicionam matéria-prima, moedas ou pesquisas.

O jogador escavou **115 células**, levou porções de areia no quadrado de 5 × 5 até o bolsão natural, recolheu areia úmida e a soltou na peneira. O coletor recebeu **10 ouro em 52,867 segundos de simulação**, processando 38 unidades úmidas, sem aspirador. Restavam 36 unidades de areia de construção. Rotor de Coleta custou seis moedas e liberou a tecla 7; a tecla 2 continuou disponível.

Depois, a campanha usou o aspirador, construiu uma sequência de módulos por arraste, girou uma parede e copiou/removeu três peças sem ganhar ou perder estoque. Os painéis não se sobrepuseram em 1280 × 720 ou 1920 × 1080.

Uma carga manual foi mantida ao abrir o menu e ao percorrer **833 células de rota**, com 46 segmentos, até o Arquivo Inundado. O percurso levou **63,526 segundos reais** e chegou a y=623,1. A campanha salvou, exportou, recarregou a página, continuou e importou o arquivo portátil; carga, quantidade, propriedades, inventário, máquinas e pesquisa permaneceram iguais.

## Compatibilidade e descoberta

O formato v5 aceita v1–v4. A migração preserva células, temperatura, consolidação, metadados das cavernas, moedas, pesquisa e líquidos internos. Peças longas se tornam sequências; o custo original de construção é dividido entre elas. Colisões com terreno, construções ou o personagem deixam o módulo pendente, disponível para reposicionamento gratuito.

Um arquivo v4 controlado também passou pela interface de importação: 48 unidades de água a 73 °C sobreviveram, uma célula consolidada permaneceu intacta, o aspirador ficou disponível e o módulo pendente foi recolocado pelo inventário sem custo. A cópia anterior guardada no IndexedDB foi comparada integralmente com o arquivo importado.

As sementes **1, 17 e 73417** mantiveram os mesmos hashes SHA-256 das células, consolidação e metadados de geração medidos antes das alterações. Não houve redesenho das cavernas. O céu, o relevo por coluna e três células abaixo dele começam conhecidos; a união no carregamento preserva a exploração anterior. A faixa não propaga descoberta pelas cavernas nem concede objetivos. O disco subterrâneo continua com raio de 80 células, separado da iluminação e da memória cartográfica.

## Produção sem intervenção

Este cenário controlado é separado da campanha: recebe um depósito consolidado finito e água uma única vez. Sonda, esteiras, umedecimento, peneira, coletor e hidráulica trabalham sem novos cliques ou insumos durante a medição.

| Tempo | Ouro | Células liberadas | Areia úmida processada |
| --- | ---: | ---: | ---: |
| 30 s | 14 | 45 | 38 |
| 60 s | 19 | 90 | 78 |
| 90 s | 28 | 135 | 117 |
| 120 s | 39 | 180 | 157 |
| 150 s | 51 | 225 | 198 |
| 180 s | 65 | 270 | 237 |

Duração real **180,003 s**, simulada **180,033 s**. A instalação avançada produziu 238 pelotas, 45 impactos, 53 unidades fundidas e 34 cristais coletados. Saídas e névoa usam caminhos físicos; nada é alimentado durante sua simulação.

## Desempenho

Ambiente: win32 10.0.26200, Node v24.19.0, AMD Ryzen 7 5700X 8-Core Processor, 16 processadores lógicos, 15,928 GiB de RAM. Mundo de 1024 × 1536 células.

| Cenário | Média por passo | p95 | p99 | Máximo |
| --- | ---: | ---: | ---: | ---: |
| Mundo gerado | 0,215 ms | 0,324 ms | 0,399 ms | 33,631 ms |
| Linha autônoma | 0,546 ms | 0,770 ms | 0,956 ms | 7,267 ms |

TypedArrays: **33,018 MiB**; cartografia: **3 MiB**. As seis amostras do navegador registraram **144,001–144,047 FPS**, simulação **0,596–0,738 ms** e desenho **1,218–1,352 ms**. Heap final observado: 82,948 MiB. São medições de um desktop específico e médias móveis, sem garantia para computadores mais lentos ou milhares de máquinas.

## Capturas reais

| Cena | 1280 × 720 | 1920 × 1080 |
| --- | --- | --- |
| Início | [Imagem](images/01-inicio-1280.png) | [Imagem](images/01-inicio-1920.png) |
| Manipulador carregado | [Imagem](images/17-manipulador-carga-1280.png) | [Imagem](images/17-manipulador-carga-1920.png) |
| Primeiro ouro | [Imagem](images/02-primeira-fabrica-1280.png) | [Imagem](images/02-primeira-fabrica-1920.png) |
| Módulos e estruturas | [Imagem](images/03-fabrica-etapas-1280.png) | [Imagem](images/03-fabrica-etapas-1920.png) |
| Exploração subterrânea | [Imagem](images/04-exploracao-1280.png) | [Imagem](images/04-exploracao-1920.png) |
| Pesquisa | [Imagem](images/05-pesquisa-1280.png) | [Imagem](images/05-pesquisa-1920.png) |
| Linha autônoma | [Imagem](images/06-linha-autonoma-1280.png) | [Imagem](images/06-linha-autonoma-1920.png) |
| Indústria avançada | [Imagem](images/07-industria-avancada-1280.png) | [Imagem](images/07-industria-avancada-1920.png) |

## Limites restantes

O manipulador leva até 25 pixels de um material e não carrega líquidos ou gases. G é uma conversão explícita da porção para o estoque; temperatura e disposição espacial não fazem parte desse estoque numérico. Fábricas retangulares migradas podem precisar de reposicionamento e reconexão: a grade e as faces mudaram. O backup permite voltar ao arquivo anterior em uma versão compatível. Fechamento abrupto do processo pode interromper uma gravação assíncrona; Salvar e exportar continuam disponíveis. A campanha inteira ainda não passou por estudo de balanceamento com jogadores.
