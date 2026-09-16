export class AudioSystem {
  private context?: AudioContext;
  volume = 0.18;
  private last = 0;
  play(kind: 'dig' | 'water' | 'build' | 'impact' | 'research' | 'click' | 'heat') {
    if (this.volume <= 0) return;
    const now = performance.now();
    if (now - this.last < 65) return;
    this.last = now;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
      const frequencies = { dig: 85, water: 310, build: 240, impact: 65, research: 740, click: 440, heat: 130 };
      oscillator.type = kind === 'research' ? 'sine' : kind === 'dig' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequencies[kind], ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequencies[kind] * (kind === 'research' ? 2 : 0.4), ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.23);
      oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.25);
    } catch { /* Audio is optional: blocked audio never interrupts simulation. */ }
  }
}
