import * as Tone from 'tone';

let initialized = false;
let muted = false;

const masterGain = new Tone.Gain(0.6).toDestination();
const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.25 }).connect(masterGain);

function synth(options) {
  return new Tone.Synth(options).connect(masterGain);
}

const sounds = {
  tapeLand() {
    const s = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(reverb);
    const pitch = 55 + Math.random() * 20;
    s.triggerAttackRelease(pitch, '8n');
    setTimeout(() => s.dispose(), 1000);
  },

  tapInspect() {
    const s = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
    });
    s.triggerAttackRelease('C5', '32n');
    s.frequency.rampTo('G5', 0.08);
    setTimeout(() => s.dispose(), 500);
  },

  returnToShelf() {
    const s = synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 },
    });
    s.triggerAttackRelease('E4', '16n');
    s.frequency.rampTo('C3', 0.12);
    setTimeout(() => s.dispose(), 500);
  },

  dragStart() {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    }).connect(masterGain);
    noise.triggerAttackRelease('32n');
    setTimeout(() => noise.dispose(), 200);
  },

  dropInPlace() {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).connect(reverb);
    noise.triggerAttackRelease('16n');
    const click = synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    });
    click.triggerAttackRelease('A3', '32n');
    setTimeout(() => { noise.dispose(); click.dispose(); }, 500);
  },

  correct() {
    const notes = ['C4', 'E4', 'G4', 'C5'];
    notes.forEach((note, i) => {
      setTimeout(() => {
        const s = synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.3 },
        });
        s.triggerAttackRelease(note, '8n');
        setTimeout(() => s.dispose(), 1000);
      }, i * 150);
    });
  },

  wrong() {
    const s1 = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
    });
    const s2 = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
    });
    s1.triggerAttackRelease('A2', '8n');
    s2.triggerAttackRelease('Bb2', '8n');
    const crackle = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.1 },
    }).connect(masterGain);
    crackle.triggerAttackRelease('8n');
    setTimeout(() => { s1.dispose(); s2.dispose(); crackle.dispose(); }, 1000);
  },

  uncover() {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.1, release: 0.2 },
    }).connect(masterGain);
    noise.triggerAttackRelease('4n');
    setTimeout(() => {
      const ding = synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.3 },
      });
      ding.triggerAttackRelease('E5', '8n');
      setTimeout(() => ding.dispose(), 1000);
    }, 500);
    setTimeout(() => noise.dispose(), 1500);
  },

  penalty() {
    const s = synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
    });
    s.triggerAttackRelease('G4', '16n');
    s.frequency.rampTo('C3', 0.15);
    setTimeout(() => s.dispose(), 500);
  },

  gameWin() {
    const win = new Audio('/audio/win.mp3');
    win.volume = 0.7;
    win.play().catch(() => {});
  },

  gameLoss() {
    const s = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 1.5, sustain: 0, release: 0.5 },
    });
    s.triggerAttackRelease('C4', '2n');
    s.frequency.rampTo('C1', 1.5);
    const noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.1, decay: 1.5, sustain: 0, release: 0.3 },
    }).connect(masterGain);
    noise.triggerAttackRelease('2n');
    setTimeout(() => { s.dispose(); noise.dispose(); }, 3000);
  },

  share() {
    const click = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    }).connect(masterGain);
    click.triggerAttackRelease('32n');
    setTimeout(() => {
      const whir = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0, release: 0.05 },
      }).connect(masterGain);
      whir.triggerAttackRelease('8n');
      setTimeout(() => whir.dispose(), 500);
    }, 50);
    setTimeout(() => click.dispose(), 200);
  },
};

export const audio = {
  async init() {
    if (initialized) return;
    await Tone.start();
    initialized = true;
  },

  play(event) {
    if (!initialized || muted) return;
    if (sounds[event]) {
      try { sounds[event](); } catch (e) { console.warn('Audio error:', e); }
    }
  },

  setMuted(value) {
    muted = value;
  },

  isMuted() {
    return muted;
  },
};
