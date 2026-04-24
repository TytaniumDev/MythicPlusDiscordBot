/** Web Audio API sound effects for the wheel spinner */
class AudioManager {
  private ctx: AudioContext | null = null;
  private lastTickTime = 0;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Resume if suspended (browsers require user gesture)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Warm the AudioContext from within a user-gesture call stack so that
   * sounds scheduled later via setTimeout (which lose gesture activation)
   * still play. Safe to call repeatedly.
   */
  prepare() {
    this.getContext();
  }

  /** Short click/pop when wheel crosses a segment boundary */
  tick() {
    const now = performance.now();
    if (now - this.lastTickTime < 30) return;
    this.lastTickTime = now;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = 600 + Math.random() * 400;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // intentional: audio failures are ignorable — user can't act on them
      // and the wheel should keep working without sound. Not worth surfacing.
      void 0;
    }
  }

  /** Ascending chord when a group is fully formed */
  victory() {
    try {
      const ctx = this.getContext();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = freq;
        osc.type = 'sine';

        const startTime = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch {
      // intentional: audio failures are ignorable — user can't act on them
      // and the wheel should keep working without sound. Not worth surfacing.
      void 0;
    }
  }

  /** Swoosh sound for individual wheel landing */
  land() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = 400;
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // intentional: audio failures are ignorable — user can't act on them
      // and the wheel should keep working without sound. Not worth surfacing.
      void 0;
    }
  }
}

export const audio = new AudioManager();
