// High-tech synthesized audio cues via Web Audio API

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('pisentinel_sound') === 'true';
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('pisentinel_sound', this.enabled ? 'true' : 'false');
    if (this.enabled) {
      this.playBeep(880, 0.08, 'sine');
    }
    return this.enabled;
  }

  playBeep(freq = 440, duration = 0.1, type = 'sine', volume = 0.05) {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked by browser autoplay policy until user gesture
    }
  }

  playAttackAlert() {
    if (!this.enabled) return;
    this.playBeep(880, 0.12, 'triangle', 0.08);
    setTimeout(() => {
      this.playBeep(1174, 0.18, 'triangle', 0.06);
    }, 120);
  }

  playBan() {
    if (!this.enabled) return;
    this.playBeep(320, 0.15, 'sawtooth', 0.08);
    setTimeout(() => {
      this.playBeep(180, 0.25, 'sawtooth', 0.08);
    }, 100);
  }

  playSuccess() {
    if (!this.enabled) return;
    this.playBeep(523.25, 0.08, 'sine', 0.05);
    setTimeout(() => {
      this.playBeep(659.25, 0.12, 'sine', 0.05);
    }, 90);
  }

  playClick() {
    if (!this.enabled) return;
    this.playBeep(700, 0.03, 'sine', 0.03);
  }

  playAlert() {
    if (!this.enabled) return;
    this.playBeep(440, 0.1, 'triangle', 0.06);
  }
}

export const sounds = new SoundEffects();
