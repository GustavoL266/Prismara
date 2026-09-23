import {type Game,type Panel,type Tool,TOOL_NAMES,FEED_MATERIAL} from '../game/game';
import {Mat,materials} from '../sim/materials';
import {MACHINE_DEFS,type MachineKind,type Machine} from '../sim/machines';
import {MISSIONS,RESEARCH} from '../game/progression';
import {CONTROLS,keysFor} from '../game/input';
import {REGION_NAMES,regionAt} from '../sim/terrain';
import {icon} from './icons';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shortcut=(action:string,label:string,symbol:string)=>`<button data-panel="${action}" title="${label} [${keysFor(action)}]" aria-label="${label}">${icon(symbol,18)}<kbd>${keysFor(action)}</kbd></button>`;
export class UI {
  private inspectorKey='';private category='Todas';
  constructor(private game:Game){
    document.querySelector('#app')!.innerHTML=`
      <canvas id="world" aria-label="Mundo industrial de Prismara"></canvas>
      <div id="hud" class="hidden">
        <div class="resource-strip panel"><span class="gold">${icon('gold',18)} <b id="gold-count">0</b><small>Ouro</small></span><span class="crystal">${icon('crystal',18)} <b id="crystal-count">0</b><small>Cristal raro</small></span><span class="energy">${icon('energy',18)} <b id="energy-count">0</b><small>E</small></span></div>
        <nav class="shortcuts panel">${shortcut('inventory','Inventário','collect')}${shortcut('build','Construção','build')}${shortcut('research','Pesquisa','research')}${shortcut('upgrades','Melhorias','upgrade')}${shortcut('help','Ajuda','help')}<button data-panel="pause" title="Pausa [${keysFor('pause')}]" aria-label="Pausa">${icon('pause',18)}</button></nav>
        <details class="objectives panel" open><summary>Objetivo <span id="mission-number"></span></summary><strong id="mission-title"></strong><p id="mission-detail"></p><div class="row"><progress id="mission-progress" value="0" max="1"></progress><span id="mission-count"></span><button data-action="mission-hint" aria-label="Dica do objetivo">?</button></div></details>
        <aside class="map-panel panel"><div class="row map-header"><button data-action="map" title="Mapa [M]">${icon('map',16)} <span id="map-region"></span></button><button data-action="minimap" aria-label="Recolher minimapa">−</button></div><canvas id="minimap" width="128" height="192" aria-label="Mapa dos estratos"></canvas><small id="coordinates"></small></aside>
        <aside id="inspector" class="inspector panel hidden"></aside>
        <div class="dock panel"><div class="slots">${(['dig','collect','pour','build','select','thermal','vacuum'] as Tool[]).map((t,i)=>`<button data-tool="${t}" title="${TOOL_NAMES[t]} [${i+1}]"><kbd>${i+1}</kbd>${icon(t,22)}<span>${TOOL_NAMES[t]}</span><small id="slot-count-${i}"></small></button>`).join('')}</div><button class="material-choice" data-panel="inventory"><span class="swatch" id="selected-swatch"></span><span><b id="selected-material"></b><small id="selected-count"></small></span></button></div>
        <div class="field-status"><span id="fuel-label"></span><span id="capacity-label"></span><span id="performance-label"></span></div>
      </div><div id="toast" class="toast panel" role="status" aria-live="polite"></div><div id="modal-root"></div>`;
    document.addEventListener('click',e=>void this.click(e));
    document.addEventListener('change',e=>void this.change(e));
    document.addEventListener('input',e=>{const t=e.target as HTMLInputElement;
      if(t.id==='volume'){game.preferences.volume=Number(t.value);game.audio.volume=game.preferences.volume;}
      if(t.id==='ui-scale'){game.preferences.uiScale=Number(t.value);this.scale();}
    });
  }
  toggleMap(expanded=false){const el=document.querySelector('.map-panel')!;if(expanded){el.classList.toggle('expanded');el.classList.remove('collapsed');}else {el.classList.toggle('collapsed');el.classList.remove('expanded');}this.game.renderer.invalidateMap();}
  private scale(){document.documentElement.style.setProperty('--ui-scale',String(this.game.preferences.uiScale??1));}
  private async click(e:MouseEvent){
    const b=(e.target as HTMLElement).closest('button');if(!b||b.disabled)return;const g=this.game,m=g.selectedMachine();
    if(b.dataset.panel){g.setPanel(b.dataset.panel as Panel);return;}
    if(b.dataset.tool){g.selectTool(b.dataset.tool as Tool);return;}
    if(b.dataset.machine){g.selectBuild(b.dataset.machine as MachineKind);return;}
    if(b.dataset.material){g.selectMaterial(Number(b.dataset.material));return;}
    if(b.dataset.pending){g.selectPendingModule(Number(b.dataset.pending));return;}
    if(b.dataset.research){g.research(b.dataset.research);return;}
    if(b.dataset.category){this.category=b.dataset.category;this.showPanel();return;}
    switch(b.dataset.action){
      case 'new': {const seed=Number((document.getElementById('seed') as HTMLInputElement)?.value)||undefined;g.newWorld(seed);break;}
      case 'continue':await g.continueWorld();break;
      case 'close':g.setPanel(g.started?null:'start');break;
      case 'map':this.toggleMap(true);break;case 'minimap':this.toggleMap();break;
      case 'save':await g.save();break;
      case 'save-exit':if(await g.save()){g.started=false;g.setPanel('start');}break;
      case 'backup':await g.exportMigrationBackup();break;
      case 'store-load':g.storeManualLoad();break;
      case 'export':g.exportSave();break;
      case 'import':document.getElementById('save-import')?.click();break;
      case 'feed':if(m)g.queueFeed(m.id);break;case 'feed-selected':if(m)g.queueFeed(m.id,g.material);break;
      case 'toggle':if(m){if(!g.factory.setEnabled(m.id,!m.enabled))g.toast('Libere a passagem antes de fechar a comporta.');this.update(true);}break;
      case 'rotate':g.rotateSelected();break;
      case 'remove':if(m)g.removeMachine(m.id);break;
      case 'copy':g.copySelection();break;case 'config':g.pasteConfig();break;
      case 'beacon':g.activateBeacon();break;
      case 'mission-hint':g.toast(MISSIONS[Math.min(g.progress.mission,MISSIONS.length-1)].hint);break;
      case 'inspect-close':g.selectedId=0;g.selection.clear();this.update(true);break;
    }
  }
  private async change(e:Event){
    const t=e.target as HTMLInputElement,g=this.game,m=g.selectedMachine();
    if(t.id==='save-import'&&t.files?.[0]){await g.importSave(t.files[0]);return;}
    if(t.id==='shake'){g.preferences.shake=t.checked;return;}
    if(!m)return;
    if(t.id==='filter-material')m.filter=Number(t.value);
    if(t.id==='filter-mode')m.mode=t.value as 'material'|'density';
    if(t.id==='density-min')m.densityMin=Math.max(0,Math.min(m.densityMax,Number(t.value)||0));
    if(t.id==='density-max')m.densityMax=Math.max(m.densityMin,Math.min(255,Number(t.value)||0));
    if(t.id==='sensor-target')m.targetId=Number(t.value)||undefined;
    if(t.id==='launch-force')m.force=Math.max(1,Math.min(8,Number(t.value)||1));
    if(t.id==='valve-interval')m.interval=Math.max(1,Math.min(120,Math.round(Number(t.value)||20)));
    if(t.id==='launch-angle')m.angle=Math.max(0,Math.min(80,Number(t.value)||0));
    g.factory.rebuildBlocks();g.world.markDirty(m.x,m.y);this.update(true);
  }
  showPanel(){
    const g=this.game,p=g.panel,root=document.querySelector('#modal-root')!;if(!p){root.innerHTML='';return;}
    const close='<button data-action="close" class="square" aria-label="Fechar painel">✕</button>';
    let body='',title='',tag='PRISMARA';
    if(p==='start'){
      root.innerHTML=`<div class="modal-layer start-layer"><section class="modal start-modal"><span class="eyebrow">INDÚSTRIA SOB OS ESTRATOS</span><h1 class="start-logo">PRISMARA</h1><p class="start-subtitle">A gravidade desenha.<br>Você constrói.</p><p>Libere os grãos, molde seus caminhos e descubra os arquivos de um mundo profundo.</p>${g.hasSave?'<button class="primary wide" data-action="continue">Continuar expedição</button>':''}<label for="seed">Semente do mundo (opcional)</label><input id="seed" type="number" min="1" max="4294967295" placeholder="Uma nova paisagem"><button class="primary wide" data-action="new">Novo mundo</button><button class="wide" data-panel="help">Controles e guia</button><div class="row"><button data-action="import">Importar partida</button><small>v0.5 · módulos 8 × 8</small></div><input id="save-import" type="file" accept=".prismara,.json" hidden><p id="modal-feedback" class="notice hidden" role="status"></p></section></div>`;return;
    }
    if(p==='build'){
      title='Construção';tag='PEÇAS INDUSTRIAIS · CUSTOS EM AREIA';
      const cats=['Todas',...new Set(Object.values(MACHINE_DEFS).map(d=>d.category!))];
      body=`<nav class="categories">${cats.map(c=>`<button data-category="${c}" class="${c===this.category?'active':''}">${c}</button>`).join('')}</nav><p class="muted">Módulos de 8 × 8. Arraste na grade; R gira as portas e a geometria. Shift + botão direito remove em área.</p><div class="machine-grid">${(Object.entries(MACHINE_DEFS) as [MachineKind,typeof MACHINE_DEFS[MachineKind]][]).filter(([,d])=>this.category==='Todas'||d.category===this.category).map(([kind,d])=>`<button class="machine-card ${g.unlocked(kind)?'':'locked'}" data-machine="${kind}" ${g.unlocked(kind)?'':'disabled'} title="${esc(d.description)}"><div class="row"><span style="color:${d.color}">${icon(kind,26)}</span><b>${d.cost} ▪</b></div><strong>${d.name}</strong><small>↓ ${d.input}<br>↗ ${d.output}</small><span class="card-note">${g.unlocked(kind)?d.rotation==='quarter'?'Rotação geométrica':d.rotation==='flip'?'Inverte sentido':'Orientação fixa':RESEARCH.find(r=>r.id===d.research)?.name}</span></button>`).join('')}</div>`;
    }
    if(p==='research'||p==='upgrades'){
      title=p==='upgrades'?'Melhorias do explorador':'Pesquisa';tag=g.factory.gold+' OURO · '+g.factory.countCrystals()+' CRISTAIS';
      const selected=p==='upgrades'?RESEARCH.filter(r=>['vacuum','tools','thermal','capacity','exploration','propulsion'].includes(r.id)):RESEARCH;
      body=`<p class="muted">Ouro financia os ramos básicos. Cristais raros ampliam ferramentas e exploração.</p><div class="research-list">${selected.map(r=>`<article class="research-card ${g.hasResearch(r.id)?'done':''}"><div><small class="branch">${r.branch}</small><h3>${r.name}</h3><p>${r.unlocks}</p><small class="dependency">← ${r.requires.length?r.requires.map(id=>`<span class="${g.hasResearch(id)?'satisfied':''}">${RESEARCH.find(t=>t.id===id)!.name}</span>`).join(' + '):'Fundamentos disponíveis'}</small></div><button data-research="${r.id}" ${g.canResearch(r.id)?'':'disabled'} class="${g.canResearch(r.id)?'primary':''}">${g.hasResearch(r.id)?'✓ Pesquisado':r.gold+' ouro'+(r.crystals?' + '+r.crystals+' ◇':'')}</button></article>`).join('')}</div>${p==='research'?`<div class="research-card"><div><h3>Rede dos Arquivos</h3><p>${g.progress.discovered?.length??1}/6 regiões · ${g.progress.solved?.length??0}/3 arquivos resolvidos</p><small>Cartografia dos Estratos necessária</small></div><button data-action="beacon" ${g.progress.won?'disabled':''}>${g.progress.won?'✓ Conectada':'Ativar rede'}</button></div>`:''}`;
    }
    if(p==='inventory'){
      title='Inventário';tag=g.carried+' / '+g.capacity+' CÉLULAS';
      body=`<p class="muted">[2] transporta porções físicas. [G] transfere a carga para este estoque por escolha explícita. [3] despeja o estoque; [7] aspira após a pesquisa.</p><p class="notice">Manipulador: ${g.manualLoad.pixels.length?g.manualLoad.pixels.length+' '+materials[g.manualLoad.material].name:'vazio'} <button data-action="store-load">Guardar carga [G]</button></p>${g.factory.pendingModules.length?'<h3>Módulos aguardando reposicionamento</h3>'+g.factory.pendingModules.map(p=>`<button class="wide" data-pending="${p.machine.id}">${MACHINE_DEFS[p.machine.kind].name} · reposicionar${p.machine.buffer?.count?' · '+p.machine.buffer.count+' células internas':''}</button>`).join(''):''}<div class="inventory-grid">${materials.filter(m=>m.transportable&&m.state!=='gas').map(m=>`<button data-material="${m.id}" class="inventory-item" title="${esc(m.uses)}"><span class="swatch" style="--swatch:${m.color}"></span><span><b>${m.name}</b><small>${g.inventory[m.id]} células</small></span></button>`).join('')}</div>`;
    }
    if(p==='help'){
      title='Controles e receitas';tag='GEOMETRIA, MATÉRIA E GRAVIDADE';
      body=`<div class="help-grid"><div><h3>Primeira fábrica</h3><ol><li>Escave a margem arenosa com [1]. [2] pega até 25 pixels de um só material: pressione, mova e solte.</li><li>Coloque uma peneira no ar, um coletor abaixo e uma esteira na lateral.</li><li>Leve a areia até a água do bolsão à direita. Depois pegue a areia úmida e solte sobre a peneira. Água fica no mundo.</li><li>Resíduo segue a superfície; ouro cai abaixo. Mantenha as saídas livres.</li><li>Pesquise Rotor de Coleta para equipar [7], ou Hidráulica para conectar bomba, tubos e válvula.</li><li>Para gravidade contínua, escave e transporte os grãos de uma câmara abaixo de um depósito arenoso. Monte a grelha abaixo da queda, com água da válvula e coletor inferior. Depois, uma Sonda libera o depósito automaticamente.</li></ol><p>Carga bloqueada fica na ferramenta. Menu, troca de ferramenta e salvamento preservam os pixels. Depósito parcial mantém o restante. [G] guarda explicitamente a carga na mochila; [3] descarrega a mochila.</p><h3>Indústria avançada</h3><p>Resíduo → Tambor → Argila + Quartzo.<br>Argila → Forno → Pelota → Prensa → Energia + Caco.<br>Quartzo → Cadinho → Vidro; vidro + Névoa → Cristal ou Fragmento.<br>Resíduo + Calor → Calcinado → Triturador → Argila ou Quartzo.</p><p class="notice">A peneira rende 25% de ouro adicional por unidade. É uma abstração de rendimento; não há conservação estrita da quantidade de pixels. Água é finita e consumida.</p></div><div><table class="controls"><tbody>${CONTROLS.map(c=>`<tr><td><kbd>${c.keys}</kbd></td><td>${c.label}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if(p==='pause'){
      title='Expedição em pausa';tag='PARTIDA E PREFERÊNCIAS';
      body=`<div class="pause-content"><button class="primary wide" data-action="close">Continuar</button><div class="row"><button data-action="save">Salvar</button><button data-action="export">Exportar partida</button><button data-action="import">Importar</button></div><input id="save-import" type="file" accept=".prismara,.json" hidden><label for="volume">Volume dos efeitos</label><input id="volume" type="range" min="0" max="0.6" step="0.02" value="${g.preferences.volume}"><label for="ui-scale">Escala da interface</label><input id="ui-scale" type="range" min="0.85" max="1.4" step="0.05" value="${g.preferences.uiScale??1}"><label><input id="shake" type="checkbox" ${g.preferences.shake?'checked':''}> Vibração da câmera</label><button data-action="backup">Exportar cópia anterior à migração</button><button data-panel="new">Novo mundo</button><button data-action="save-exit">Salvar e voltar ao início</button><p class="notice">${g.saveLabel}. Salvamento automático a cada 25 s. Exporte uma cópia para guardar fora do navegador.</p><small>Semente ${g.world.seed} · ${g.world.width} × ${g.world.height} · ${Math.round(g.fps)} FPS<br>Simulação ${g.simulationMs.toFixed(2)} ms · Desenho ${g.renderMs.toFixed(2)} ms</small></div>`;
    }
    if(p==='new'){title='Novo mundo';body='<p>Exporte a partida atual para guardá-la antes de criar outra.</p><div class="row"><button data-action="export">Exportar atual</button><button data-action="new" class="primary">Criar novo mundo</button></div>';}
    if(p==='won'){title='Os arquivos respondem';tag='EXPEDIÇÃO PRINCIPAL CONCLUÍDA';body='<p>Os estratos estão conectados. Sua fábrica continua disponível para novas rotas, experiências e produção.</p><button class="primary wide" data-action="close">Continuar construindo</button>';}
    root.innerHTML=`<div class="modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-header"><div><small class="eyebrow">${tag}</small><h2>${title}</h2></div>${close}</div><p id="modal-feedback" class="notice hidden" role="status"></p>${body}</section></div>`;
  }
  update(force=false){
    const g=this.game;this.scale();document.querySelector('#hud')!.classList.toggle('hidden',!g.started);
    const set=(id:string,v:string)=>{const el=document.getElementById(id);if(el&&el.textContent!==v)el.textContent=v;};
    set('gold-count',String(g.factory.gold));set('crystal-count',String(g.factory.countCrystals()));set('energy-count',String(Math.floor(g.factory.energy.value)));
    set('selected-material',g.tool==='build'?MACHINE_DEFS[g.building].name:materials[g.material].name);
    set('selected-count',g.tool==='build'?MACHINE_DEFS[g.building].cost+' areia':g.inventory[g.material]+' células');
    (document.getElementById('selected-swatch') as HTMLElement).style.setProperty('--swatch',g.tool==='build'?MACHINE_DEFS[g.building].color:materials[g.material].color);
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===g.tool);b.disabled=!g.toolAvailable(b.dataset.tool as Tool);});
    set('slot-count-0',String(g.strength)+'×');set('slot-count-1',g.manualLoad.pixels.length?g.manualLoad.pixels.length+'/25':'5 × 5');set('slot-count-2',String(g.inventory[g.material]));set('slot-count-3',String(g.inventory[Mat.Sand]));set('slot-count-4',String(g.selection.size));set('slot-count-5',g.hasResearch('thermal')?'E':'🔒');
    set('slot-count-6',g.hasResearch('vacuum')?g.carried+'/'+g.capacity:'🔒');
    const mission=MISSIONS[Math.min(g.progress.mission,MISSIONS.length-1)],value=Math.min(mission.goal,mission.value(g.context()));
    set('mission-number',String(Math.min(g.progress.mission+1,MISSIONS.length))+'/'+MISSIONS.length);set('mission-title',mission.title);set('mission-detail',mission.detail);set('mission-count',Math.floor(value)+'/'+mission.goal);
    (document.getElementById('mission-progress') as HTMLProgressElement).value=value/mission.goal;
    set('fuel-label','Jato '+Math.floor(g.player.fuel)+'%');set('capacity-label',(g.manualLoad.pixels.length?'Carga '+g.manualLoad.pixels.length+' '+materials[g.manualLoad.material].name+' · ':'')+'Mochila '+g.carried+'/'+g.capacity);set('performance-label',Math.round(g.fps)+' FPS');
    if(!g.renderer)return;
    set('map-region',REGION_NAMES[regionAt(g.world,g.player.x,g.player.y)]);set('coordinates',Math.round(g.player.x)+' : '+Math.round(g.player.y));
    this.inspector(force);
  }
  private inspector(force:boolean){
    const g=this.game,el=document.querySelector('#inspector')!,m=g.selectedMachine();el.classList.toggle('hidden',!m);
    if(!m){this.inspectorKey='';return;}
    const key=JSON.stringify([m.id,m.rotation,m.enabled,m.mode,m.filter,m.densityMin,m.densityMax,m.force,m.angle,m.interval,m.targetId]);
    if(force||key!==this.inspectorKey){this.inspectorKey=key;el.innerHTML=this.machineInspector(m);}
    document.getElementById('machine-status')!.textContent=m.status;
    const feed=document.getElementById('feed-label');if(feed)feed.textContent=g.isFeeding(m.id)?'Despejando '+g.isFeeding(m.id)+' restantes':'Despejar 16 · '+materials[FEED_MATERIAL[m.kind]??g.material].name;
    const pipe=document.getElementById('pipe-status');if(pipe){const n=g.factory.pipes.inspect(m.id);pipe.textContent='Rede '+(n.networkId+1)+' · '+n.count+'/'+n.capacity+' · '+materials[n.material].name;}
  }
  private machineInspector(m:Machine){
    const g=this.game,d=MACHINE_DEFS[m.kind],options=materials.filter(d=>d.transportable).map(d=>`<option value="${d.id}" ${d.id===m.filter?'selected':''}>${d.name}</option>`).join('');
    return `<div class="row"><b>${d.name} #${m.id}</b><button data-action="inspect-close" aria-label="Fechar inspetor">✕</button></div><div id="machine-status" class="status">${esc(m.status)}</div><p>${d.description}</p><small>↓ ${d.input}<br>↗ ${d.output}</small>${['filter','sensor'].includes(m.kind)?`<label for="filter-material">Material</label><select id="filter-material">${options}</select>`:''}${m.kind==='filter'?`<select id="filter-mode" aria-label="Modo do filtro"><option value="material" ${m.mode==='material'?'selected':''}>Material</option><option value="density" ${m.mode==='density'?'selected':''}>Densidade</option></select>${m.mode==='density'?`<div class="row"><input id="density-min" type="number" value="${m.densityMin}" aria-label="Densidade mínima"><input id="density-max" type="number" value="${m.densityMax}" aria-label="Densidade máxima"></div>`:''}`:''}${m.kind==='sensor'?`<label for="sensor-target">Máquina controlada</label><select id="sensor-target"><option value="">Mais próxima</option>${g.factory.machines.filter(t=>t.id!==m.id&&t.kind!=='sensor'&&g.exploration.knows(t.x,t.y)).map(t=>`<option value="${t.id}" ${m.targetId===t.id?'selected':''}>${MACHINE_DEFS[t.kind].name} #${t.id}</option>`).join('')}</select>`:''}${m.kind==='launcher'?`<div class="row"><label>Força<input id="launch-force" type="number" min="1" max="8" value="${m.force??5}"></label><label>Ângulo<input id="launch-angle" type="number" min="0" max="80" value="${m.angle??35}"></label></div>`:''}${m.kind==='valve'?`<label for="valve-interval">Intervalo da válvula (ticks)</label><input id="valve-interval" type="number" min="1" max="120" value="${m.interval??20}">`:''}${['pipe','pump','valve'].includes(m.kind)?'<small id="pipe-status"></small>':''}${FEED_MATERIAL[m.kind]!==undefined?'<button class="wide" data-action="feed" id="feed-label">Despejar 16 (perto da ferramenta)</button>':''}<div class="row"><button data-action="toggle">${m.kind==='gate'?(m.enabled?'Abrir':'Fechar'):(m.enabled?'Desligar':'Ligar')}</button><button data-action="rotate" ${d.rotation==='none'?'disabled':''}>${d.rotation==='quarter'?'Girar':'Inverter'}</button><button data-action="remove" class="danger">Recolher</button></div><div class="row"><button data-action="copy">Copiar [C]</button><button data-action="config" ${g.clipboard.length?'':'disabled'}>Aplicar configuração</button></div>`;
  }
}
