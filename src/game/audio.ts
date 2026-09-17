/** Original procedural foley. Sound randomness is independent of simulation RNG. */
export class AudioSystem {
  private context?:AudioContext;private noise?:AudioBuffer;private last=0;volume=.18;
  play(kind:'dig'|'water'|'build'|'impact'|'research'|'click'|'heat') {
    const now=performance.now();if(this.volume<=0||now-this.last<65)return;this.last=now;
    try {
      this.context??=new AudioContext();const c=this.context;if(c.state==='suspended')void c.resume();
      const gain=c.createGain();gain.connect(c.destination);
      gain.gain.setValueAtTime(this.volume*.3,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+.22);
      if(['dig','build','impact','heat'].includes(kind)){
        if(!this.noise){this.noise=c.createBuffer(1,Math.floor(c.sampleRate*.2),c.sampleRate);const data=this.noise.getChannelData(0);let state=9817;for(let i=0;i<data.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;data[i]=(state/2147483648-1)*(1-i/data.length);}}
        const source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=this.noise;filter.type='lowpass';filter.frequency.value=kind==='impact'?280:kind==='dig'?1800:900;source.connect(filter).connect(gain);source.start();source.stop(c.currentTime+.2);
      }
      const oscillator=c.createOscillator(),freq={dig:70,water:460,build:180,impact:48,research:620,click:340,heat:115};
      oscillator.type=kind==='research'?'triangle':kind==='build'?'square':'sine';
      oscillator.frequency.setValueAtTime(freq[kind],c.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(freq[kind]*(kind==='research'?1.5:kind==='water'?1.25:.42),c.currentTime+.16);
      oscillator.connect(gain);oscillator.start();oscillator.stop(c.currentTime+.23);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }catch{/* Audio never changes simulation or interrupts a game. */}
  }
}
