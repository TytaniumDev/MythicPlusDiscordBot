import { WheelEntry } from './types';
import { audio } from './audio';

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff9800',
];

function desaturate(hex: string, amount = 0.6): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = r * 0.3 + g * 0.59 + b * 0.11;
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `rgb(${nr},${ng},${nb})`;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class Wheel {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resultEl: HTMLElement;
  private entries: WheelEntry[] = [];
  private rotation = 0;
  private animationFrame: number | null = null;
  private initialLabel: string;

  constructor(canvasId: string, resultId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resultEl = document.getElementById(resultId) as HTMLElement;
    this.initialLabel = this.canvas.getAttribute('aria-label') || 'Wheel';
  }

  /** Set up the wheel with a new list of candidates */
  init(entries: WheelEntry[]) {
    this.entries = entries;
    this.rotation = Math.random() * Math.PI * 2; // Random start position
    this.resultEl.textContent = '';
    this.resultEl.className = 'wheel-result';

    // Accessibility: Update label with count
    this.canvas.setAttribute('aria-label', `${this.initialLabel} with ${this.entries.length} candidates`);

    this.resizeCanvas();
    this.draw();
  }

  /** Clear result text */
  clearResult() {
    this.resultEl.textContent = '';
    this.resultEl.className = 'wheel-result';
  }

  /** Match canvas internal size to its CSS display size for sharp rendering */
  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.round(rect.width);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Draw the current state of the wheel */
  draw() {
    const size = this.canvas.getBoundingClientRect().width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = cx - 6;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.entries.length === 0) {
      // Empty wheel
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(245,158,11,0.3)';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
      this.ctx.font = `bold ${Math.round(size * 0.07)}px system-ui, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('No candidates', cx, cy);
      return;
    }

    const sliceAngle = (Math.PI * 2) / this.entries.length;

    // Draw segments
    this.entries.forEach((entry, i) => {
      const startAngle = this.rotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const color = COLORS[i % COLORS.length];

      // Segment fill
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.arc(cx, cy, radius, startAngle, endAngle);
      this.ctx.closePath();
      this.ctx.fillStyle = entry.isOffspec ? desaturate(color) : color;
      this.ctx.fill();

      // Segment border
      this.ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Text
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(startAngle + sliceAngle / 2);
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'white';
      this.ctx.shadowColor = 'rgba(0,0,0,0.7)';
      this.ctx.shadowBlur = 3;

      const fontSize = Math.max(10, Math.min(14, Math.round(size * 0.055)));
      this.ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

      let name = entry.name;
      if (name.length > 12) name = name.substring(0, 11) + '..';

      this.ctx.fillText(name, radius - 12, 0);
      this.ctx.restore();
    });

    // Outer ring glow
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = 'rgba(245,158,11,0.4)';
    this.ctx.shadowBlur = 8;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Center hub
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, Math.max(12, size * 0.06), 0, Math.PI * 2);
    this.ctx.fillStyle = '#16162a';
    this.ctx.fill();
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();
  }

  /** Animate the wheel to land on a specific winner */
  spinTo(winnerName: string, duration = 4000): Promise<string> {
    return new Promise((resolve) => {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
      }

      if (this.entries.length === 0) {
        this.resultEl.textContent = winnerName;
        resolve(winnerName);
        return;
      }

      const winnerIndex = this.entries.findIndex(e => e.name === winnerName);
      if (winnerIndex === -1) {
        this.resultEl.textContent = winnerName;
        resolve(winnerName);
        return;
      }

      const sliceAngle = (Math.PI * 2) / this.entries.length;

      // Target: winner at top (12 o'clock, which is -PI/2)
      // Pointer is at top, so the segment at angle -PI/2 from rotation is the winner
      const targetAngle = -(winnerIndex * sliceAngle + sliceAngle / 2) - Math.PI / 2;

      // Add many full rotations for visual spin effect
      const fullRotations = Math.PI * 2 * (8 + Math.random() * 4);
      const finalRotation = targetAngle + fullRotations;

      const startRotation = this.rotation;
      const startTime = performance.now();
      let lastTickRotation = startRotation;

      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        this.rotation = startRotation + (finalRotation - startRotation) * eased;

        // Tick sound when crossing segment boundaries
        const segmentsCrossed = Math.abs(this.rotation - lastTickRotation) / sliceAngle;
        if (segmentsCrossed >= 1) {
          audio.tick();
          lastTickRotation = this.rotation;
        }

        this.draw();

        if (progress < 1) {
          this.animationFrame = requestAnimationFrame(animate);
        } else {
          this.animationFrame = null;
          audio.land();
          // Show result with animation class
          this.resultEl.textContent = winnerName;
          this.resultEl.classList.add('revealed');
          resolve(winnerName);
        }
      };

      this.animationFrame = requestAnimationFrame(animate);
    });
  }

  /** Draw static wheel without animation (for testing) */
  drawStatic() {
    this.draw();
  }
}
