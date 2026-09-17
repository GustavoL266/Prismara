/** UI help and keyboard dispatch share this single catalogue. */
export const CONTROLS=[
  {action:'move',codes:['KeyA','KeyD','ArrowLeft','ArrowRight'],keys:'A / D / ← →',label:'Andar'},
  {action:'fly',codes:['Space','KeyW','ArrowUp'],keys:'Espaço / W / ↑',label:'Propulsor'},
  {action:'dig',codes:['Digit1'],keys:'1',label:'Escavar e liberar grãos'},
  {action:'collect',codes:['Digit2'],keys:'2',label:'Aspirar partículas'},
  {action:'pour',codes:['Digit3'],keys:'3',label:'Despejar material'},
  {action:'buildTool',codes:['Digit4'],keys:'4',label:'Construir por arraste'},
  {action:'select',codes:['Digit5'],keys:'5',label:'Selecionar conjunto em área'},
  {action:'thermal',codes:['Digit6'],keys:'6',label:'Lança térmica (pesquisa)'},
  {action:'build',codes:['KeyB'],keys:'B',label:'Catálogo de construção'},
  {action:'research',codes:['KeyT'],keys:'T',label:'Pesquisa'},
  {action:'upgrades',codes:['KeyU'],keys:'U',label:'Melhorias'},
  {action:'inventory',codes:['KeyI'],keys:'I',label:'Inventário'},
  {action:'help',codes:['KeyH'],keys:'H',label:'Ajuda'},
  {action:'map',codes:['KeyM'],keys:'M',label:'Mapa geral (arraste e roda no painel)'},
  {action:'minimap',codes:['KeyN'],keys:'N',label:'Recolher minimapa'},
  {action:'rotate',codes:['KeyR'],keys:'R',label:'Girar ou inverter peça'},
  {action:'previous',codes:['KeyQ'],keys:'Q',label:'Material ou peça anterior'},
  {action:'next',codes:['KeyE'],keys:'E',label:'Próximo material ou peça'},
  {action:'copy',codes:['KeyC'],keys:'C',label:'Copiar conjunto e configurações'},
  {action:'paste',codes:['KeyV'],keys:'V',label:'Construir conjunto copiado'},
  {action:'delete',codes:['Delete'],keys:'Delete',label:'Recolher seleção'},
  {action:'follow',codes:['KeyF'],keys:'F',label:'Câmera segue explorador'},
  {action:'pause',codes:['Escape'],keys:'Esc',label:'Pausa / fechar painel'},
  {action:'use',codes:[],keys:'Mouse esquerdo',label:'Usar ferramenta / construir'},
  {action:'remove',codes:[],keys:'Mouse direito',label:'Recolher peça'},
  {action:'removeArea',codes:[],keys:'Shift + mouse direito',label:'Prévia e remoção em área'},
  {action:'collectFilter',codes:[],keys:'Shift + aspirar',label:'Aspirar apenas o material selecionado'},
  {action:'zoom',codes:[],keys:'Roda do mouse',label:'Zoom nítido'},
  {action:'pan',codes:[],keys:'Mouse central + arraste',label:'Mover câmera'},
];
export const actionFor=(code:string)=>CONTROLS.find(c=>c.codes.includes(code))?.action;
export const keysFor=(action:string)=>CONTROLS.find(c=>c.action===action)?.keys??'';
export class Input {
  keys = new Set<string>(); mouseX = 0; mouseY = 0; left = false; right = false; pan = false; overWorld = false;
  onAction: (code: string) => void = () => {}; onZoom: (amount: number) => void = () => {}; onPan: (dx:number,dy:number) => void = () => {};
  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', event => {
      if(event.code==='Escape'){event.preventDefault();if(!event.repeat)this.onAction(event.code);return;}
      if ((event.target as HTMLElement).matches('input,select,textarea')) return;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code); if (!event.repeat) this.onAction(event.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.release());
    canvas.addEventListener('pointermove', e => {
      this.overWorld = document.elementFromPoint(e.clientX,e.clientY) === canvas;
      if (this.pan) this.onPan(e.clientX-this.mouseX,e.clientY-this.mouseY);
      this.mouseX=e.clientX; this.mouseY=e.clientY;
    });
    canvas.addEventListener('pointerdown', e => {
      this.overWorld = true;
      this.mouseX=e.clientX; this.mouseY=e.clientY;
      if(e.button===0)this.left=true; if(e.button===2)this.right=true; if(e.button===1)this.pan=true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointerleave', () => { this.overWorld = false; });
    window.addEventListener('pointerup', () => {this.left=false;this.right=false;this.pan=false;});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',e=>{ e.preventDefault();this.onZoom(-Math.sign(e.deltaY)); },{passive:false});
  }
  release(){this.keys.clear();this.left=false;this.right=false;this.pan=false;}
}
