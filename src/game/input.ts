export class Input {
  keys = new Set<string>(); mouseX = 0; mouseY = 0; left = false; right = false; pan = false;
  onAction: (code: string) => void = () => {}; onZoom: (amount: number) => void = () => {}; onPan: (dx:number,dy:number) => void = () => {};
  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', event => {
      if ((event.target as HTMLElement).matches('input,select,textarea')) return;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code); if (!event.repeat) this.onAction(event.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.release());
    canvas.addEventListener('pointermove', e => {
      if (this.pan) this.onPan(e.clientX-this.mouseX,e.clientY-this.mouseY);
      this.mouseX=e.clientX; this.mouseY=e.clientY;
    });
    canvas.addEventListener('pointerdown', e => {
      this.mouseX=e.clientX; this.mouseY=e.clientY;
      if(e.button===0)this.left=true; if(e.button===2)this.right=true; if(e.button===1)this.pan=true;
      canvas.setPointerCapture(e.pointerId);
    });
    window.addEventListener('pointerup', () => {this.left=false;this.right=false;this.pan=false;});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',e=>{ e.preventDefault();this.onZoom(-Math.sign(e.deltaY)); },{passive:false});
  }
  release(){this.keys.clear();this.left=false;this.right=false;this.pan=false;}
}
