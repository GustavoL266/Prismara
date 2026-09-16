import { type Game, type Panel, TOOL_NAMES, FEED_MATERIAL } from '../game/game';
import { Mat, materials } from '../sim/materials';
import { MACHINE_DEFS, type MachineKind, type Machine } from '../sim/machines';
import { MISSIONS, RESEARCH } from '../game/progression';
import { icon } from './icons';

const states:Record<string,string>={empty:'Vazio',terrain:'Terreno fixo',granular:'Sólido granular',liquid:'Líquido',gas:'Gás',paste:'Material pastoso',floating:'Flutuante',structure:'Estrutura'};
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class UI {
  private inspectorKey='';
  constructor(private game:Game){
    document.querySelector('#app')!.innerHTML=`
      <canvas id="world" aria-label="Mundo de Prismara: explore com A/D e Espaço; use o mouse para escavar e construir"></canvas>
      <div class="hud hidden" id="hud">
        <div class="brand"><span class="brand-mark">${icon('crystal',34)}</span><div><h1>PRISMARA</h1><small>EXPEDIÇÃO INDUSTRIAL</small></div></div>
        <div class="resource-strip panel" aria-label="Recursos da fábrica">
          <div class="resource">${icon('crystal',22)}<div><strong id="crystal-count">0</strong><span class="unit">CRISTAIS NO COFRE</span></div></div>
          <div class="resource energy">${icon('energy',21)}<div><strong id="energy-count">160</strong><span> / <span id="capacity-count">1200</span></span><span class="unit">ENERGIA</span></div></div>
          <div class="resource"><span class="swatch" style="--swatch:#dab56d;width:17px;height:17px"></span><div><strong id="sand-count">0</strong><span class="unit">AREIA NA MOCHILA</span></div></div>
        </div>
        <div class="top-actions"><button class="square hide-small" data-panel="research" title="Pesquisa [T]" aria-label="Pesquisa">${icon('research',18)}</button><button class="square hide-small" data-panel="help" title="Guia [H]" aria-label="Guia">${icon('help',18)}</button><button class="square" data-panel="pause" title="Pausa [Esc]" aria-label="Pausa">${icon('pause',17)}</button></div>
        <aside class="objectives panel" aria-label="Objetivo atual"><div class="section-label"><span><span class="dot"></span>DIÁRIO DE CAMPO</span><span class="mission-number" id="mission-number">01 / 11</span></div><h2 id="mission-title"></h2><p id="mission-detail"></p><div class="progress-track"><span id="mission-progress"></span></div><div class="objective-count"><span id="mission-count"></span><span id="mission-percent"></span></div><div class="mission-next"><b id="next-number">02</b><span id="next-title"></span></div><button class="text-button" data-panel="help">Abrir caderno de campo ${icon('help',12)}</button></aside>
        <div class="map-panel panel"><div class="section-label"><span id="map-region">SETOR AURORA</span><button class="ghost" style="border:0;padding:0" data-action="map" title="Expandir mapa [M]" aria-label="Expandir mapa">${icon('map',13)}</button></div><canvas id="minimap" width="320" height="160" aria-label="Mapa das três regiões"></canvas><div class="map-footer"><span id="coordinates">130 : 154</span><span>N ↑ · L →</span></div></div>
        <div class="welcome-strip" id="welcome-strip">UM MUNDO DE AREIA, MÁQUINAS E LUZ</div>
        <div class="location" id="location">DESERTO DA SUPERFÍCIE</div><div class="fuel"><span>JATO</span><div class="progress-track"><span id="fuel-progress" style="width:100%"></span></div></div>
        <aside class="inspector panel" id="inspector" aria-label="Inspetor de material e máquina"></aside>
        <nav class="dock panel" aria-label="Ferramentas">
          ${(['dig','collect','pour','build'] as const).map((tool,i)=>`<button class="tool ${i===0?'active':''}" data-tool="${tool}" title="${TOOL_NAMES[tool]} [${i+1}]" aria-label="${TOOL_NAMES[tool]}"><span class="key">${i+1}</span>${icon(tool,23)}<span class="tool-name">${TOOL_NAMES[tool]}</span></button>`).join('')}
          <span class="divider"></span><button class="material-choice" data-panel="inventory" title="Mochila [I] · Q/E alternam material"><span class="swatch" id="selected-swatch" style="--swatch:#dab56d"></span><div><small id="selected-count">MOCHILA · 0</small><strong id="selected-material">Areia</strong></div></button>
          <span class="divider"></span><button class="tool" data-panel="build" title="Catálogo de máquinas [B]" aria-label="Catálogo de máquinas">${icon('separator',23)}<span class="tool-name">Máquinas</span></button><button class="tool" data-panel="research" title="Pesquisa [T]" aria-label="Pesquisar tecnologias">${icon('research',23)}<span class="tool-name">Pesquisa</span></button>
        </nav><div class="footer-hints"><kbd>A D</kbd> MOVER <kbd>ESPAÇO</kbd> PROPULSOR <kbd>Q E</kbd> ALTERNAR <kbd>R</kbd> GIRAR <kbd>RODA</kbd> ZOOM <kbd>F</kbd> SEGUIR</div><div class="save-status" id="save-status">Salvamento local</div>
      </div><div class="toast panel" id="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>`;
    document.addEventListener('click',e=>this.click(e));
    document.addEventListener('change',e=>this.change(e));
    document.addEventListener('input',e=>{const target=e.target as HTMLInputElement;if(target.id==='volume'){game.preferences.volume=Number(target.value);game.audio.volume=game.preferences.volume;game.audio.play('click');}});
  }
  private click(e:MouseEvent){
    const button=(e.target as HTMLElement).closest('button');if(!button)return;
    const g=this.game;
    if(button.dataset.panel){g.setPanel(button.dataset.panel as Panel);return;}
    if(button.dataset.tool){if(button.dataset.tool==='build')g.setPanel('build');else g.selectTool(button.dataset.tool as 'dig'|'collect'|'pour');return;}
    if(button.dataset.machine){g.selectBuild(button.dataset.machine as MachineKind);return;}
    if(button.dataset.material){g.selectMaterial(Number(button.dataset.material));return;}
    if(button.dataset.research){g.research(Number(button.dataset.research));return;}
    const m=g.selectedMachine();
    switch(button.dataset.action){
      case 'new': g.newWorld();break;
      case 'continue':g.continueWorld();break;
      case 'close':g.setPanel(g.started?null:'start');break;
      case 'map':document.querySelector('.map-panel')!.classList.toggle('expanded');break;
      case 'save':g.save();break;
      case 'save-exit':if(g.save()){g.started=false;g.setPanel('start');}break;
      case 'feed':if(m)g.queueFeed(m.id);break;
      case 'feed-selected':if(m)g.queueFeed(m.id,g.material);break;
      case 'toggle':if(m){m.enabled=!m.enabled;this.update(true);}break;
      case 'rotate':if(m){m.rotation=(m.rotation+1)%4;this.update(true);}break;
      case 'remove':if(m)g.removeMachine(m.id);break;
      case 'blueprint':g.buildThermalModule();break;
      case 'beacon':g.activateBeacon();break;
      case 'mission-hint':g.toast(MISSIONS[Math.min(g.progress.mission,MISSIONS.length-1)].hint);break;
    }
  }
  private change(e:Event){
    const target=e.target as HTMLInputElement,g=this.game,m=g.selectedMachine();
    if(target.id==='shake'){g.preferences.shake=target.checked;return;}
    if(!m)return;
    if(target.id==='filter-material')m.filter=Number(target.value);
    if(target.id==='filter-mode')m.mode=target.value as 'material'|'density';
    if(target.id==='density-min')m.densityMin=Math.max(0,Math.min(m.densityMax,Number(target.value)||0));
    if(target.id==='density-max')m.densityMax=Math.max(m.densityMin,Math.min(1000,Number(target.value)||0));
    if(target.id==='sensor-target')m.targetId=Number(target.value)||undefined;
    this.update(true);
  }
  showPanel(){
    const g=this.game,p=g.panel,root=document.querySelector('#modal-root')!;
    if(!p){root.innerHTML='';return;}
    const close=`<button class="square ghost" data-action="close" aria-label="Fechar">✕</button>`;
    let body='',title='',tag='CADERNO DA EXPEDIÇÃO';
    if(p==='start'){
      root.innerHTML=`<div class="modal-layer start-layer"><section class="modal start-modal" aria-label="Início de Prismara"><div class="eyebrow">UMA EXPEDIÇÃO INDUSTRIAL</div><h1 class="start-logo">PRISMARA</h1><p class="start-subtitle">Da primeira partícula<br>ao próximo horizonte.</p><p class="start-description">Um planeta de areia e luz. Escave as dunas, dê forma à matéria e construa uma fábrica movida pela própria gravidade.</p>${g.hasSave?`<button class="primary" data-action="continue">Continuar expedição <span>↗</span></button><button class="secondary" data-panel="new">Novo mundo</button>`:`<button class="primary" data-action="new">Iniciar expedição <span>↗</span></button>`}<button class="secondary" data-panel="help">Caderno de campo <span style="float:right">H</span></button><div class="start-meta"><span>EXPLORAR</span><span>•</span><span>CONSTRUIR</span><span>•</span><span>TRANSFORMAR</span></div></section><div class="start-version">PRISMARA / 0.1 · EXPEDIÇÃO AURORA</div><div class="start-coordinate">PLANETA 07 / SISTEMA DOS ECOS</div></div>`;return;
    }
    if(p==='build'){
      title='Dê forma à sua fábrica';tag=`CATÁLOGO INDUSTRIAL / NÍVEL ${g.progress.tier}`;
      body=`<p class="modal-intro">Construa em espaço livre. Entradas no topo, saídas indicadas no inspetor. Custos em grãos de areia; remover devolve o custo.</p><div class="machine-grid">${(Object.entries(MACHINE_DEFS) as [MachineKind,typeof MACHINE_DEFS[MachineKind]][]).map(([kind,d])=>`<button class="machine-card ${d.tier>g.progress.tier?'locked':''}" data-machine="${kind}" ${d.tier>g.progress.tier?'disabled':''} style="--accent:${d.color}" title="${esc(d.description)}"><span class="card-top">${icon(kind,27)}<span class="cost">${d.cost} ▪</span></span><strong>${d.name}</strong><p>${d.description}</p><span class="level">${d.tier>g.progress.tier?'BLOQUEADO · ':''}NÍVEL ${d.tier}</span></button>`).join('')}</div>${g.progress.tier>=3?`<button class="primary" style="width:100%;padding:14px;margin-top:15px" data-action="blueprint">Montar módulo térmico no posto · 22 areia</button><p class="notice">Um projeto de campo com Cadinho, Névoa e bandeja de contenção. Alimente cada máquina pelo inspetor. A bandeja pode ser escavada.</p>`:''}`;
    }
    if(p==='research'){
      title='Cultive novas possibilidades';tag=`PESQUISA / ${g.factory.countCrystals()} CRISTAIS NO COFRE`;
      body=`<p class="modal-intro">As primeiras descobertas vêm da prática. Tecnologias de controle consomem cristais guardados fisicamente no Cofre Prismático.</p><div class="research-list">${RESEARCH.map(r=>`<div class="research-card ${g.progress.tier>=r.tier?'done':''}"><div class="tier-number">0${r.tier}</div><div class="research-info"><h3>${r.name}</h3><p>${r.machines}</p><p style="color:#d1c58f">${r.requires}</p></div><button ${g.progress.tier>=r.tier||!g.canResearch(r.tier)?'disabled':''} class="${g.canResearch(r.tier)?'primary':''}" data-research="${r.tier}">${g.progress.tier>=r.tier?'✓ Descoberto':r.cost?`${r.cost} ◇ · Pesquisar`:'Descobrir'}</button></div>`).join('')}</div><div class="research-card" style="margin-top:20px;border-color:#c59de34a"><span style="color:#d7b7ec">${icon('crystal',29)}</span><div class="research-info"><h3>O farol dos ecos</h3><p>Encontre a ruína a leste. Nível 4 + 24 cristais no cofre reacendem o farol e concluem a expedição.</p></div><button data-action="beacon" ${g.progress.won?'disabled':''}>${g.progress.won?'✓ Reaceso':'Ativar farol'}</button></div>`;
    }
    if(p==='inventory'){
      title='Tudo começa com matéria';tag='MOCHILA DE CAMPO / SELECIONE PARA DESPEJAR';
      body=`<p class="modal-intro">Colete com [2]. Selecione um material abaixo e segure o mouse no mundo para despejá-lo. Q/E alternam a seleção. Vidro fundido precisa ser resfriado antes da coleta.</p><div class="inventory-grid">${materials.filter(m=>m.transportable&&m.state!=='gas').map(m=>`<button class="inventory-item" data-material="${m.id}" title="${esc(m.uses)}"><span class="swatch" style="--swatch:${m.color}"></span><span><strong>${m.name}</strong><small>${g.inventory[m.id]} pixels</small></span></button>`).join('')}</div>`;
    }
    if(p==='help'){
      title='Caderno de campo';tag='EXPEDIÇÃO AURORA / GUIA DO EXPLORADOR';
      const current=MISSIONS[Math.min(g.progress.mission,MISSIONS.length-1)];
      body=`${g.started?`<div class="recipe-chain"><b>AGORA · ${current.title}</b><br>${current.hint}</div>`:''}<div class="help-grid"><div><h3>01 / Explore e colete</h3><p>A/D ou setas para andar. Segure Espaço para saltar e voar com a mochila. A barra JATO se recupera ao soltar.</p><p>Escavar [1] quebra o terreno e coleta recursos. Coletar [2] recolhe grãos sem destruir terra e rocha. Ferramentas alcançam 95 células. I abre a mochila.</p><h3>02 / Transforme</h3><p>Despejar [3] devolve o material da mochila ao mundo. Misture areia com água da reserva à direita. Colete a polpa resultante e despeje sobre o Tambor.</p><p>Clique em uma máquina para inspecionar e use <b>Alimentar</b>: o material da mochila cai pela entrada física, um grão de cada vez.</p><h3>03 / Construa</h3><p>B abre o catálogo. R gira, Q/E alternam peças. Verde indica espaço livre. Clique para construir; botão direito recolhe e devolve a areia investida. Máquinas podem ser suspensas.</p></div><div><h3>04 / A cadeia da luz</h3><p>Areia + Água → Polpa → Tambor → Argila + Quartzo.<br>Argila → Forno → Pelota → queda de 18 células → Prensa → Energia + Caco.<br>Quartzo + Energia → Cadinho → Vidro Fundido.<br>Vidro + Névoa → Cristal ou Fragmento.</p><p>Caco e Fragmento → Triturador → materiais reutilizáveis. Água + Energia → Gerador → Névoa Fria. Cristais no Cofre → Pesquisa [T].</p><h3>05 / Automatize e explore</h3><p>A esteira carrega somente a camada de grãos em contato. Elevadores transportam sólidos. Conecte tubos pelas bordas; a bomba aspira líquidos e a válvula os devolve ao mundo.</p><p>Filtros separam por material ou densidade. Sensores controlam uma máquina selecionada. Entupimentos aparecem no inspetor. M amplia o mapa. Arraste com o botão central para olhar ao redor; F volta ao explorador.</p><h3>06 / Não perca sua expedição</h3><p>Salvamento automático a cada 25 segundos. Esc abre pausa, salvar e volume. A ruína a leste oferece cristais recuperáveis e o objetivo final.</p></div></div><button class="primary" style="width:100%;padding:13px;margin-top:20px" data-action="close">${g.started?'Voltar à expedição':'Voltar ao início'}</button>`;
    }
    if(p==='pause'){
      title='Um instante entre as dunas';tag='EXPEDIÇÃO EM PAUSA';
      body=`<div class="pause-content"><button class="primary" data-action="close">Continuar</button><button data-action="save">Salvar expedição</button><button data-panel="help">Caderno de campo</button><div class="setting"><label for="volume">Volume dos efeitos</label><input id="volume" type="range" min="0" max="0.6" step="0.02" value="${g.preferences.volume}" aria-label="Volume dos efeitos"></div><div class="setting"><label for="shake">Vibração da câmera</label><input id="shake" type="checkbox" ${g.preferences.shake?'checked':''}></div><button data-panel="new" class="ghost">Novo mundo</button><button data-action="save-exit" class="ghost">Salvar e voltar ao início</button><p class="notice">${g.saveLabel}. Sua partida pertence a este navegador.</p><p class="muted" style="font:9px monospace">${Math.floor(g.progress.elapsed/60)} min de expedição · ${Math.round(g.fps)} FPS · semente ${g.world.seed}</p></div>`;
    }
    if(p==='new'){
      title='Um novo horizonte';tag='NOVA EXPEDIÇÃO';
      body=`<div class="pause-content"><p class="modal-intro">Um novo planeta substituirá o salvamento atual neste navegador. A expedição anterior não poderá ser restaurada.</p><button class="primary" data-action="new">Criar novo mundo</button><button class="ghost" data-action="close">Manter expedição atual</button></div>`;
    }
    if(p==='won'){
      title='O planeta responde.';tag='EXPEDIÇÃO CONCLUÍDA / FAROL REACESO';
      body=`<p class="won-banner">Você deu à areia<br>uma nova forma de brilhar.</p><p class="modal-intro">O farol dos ecos voltou a iluminar Prismara. A primeira fábrica é só o começo: explore as cavernas, recicle os materiais e crie novas rotas de produção.</p><div class="research-card"><div class="research-info"><h3>${Math.floor(g.progress.elapsed/60)} minutos de expedição</h3><p>${g.factory.counters.clay} argilas · ${g.factory.counters.impacts} impactos · ${g.progress.crystalsMade} cristais produzidos</p></div>${icon('crystal',44)}</div><button class="primary" style="width:100%;padding:15px;margin-top:20px" data-action="close">Continuar construindo</button>`;
    }
    root.innerHTML=`<div class="modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-header"><div><div class="eyebrow muted">${tag}</div><h2>${title}</h2></div>${close}</div>${body}</section></div>`;
  }
  update(force=false){
    const g=this.game;
    document.querySelector('#hud')!.classList.toggle('hidden',!g.started);
    const set=(id:string,value:string)=>{const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value;};
    set('crystal-count',String(g.factory.countCrystals()));set('energy-count',String(Math.floor(g.factory.energy.value)));set('capacity-count',String(g.factory.energy.capacity));set('sand-count',String(g.inventory[Mat.Sand]));
    set('save-status',g.saveLabel);set('selected-material',g.tool==='build'?MACHINE_DEFS[g.building].name:materials[g.material].name);set('selected-count',g.tool==='build'?`CONSTRUIR · ${MACHINE_DEFS[g.building].cost} AREIA`:`MOCHILA · ${g.inventory[g.material]}`);
    (document.getElementById('selected-swatch') as HTMLElement).style.setProperty('--swatch',g.tool==='build'?MACHINE_DEFS[g.building].color:materials[g.material].color);
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===g.tool));
    if(!g.renderer)return;
    const region=g.player.y>205?'CAVERNAS MINERAIS':g.player.x>505?'RUÍNA PRISMÁTICA':'DESERTO DA SUPERFÍCIE';
    set('location',region);set('map-region',g.player.x>505?'SETOR DOS ECOS':g.player.y>205?'SUBSOLO MINERAL':'SETOR AURORA');set('coordinates',`${Math.round(g.player.x).toString().padStart(3,'0')} : ${Math.round(g.player.y).toString().padStart(3,'0')}`);
    (document.getElementById('fuel-progress') as HTMLElement).style.width=`${g.player.fuel}%`;
    document.querySelector('#welcome-strip')!.classList.toggle('hidden',g.progress.elapsed>30);
    const n=Math.min(g.progress.mission,MISSIONS.length-1),mission=MISSIONS[n],value=Math.min(mission.goal,mission.value(g.context()));
    set('mission-number',`${String(n+1).padStart(2,'0')} / ${MISSIONS.length}`);set('mission-title',mission.title);set('mission-detail',`${mission.detail}. ${mission.hint}`);set('mission-count',`${value} / ${mission.goal}`);set('mission-percent',`${Math.round(value/mission.goal*100)}%`);(document.querySelector('#mission-progress') as HTMLElement).style.width=`${value/mission.goal*100}%`;
    set('next-number',n+1<MISSIONS.length?String(n+2).padStart(2,'0'):'✓');set('next-title',n+1<MISSIONS.length?MISSIONS[n+1].title:'Continue explorando e construindo.');
    this.inspector(force);
  }
  private inspector(force:boolean){
    const g=this.game,el=document.querySelector('#inspector')!;
    const p=g.renderer.worldPoint(g.input.mouseX,g.input.mouseY),selected=g.selectedMachine();
    const m=selected??g.machineAt(p.x,p.y);
    if(m){
      const key=`machine${m.id}-${m.rotation}-${m.enabled}`;
      if(key!==this.inspectorKey||force){this.inspectorKey=key;el.innerHTML=this.machineInspector(m);}
      const status=document.querySelector('#machine-status');if(status)status.textContent=m.status;
      const feed=document.querySelector('#feed-label');if(feed){const remaining=g.isFeeding(m.id);feed.textContent=remaining?`Alimentando · ${remaining} restantes`:m.kind==='press'?'Lançar 12 pelotas · queda de 24 células':`Alimentar · ${materials[FEED_MATERIAL[m.kind]??g.material].name}`;}
      const pipe=document.querySelector('#pipe-status');if(pipe){const net=g.factory.pipes.inspect(m.id);pipe.textContent=`Rede ${net.networkId+1} · ${net.count}/${net.capacity} pixels · ${net.mixed?'Mistura':materials[net.material].name}`;}
      // Hover inspection should not expose actions on an unrelated previously selected machine.
      if(!selected){g.selectedId=m.id;}
      return;
    }
    const mat=g.world.get(p.x,p.y),d=materials[mat],index=g.world.inBounds(p.x,p.y)?g.world.index(p.x,p.y):-1,temp=index>=0?g.world.temperature[index]:24;
    const key=`mat${mat}-${temp}-${g.tool}`;if(key===this.inspectorKey&&!force)return;this.inspectorKey=key;
    el.innerHTML=`<div class="section-label"><span>INSPEÇÃO DE CAMPO</span><span style="color:${d.color}">▪</span></div><h3>${d.name}</h3><div class="status">${states[d.state]}</div><div class="properties"><span>ρ ${d.density}</span><span>${temp} °C</span></div><p>${d.uses}</p><div class="section-label" style="border-top:1px solid var(--line);padding-top:9px;margin-top:9px"><span>${TOOL_NAMES[g.tool]}</span><span>${g.tool==='build'?'R · GIRAR':'Q / E'}</span></div>`;
  }
  private machineInspector(m:Machine){
    const g=this.game,d=MACHINE_DEFS[m.kind],configurable=m.kind==='filter'||m.kind==='sensor';
    const materialOptions=materials.filter(d=>d.transportable).map(d=>`<option value="${d.id}" ${d.id===m.filter?'selected':''}>${d.name}</option>`).join('');
    return `<div class="section-label"><span>MÁQUINA / ${m.id.toString().padStart(2,'0')}</span><span style="color:${d.color}">${icon(m.kind,16)}</span></div><h3>${d.name}</h3><div class="status" id="machine-status">${esc(m.status)}</div><p>${d.description}</p><p style="font-size:9px">↓ ${d.input}<br>↗ ${d.output}</p>${configurable?`<label class="section-label" for="filter-material">MATERIAL DETECTADO</label><select id="filter-material" aria-label="Material do filtro ou sensor">${materialOptions}</select>`:''}${m.kind==='filter'?`<select id="filter-mode" aria-label="Modo do filtro"><option value="material" ${m.mode==='material'?'selected':''}>Por material</option><option value="density" ${m.mode==='density'?'selected':''}>Por intervalo de densidade</option></select>${m.mode==='density'?`<div class="row"><input id="density-min" type="number" min="0" max="1000" value="${m.densityMin}" aria-label="Densidade mínima"><input id="density-max" type="number" min="0" max="1000" value="${m.densityMax}" aria-label="Densidade máxima"></div>`:''}`:''}${m.kind==='sensor'?`<label class="section-label" for="sensor-target">MÁQUINA CONTROLADA</label><select id="sensor-target"><option value="">Mais próxima</option>${g.factory.machines.filter(t=>t.id!==m.id&&t.kind!=='sensor').map(t=>`<option value="${t.id}" ${m.targetId===t.id?'selected':''}>${MACHINE_DEFS[t.kind].name} #${t.id}</option>`).join('')}</select>`:''}${['pipe','pump','valve'].includes(m.kind)?'<p id="pipe-status"></p>':''}${FEED_MATERIAL[m.kind]!==undefined?'<button class="wide primary" data-action="feed" id="feed-label">Alimentar</button>':''}${m.kind==='crusher'?'<button class="wide" data-action="feed-selected">Alimentar material selecionado</button>':''}<div class="row"><button data-action="toggle">${m.enabled?'Desligar':'Ligar'}</button><button data-action="rotate">Girar ↻</button><button data-action="remove" class="danger" title="Recolher e devolver o custo de construção">Recolher</button></div>`;
  }
}
