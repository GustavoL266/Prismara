# Prismara

Um jogo 2D de exploração e automação industrial com partículas, feito em TypeScript, Vite e Canvas 2D. Escave um deserto alienígena, aproveite a gravidade e transforme areia em Cristais Prismáticos. A produção de cerâmica alimenta a fábrica: pelotas que caem sobre uma prensa geram energia, e seus cacos voltam à cadeia.

Prismara possui ambientação, desenhos procedurais, interface e implementação originais. O nome histórico do repositório é `Sandustry`; a identidade apresentada ao jogador é **Prismara**. Não são utilizados sprites, sons, mapas ou código dos jogos que inspiraram o gênero.

Repositório oficial: [GustavoL266/Sandustry](https://github.com/GustavoL266/Sandustry).

Jogo no navegador: [Prismara](https://gustavol266.github.io/Sandustry/).

## Executar localmente

Instale Node.js 22 ou mais recente, com npm, e abra um terminal na raiz do projeto.

```sh
npm ci
npm run dev
```

Abra o endereço local indicado pelo Vite. O jogo roda no navegador, sem servidor de contas e sem serviços externos durante a partida. Use teclado e mouse em um navegador atual com Canvas 2D e armazenamento local habilitados.

```sh
npm test
npm run build
npm run preview
npm run test:browser
```

- `npm ci`: instala as versões fixadas em `package-lock.json`.
- `npm run dev`: inicia o desenvolvimento com atualização automática.
- `npm test`: executa os testes da simulação e dos sistemas do jogo.
- `npm run build`: verifica TypeScript e gera o site estático em `dist/`.
- `npm run preview`: abre uma prévia local do build de produção.
- `npm run test:browser`: testa controles, interface e a cadeia completa no navegador. Inicia o Vite se necessário. No Windows, usa o Chrome instalado; em outros ambientes, execute `npx playwright install chromium` antes. `CHROME_PATH` permite indicar outro executável Chromium.

`node_modules/`, `dist/`, caches, arquivos de ambiente e logs não devem ser enviados ao Git.

## Como jogar

Escolha **Novo mundo** na tela inicial ou **Continuar** para restaurar a partida deste navegador. O guia acompanha a cadeia industrial, da primeira escavação à pesquisa de controle. Explore a superfície, as cavernas minerais e a ruína luminosa, mantendo espaço acima das máquinas para alimentar suas entradas.

| Controle | Ação |
| --- | --- |
| A / D ou setas | Andar |
| Espaço | Saltar / usar o propulsor |
| Mouse | Mirar e inspecionar |
| Botão esquerdo | Usar ferramenta ou construir |
| Botão direito | Ação alternativa / remover máquina |
| 1 | Escavar |
| 2 | Coletar partículas para o inventário |
| 3 | Despejar o material selecionado |
| 4 | Construir |
| Q / E | Alternar material ou máquina |
| R | Girar a construção / mudar o sentido |
| Roda do mouse | Aproximar ou afastar a câmera |
| Botão central + arrastar | Mover a câmera |
| F | Voltar a câmera ao explorador |
| B | Catálogo de construção |
| T | Pesquisa |
| H | Guia |
| I | Mochila / seleção de material |
| M | Mapa |
| Esc | Pausa e opções |

A prévia verde indica uma posição permitida; a vermelha indica obstrução. Observe as entradas, saídas e setas das máquinas antes de posicioná-las. O inspetor mostra material, estado, densidade, temperatura e informações de operação. Uma máquina sem entrada, sem energia, bloqueada ou desligada informa seu estado. Clique numa máquina para selecioná-la; o inspetor também permite alimentar sua entrada a partir da mochila. Essa alimentação despeja os grãos no mundo, sujeitos à física e a obstruções.

## Primeira fábrica

1. Escave a areia próxima da água e colete material para construir. Despeje areia sobre água para obter **Polpa Mineral**; a mistura precisa acontecer entre partículas no mundo.
2. Coloque um **Tambor Separador** abaixo da polpa. Reserve espaço na saída lateral de argila e na saída inferior de quartzo.
3. Após produzir 18 argilas e 3 quartzos, libere Cerâmica no painel **Pesquisa [T]**. Alimente um **Forno Cerâmico** com argila para obter **Pelotas Cerâmicas**. Sem energia, seu aquecedor solar trabalha mais devagar e permite reiniciar a produção.
4. Use a gravidade ou um **Elevador Magnético** para lançar as pelotas sobre uma **Prensa Piezoelétrica**. A queda precisa atingir pelo menos 18 células; impactos fracos podem entupir a entrada. A ação **Lançar** do inspetor despeja pelotas da mochila acima da prensa.
5. Use energia no **Cadinho de Vidro** para fundir quartzo. O vidro sai como líquido físico e permanece quente.
6. Alimente o **Gerador de Névoa** com água e direcione a névoa fria ao vidro. O contato produz cristais ou fragmentos.
7. Conduza os cristais até um **Cofre Prismático**. Só o conteúdo dos cofres conta como moeda de pesquisa; carregar cristais no inventário não basta.
8. Compre pesquisas e recicle cacos e fragmentos no **Triturador**. Expanda usando esteiras, elevadores, filtros, tubos e sensores.
9. Explore a leste até a ruína. Após liberar Controle de Fluxo, leve 24 cristais armazenados no cofre e ative o farol perto da ruína para concluir a expedição. A fábrica pode continuar funcionando depois.

Construções consomem areia e algumas operações consomem energia. Consulte os custos no catálogo e nas definições do jogo. A energia inicial permite iniciar a cadeia, mas a prensa é a fonte renovável da fábrica.

### Receitas e conservação

| Entrada / condição | Resultado |
| --- | --- |
| 1 areia + 1 água em contato | 2 polpas minerais |
| Polpa no tambor | Argila mineral e aproximadamente 22% de chance de quartzo adicional |
| Argila no forno | Pelota cerâmica |
| Pelota com impacto suficiente na prensa | Energia + caco cerâmico |
| Quartzo no cadinho com energia | Vidro fundido |
| Vidro fundido + névoa fria | Aproximadamente 65% de cristal; 35% de fragmento vítreo |
| Caco no triturador | Areia reciclada |
| Fragmento no triturador | Areia ou quartzo |
| Água aquecida | Vapor |
| Vapor resfriado | Água |
| Água + energia no gerador | Névoa fria |

As probabilidades se aplicam a cada processamento; lotes pequenos variam. Saídas obstruídas interrompem o processamento. Dê espaço às partículas e recircule os materiais secundários.

O rendimento de 65% aplica-se ao vidro que **toca a névoa**. Vidro que esfria lentamente sem esse contato vira fragmento. No nível 3, o catálogo oferece um módulo térmico por 22 grãos de areia: cadinho, gerador e bandeja, com as saídas alinhadas. Alimente o gerador com água enquanto o cadinho recebe quartzo. Recicle fragmentos para tentar novamente.

O Pó de Lúmen da flora é um material flutuante adicional: cai devagar, deriva e reage ao calor intenso liberando vapor. Cores, padrões de textura, estados de movimento, ícones e rótulos ajudam a distinguir os materiais.

### Máquinas e progressão

- **Fundamentos:** Esteira de Placas, Tambor Separador e Cofre Prismático.
- **Cerâmica e Energia:** Forno Cerâmico, Elevador Magnético, Prensa Piezoelétrica e Triturador.
- **Vidro e Resfriamento:** Cadinho de Vidro, Gerador de Névoa, Bomba, Tubo e Válvula de Saída.
- **Controle:** Portão de Densidade, Sensor de Presença, fios e esteiras rápidas.

Cerâmica exige 18 argilas e 3 quartzos produzidos; Vidro exige 3 impactos válidos. Essas duas pesquisas não gastam cristais. Controle custa 12 cristais presentes nos cofres. O farol consome outros 24 cristais.

A esteira atua na camada que toca sua superfície. O elevador transporta sólidos; líquidos e gases seguem sua própria física. O portão filtra por configuração. Bombas e válvulas transferem água ou polpa entre o mundo e redes de tubos conectadas; redes separadas mantêm conteúdos separados. Tubos comuns não recebem vidro fundido. Sensores comandam uma máquina compatível; os fios são a representação da ligação lógica, sem peças de fio individuais para construir. A energia usa uma bateria compartilhada pela fábrica, com 160 E iniciais e capacidade de 1.200 E.

## Salvamento e áudio

O salvamento usa `localStorage`, na chave `prismara.world.v1`, e um formato versionado. Ele preserva mundo, partículas, máquinas, inventário, energia, pesquisa, objetivos, explorador e preferências. O jogo salva a cada 25 segundos de simulação, ao ocultar ou sair da página, e oferece controles de partida na pausa. Filas temporárias de alimentação são interrompidas ao restaurar; grãos ainda não despejados permanecem na mochila. O armazenamento pertence ao navegador e ao endereço usado: a versão local e a versão hospedada possuem partidas separadas. Limpar os dados do site remove o salvamento.

Os efeitos são sintetizados com Web Audio, sem arquivos de terceiros. O navegador pode exigir uma interação antes de liberar áudio. O volume pode ser ajustado, e o jogo permanece funcional com áudio desativado.

## Arquitetura e balanceamento

A simulação é uma grade de 640 × 320 células compactas em TypedArrays, com materiais identificados por índices e chunks de 16 × 16 células. Não existe um objeto JavaScript por grão. A física usa passo fixo de 30 Hz; a apresentação usa `requestAnimationFrame`. A ordem de atualização varia para reduzir viés direcional. Movimento, densidade, calor e reações pertencem à simulação; a renderização não decide os resultados de fabricação.

| Arquivo / diretório | Responsabilidade |
| --- | --- |
| [`src/sim/materials.ts`](src/sim/materials.ts) | Identificadores, propriedades, cores e usos dos materiais |
| [`src/sim/reactions.ts`](src/sim/reactions.ts) | Reações de contato, temperaturas e probabilidades |
| [`src/sim/world.ts`](src/sim/world.ts) | Grade, chunks, movimento, densidade e calor |
| [`src/sim/terrain.ts`](src/sim/terrain.ts) | Geração das três regiões a partir da semente |
| [`src/sim/machines.ts`](src/sim/machines.ts) | Catálogo, custos, receitas, processamento e cofres |
| [`src/sim/pipes.ts`](src/sim/pipes.ts) | Conectividade e conteúdo das redes de tubos |
| [`src/sim/energy.ts`](src/sim/energy.ts) | Bateria compartilhada e custos de operação |
| [`src/sim/signals.ts`](src/sim/signals.ts) | Detecção e controle por sensores |
| [`src/game/progression.ts`](src/game/progression.ts) | Objetivos, dicas e apresentação das pesquisas |
| [`src/game/game.ts`](src/game/game.ts) | Partida, inventário, ferramentas e regras de desbloqueio |
| [`src/game/player.ts`](src/game/player.ts), [`src/game/input.ts`](src/game/input.ts) | Explorador, colisão e controles |
| [`src/render/renderer.ts`](src/render/renderer.ts) | Mundo, personagem, efeitos e iluminação |
| [`src/ui/`](src/ui/) | Painéis, ícones e estilos da interface |
| [`src/game/save.ts`](src/game/save.ts), [`src/game/audio.ts`](src/game/audio.ts) | Persistência validada e áudio sintetizado |
| [`tests/`](tests/) | Testes físicos e de integração |

Para modificar um material, altere sua definição em `src/sim/materials.ts`, mantendo seu identificador estável para preservar a compatibilidade dos saves. Ajuste nome, paleta, estado, densidade, temperatura, condutividade, resistência e regras de movimento. Para alterar a cadeia produtiva, modifique `REACTIONS` em `src/sim/reactions.ts` ou `RECIPES` em `src/sim/machines.ts` e rode os testes. Custos de construção ficam em `MACHINE_DEFS`; custos elétricos, em `ENERGY`. Ao mudar requisitos de pesquisa, mantenha `src/game/progression.ts` e as validações em `src/game/game.ts` consistentes. Mudanças incompatíveis nos dados persistidos exigem atualizar a versão do salvamento ou fornecer uma migração.

## Verificação

Os testes cobrem queda granular, líquidos, gases, densidade, mistura, processamento do tambor, impacto piezoelétrico, energia, vidro com névoa e restauração de saves. Eles verificam comportamentos físicos e regras da cadeia; não substituem uma partida humana.

A validação inicial passou em **47 testes de simulação e integração** e **15 verificações no navegador**, com interface em 1280 × 720 e 1920 × 1080 e sem erros de execução do navegador. O teste de navegador usa controles reais para início, movimento, propulsor, mineração e construção. Para repetir a cadeia industrial, usa um cenário controlado com areia, água, areia de construção e energia inicial zero; avança a simulação real e recolhe os produtos entre etapas. Não concede cristais, pesquisas, pelotas ou quartzo artificialmente. Isso valida a cadeia e o salvamento, não mede a duração de uma partida humana.

O relatório e as capturas de cada execução de `test:browser` ficam em `.local/browser/`, ignorados pelo Git. O ponto de inspeção usado pelo teste existe somente no servidor de desenvolvimento com `?test=1`; o build publicado não o expõe.

Roteiro de aceitação manual:

1. Criar um mundo, andar, usar o propulsor e escavar.
2. Misturar areia e água, separar polpa e fabricar pelotas.
3. Fazer uma pelota cair sobre a prensa e observar energia e caco.
4. Fundir quartzo, resfriar vidro e armazenar cristais no cofre.
5. Comprar uma pesquisa e construir a máquina desbloqueada.
6. Salvar, recarregar e confirmar a restauração e operação da fábrica.
7. Conferir interface em 1280 × 720 e 1920 × 1080.

## Publicação

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) instala dependências, executa testes e gera o build em pushes e pull requests de `main`. Apenas `main` pode publicar. O deploy usa o artefato estático e GitHub Pages; não envia `node_modules` nem requer credenciais no código.

O workflow passa `/Sandustry/` como base ao Vite. GitHub Pages está configurado no repositório oficial com **Source → GitHub Actions**; em um fork, selecione essa opção em **Settings → Pages → Build and deployment**. Um push em `main` ou uma execução manual inicia a publicação. A URL prevista é [gustavol266.github.io/Sandustry/](https://gustavol266.github.io/Sandustry/); a configuração da hospedagem não comprova um deploy. Confira o resultado em Actions e o ambiente `github-pages` antes de anunciar a publicação.

Referência da infraestrutura: [documentação oficial de workflows do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Escopo e limitações

Esta versão é uma **vertical slice jogável**: um mundo finito com três regiões conectadas, uma cadeia industrial principal e quatro níveis de progressão. Não há multiplayer, contas, sincronização em nuvem ou suporte a controles por toque.

A meta de progressão é uma sessão introdutória de 10–20 minutos. Esse intervalo é uma intenção de balanceamento, não um resultado comprovado por um estudo com jogadores. A duração depende de exploração, entendimento da física e organização da fábrica. Grandes concentrações de partículas e máquinas podem reduzir a taxa de quadros em dispositivos mais lentos.

A física é discreta e estilizada, não uma simulação científica de fluidos, termodinâmica ou eletricidade. Energia é um recurso de fábrica. A arte procedural e os efeitos sonoros sintetizados mantêm o projeto autocontido. Nenhuma licença foi adicionada ou alterada; qualquer decisão de licenciamento cabe ao proprietário do repositório.
