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

function darken(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `rgb(${nr},${ng},${nb})`;
}

function lighten(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
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
  private resizeObserver: ResizeObserver;
  private pendingResize = false;
  private baseLabel: string;
  private highlightIndex: number | null = null;

  constructor(canvasId: string, resultId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resultEl = document.getElementById(resultId) as HTMLElement;

    this.baseLabel = this.canvas.getAttribute('aria-label') || 'Wheel';
    this.canvas.setAttribute('role', 'img');

    // Watch for size changes on the wheel-frame parent
    const frame = this.canvas.closest('.wheel-frame');
    this.resizeObserver = new ResizeObserver(() => {
      if (this.pendingResize) return;
      this.pendingResize = true;
      requestAnimationFrame(() => {
        this.pendingResize = false;
        this.resizeCanvas();
        // Only redraw if not currently animating (animation drives its own render loop)
        if (!this.animationFrame) {
          this.draw();
        }
      });
    });
    if (frame) {
      this.resizeObserver.observe(frame);
    }
  }

  /** Set up the wheel with a new list of candidates */
  init(entries: WheelEntry[]) {
    this.entries = entries;
    this.rotation = Math.random() * Math.PI * 2; // Random start position
    this.highlightIndex = null;
    this.resultEl.textContent = '';
    this.resultEl.className = 'wheel-result';
    this.canvas.setAttribute('aria-label', `${this.baseLabel}. ${this.entries.length} candidates.`);
    this.resizeCanvas();
    this.draw();
  }

  /** Clear result text */
  clearResult() {
    this.resultEl.textContent = '';
    this.resultEl.className = 'wheel-result';
  }

  /** Force a redraw (call after layout transitions) */
  forceRedraw() {
    this.resizeCanvas();
    this.draw();
  }

  /** Match canvas internal size to its CSS display size for sharp rendering */
  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.round(rect.width);
    if (size === 0) return; // Not visible yet
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Draw the current state of the wheel */
  draw() {
    const size = this.canvas.getBoundingClientRect().width;
    if (size === 0) return;
    const cx = size / 2;
    const cy = size / 2;
    const radius = cx - size * 0.03;
    const hubRadius = Math.max(6, size * 0.025);

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

      // Segment fill with radial gradient
      const grad = this.ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
      grad.addColorStop(0, lighten(color, 0.2));
      grad.addColorStop(1, entry.isOffspec ? desaturate(color) : darken(color, 0.15));

      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.arc(cx, cy, radius, startAngle, endAngle);
      this.ctx.closePath();
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Segment border
      this.ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      this.ctx.lineWidth = Math.max(1.5, size * 0.007);
      this.ctx.stroke();

      // Text
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(startAngle + sliceAngle / 2);
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'white';
      this.ctx.shadowColor = 'rgba(0,0,0,0.9)';
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;
      this.ctx.shadowBlur = Math.max(4, size * 0.015);

      const entryScale = Math.min(1, Math.sqrt(6 / this.entries.length));
      const fontSize = Math.max(10, Math.min(24, Math.round(size * 0.06 * entryScale)));
      this.ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

      let name = entry.name;
      if (name.length > 12) name = name.substring(0, 11) + '..';

      const textInset = size * (this.entries.length > 8 ? 0.05 : 0.08);
      const maxTextWidth = radius - textInset - hubRadius - size * 0.04;
      this.ctx.fillText(name, radius - textInset, 0, maxTextWidth);
      this.ctx.restore();
    });

    // Reset shadow before highlight / ring drawing
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Highlight the winning slice: fade losers and glow the winner
    if (this.highlightIndex !== null) {
      const hi = this.highlightIndex;

      // Darken every non-winning slice
      this.entries.forEach((_, i) => {
        if (i === hi) return;
        const sStart = this.rotation + i * sliceAngle;
        const sEnd = sStart + sliceAngle;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.arc(cx, cy, radius - 1, sStart, sEnd);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fill();
      });

      const hStart = this.rotation + hi * sliceAngle;
      const hEnd = hStart + sliceAngle;

      // Bright white overlay on winner for a "pop" effect
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.arc(cx, cy, radius - 1, hStart, hEnd);
      this.ctx.closePath();
      this.ctx.fillStyle = 'rgba(255,255,255,0.22)';
      this.ctx.fill();

      // Gold glow border around the winning slice
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(245,158,11,0.9)';
      this.ctx.shadowBlur = Math.max(12, size * 0.04);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = Math.max(3, size * 0.014);

      // Draw the two radial edges of the slice
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(
        cx + Math.cos(hStart) * radius,
        cy + Math.sin(hStart) * radius,
      );
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(
        cx + Math.cos(hEnd) * radius,
        cy + Math.sin(hEnd) * radius,
      );
      this.ctx.stroke();

      // Draw the outer arc edge of the slice
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius - 1, hStart, hEnd);
      this.ctx.stroke();

      this.ctx.restore();
    }

    // Double-stroke outer ring: dark base + gold accent with glow
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = Math.max(5, size * 0.02);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = Math.max(2.5, size * 0.01);
    this.ctx.shadowColor = 'rgba(245,158,11,0.5)';
    this.ctx.shadowBlur = 10;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';

    // Center hub with radial gradient
    const hubGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, hubRadius);
    hubGrad.addColorStop(0, '#2d1b69');
    hubGrad.addColorStop(1, '#0d0d1a');

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = hubGrad;
    this.ctx.fill();
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = Math.max(2.5, size * 0.01);
    this.ctx.shadowColor = 'rgba(245,158,11,0.4)';
    this.ctx.shadowBlur = 6;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';
  }

  /** Animate the wheel to land on a specific winner */
  spinTo(winnerName: string, duration = 4000): Promise<string> {
    this.canvas.setAttribute('aria-label', `${this.baseLabel}. Spinning...`);
    this.highlightIndex = null;
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
      const fullRotations = Math.PI * 2 * (8 + Math.floor(Math.random() * 4));
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
          this.highlightIndex = winnerIndex;
          this.draw(); // Redraw with highlight
          audio.land();
          // Show result with animation class
          this.resultEl.textContent = winnerName;
          this.resultEl.classList.add('revealed');
          this.canvas.setAttribute('aria-label', `${this.baseLabel}. Result: ${winnerName}`);
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
