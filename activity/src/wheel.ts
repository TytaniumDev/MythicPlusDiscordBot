import { WheelEntry } from './types';

const COLORS = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#1abc9c', '#34495e'
];

function desaturate(color: string, amount: number = 0.7): string {
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);

    const gray = r * 0.3 + g * 0.59 + b * 0.11;

    const newR = Math.round(r + (gray - r) * amount);
    const newG = Math.round(g + (gray - g) * amount);
    const newB = Math.round(b + (gray - b) * amount);

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

function easeOutCubic(t: number, b: number, c: number, d: number): number {
    t /= d;
    t--;
    return c * (t * t * t + 1) + b;
}

export class Wheel {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    resultDiv: HTMLElement;
    wrapper: HTMLElement;
    entries: WheelEntry[] = [];
    arc: number = 0;
    startAngle: number = 0;
    animationFrame: number | null = null;
    isSpinning: boolean = false;

    constructor(canvasId: string, resultId: string, wrapperId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.resultDiv = document.getElementById(resultId) as HTMLElement;
        this.wrapper = document.getElementById(wrapperId) as HTMLElement;
    }

    init(entries: WheelEntry[]) {
        this.entries = entries;
        this.resultDiv.innerText = "";

        if (this.entries.length === 0) {
            // keep visible but empty? or hidden?
            // Existing logic hid it.
             // this.wrapper.classList.add('hidden');
             // But if we hide it, we can't spin "nothing".
        } else {
             this.wrapper.classList.remove('hidden');
        }

        this.arc = Math.PI / (this.entries.length / 2);
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const outsideRadius = width * 0.4;
        const textRadius = width * 0.32;
        const insideRadius = 0;

        this.ctx.clearRect(0, 0, width, height);
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 14px Helvetica, Arial';

        if (this.entries.length === 0) return;

        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];
            const angle = this.startAngle + i * this.arc;
            let color = COLORS[i % COLORS.length];
            if (entry.isOffspec) {
                color = desaturate(color);
            }
            this.ctx.fillStyle = color;

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, outsideRadius, angle, angle + this.arc, false);
            this.ctx.arc(cx, cy, insideRadius, angle + this.arc, angle, true);
            this.ctx.stroke();
            this.ctx.fill();

            this.ctx.save();
            this.ctx.fillStyle = "white";
            this.ctx.translate(cx + Math.cos(angle + this.arc / 2) * textRadius,
                               cy + Math.sin(angle + this.arc / 2) * textRadius);
            this.ctx.rotate(angle + this.arc / 2 + Math.PI / 2);
            const text = this.entries[i].name;
            let displayText = text;
            if (displayText.length > 12) displayText = displayText.substring(0, 10) + "..";
            this.ctx.fillText(displayText, -this.ctx.measureText(displayText).width / 2, 0);
            this.ctx.restore();
        }
    }

    spinTo(winnerName: string, duration: number = 4000): Promise<void> {
        return new Promise((resolve) => {
            const winnerIndex = this.entries.findIndex(e => e.name === winnerName);
            if (this.entries.length === 0 || winnerIndex === -1) {
                this.resultDiv.innerText = winnerName;
                resolve();
                return;
            }

            this.isSpinning = true;
            let currentAngle = this.startAngle;

            // Calculate target
            const targetRotation = (3 * Math.PI / 2) - (winnerIndex * this.arc + this.arc / 2);

            let finalAngle = targetRotation;
            while (finalAngle < currentAngle + Math.PI * 10) {
                finalAngle += Math.PI * 2;
            }

            const startTime = performance.now();
            const startVal = currentAngle;
            const changeVal = finalAngle - currentAngle;

            const animate = (time: number) => {
                const elapsed = time - startTime;
                if (elapsed < duration) {
                    this.startAngle = easeOutCubic(elapsed, startVal, changeVal, duration);
                    this.draw();
                    this.animationFrame = requestAnimationFrame(animate);
                } else {
                    this.startAngle = finalAngle;
                    this.draw();
                    this.isSpinning = false;
                    this.resultDiv.innerText = winnerName;
                    resolve();
                }
            };
            this.animationFrame = requestAnimationFrame(animate);
        });
    }
}
