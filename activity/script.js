const COLORS = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#1abc9c', '#34495e'
];

// Utility: Ease Out Cubic
// t: current time, b: start value, c: change in value, d: duration
function easeOutCubic(t, b, c, d) {
    t /= d;
    t--;
    return c * (t * t * t + 1) + b;
}

class Wheel {
    constructor(canvasId, resultId, wrapperId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resultDiv = document.getElementById(resultId);
        this.wrapper = document.getElementById(wrapperId);

        this.names = [];
        this.arc = 0;
        this.startAngle = 0; // Radians

        this.animationFrame = null;
        this.isSpinning = false;
    }

    // Initialize/Update the wheel with names
    init(names) {
        this.names = names;
        this.resultDiv.innerText = "";

        if (this.names.length === 0) {
            this.wrapper.classList.add('hidden');
            return;
        } else {
            this.wrapper.classList.remove('hidden');
        }

        this.arc = Math.PI / (names.length / 2);
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

        for (let i = 0; i < this.names.length; i++) {
            const angle = this.startAngle + i * this.arc;
            this.ctx.fillStyle = COLORS[i % COLORS.length];

            // Explicitly handle the single-player case to ensure a visible circle is drawn
            let endAngle = angle + this.arc;
            if (this.names.length === 1) {
                endAngle = angle + 2 * Math.PI - 0.0001;
            }

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, outsideRadius, angle, endAngle, false);
            this.ctx.arc(cx, cy, insideRadius, endAngle, angle, true);
            this.ctx.stroke();
            this.ctx.fill();

            this.ctx.save();
            this.ctx.fillStyle = "white";
            const textAngle = (this.names.length === 1) ? angle + Math.PI : angle + this.arc / 2;
            this.ctx.translate(cx + Math.cos(textAngle) * textRadius,
                               cy + Math.sin(textAngle) * textRadius);
            this.ctx.rotate(textAngle + Math.PI / 2);
            const text = this.names[i];
            // Truncate text if too long
            let displayText = text;
            if (displayText.length > 12) displayText = displayText.substring(0, 10) + "..";
            this.ctx.fillText(displayText, -this.ctx.measureText(displayText).width / 2, 0);
            this.ctx.restore();
        }
    }

    spinTo(winnerName, duration = 4000) {
        return new Promise((resolve) => {
            if (this.names.length === 0 || !this.names.includes(winnerName)) {
                // If winner not in list (edge case), just resolve
                this.resultDiv.innerText = winnerName;
                resolve();
                return;
            }

            this.isSpinning = true;
            const winnerIndex = this.names.indexOf(winnerName);

            // Calculate target angle
            // The pointer is at 270 degrees (3*PI/2)
            // We want the center of the winner slice to be at 3*PI/2
            // center_slice = startAngle + index*arc + arc/2
            // 3*PI/2 = startAngle_final + index*arc + arc/2
            // startAngle_final = 3*PI/2 - (index*arc + arc/2)

            let currentAngle = this.startAngle;
            const targetRotation = (3 * Math.PI / 2) - (winnerIndex * this.arc + this.arc / 2);

            // Add extra rotations (min 5)
            // We need to find delta such that current + delta = targetRotation (mod 2PI)
            // Actually simpler: just set target to targetRotation + K * 2PI where K is large enough
            // to be > currentAngle

            let finalAngle = targetRotation;
            while (finalAngle < currentAngle + Math.PI * 10) { // Ensure at least 5 rotations
                finalAngle += Math.PI * 2;
            }

            const startTime = performance.now();
            const startVal = currentAngle;
            const changeVal = finalAngle - currentAngle;

            const animate = (time) => {
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

// --- APP LOGIC ---

// State
let appData = null;
let currentGroupIndex = 0;
let candidatePools = {
    tanks: [],
    healers: [],
    dps: []
};

// UI Elements
const groupIndicator = document.getElementById('group-indicator');
const nextBtn = document.getElementById('next-btn');
const prevBtn = document.getElementById('prev-btn');
const spinBtn = document.getElementById('spin-btn');
const statusMsg = document.getElementById('status-message');

// Wheels
const wheelTank = new Wheel('wheel-tank', 'result-tank', 'tank-wrapper');
const wheelHealer = new Wheel('wheel-healer', 'result-healer', 'healer-wrapper');
const wheelDps = new Wheel('wheel-dps', 'result-dps', 'dps-wrapper');

function init() {
    // 1. Parse Data
    const urlParams = new URLSearchParams(window.location.search);
    const dataStr = urlParams.get('data');

    if (!dataStr) {
        statusMsg.innerText = "No data found in URL. Please use the /activity command.";
        return;
    }

    try {
        const bytes = Uint8Array.from(atob(dataStr), c => c.charCodeAt(0));
        const jsonStr = new TextDecoder().decode(bytes);
        appData = JSON.parse(jsonStr);

        // Init Pools (Clone them)
        candidatePools.tanks = [...appData.candidates.tanks];
        candidatePools.healers = [...appData.candidates.healers];
        candidatePools.dps = [...appData.candidates.dps];

        // Initial Render
        renderGroup(0);

    } catch (e) {
        console.error(e);
        statusMsg.innerText = "Error parsing data.";
    }
}

function renderGroup(index) {
    if (!appData || !appData.groups[index]) return;

    currentGroupIndex = index;
    const group = appData.groups[index];

    // Update UI
    groupIndicator.innerText = `Group ${index + 1} of ${appData.groups.length}`;

    // Navigation Buttons
    prevBtn.classList.toggle('hidden', index === 0);
    nextBtn.classList.toggle('hidden', index === appData.groups.length - 1);

    // Reset Spin Button if viewing a new group?
    // Actually, we want to see the state.
    // If we've already spun this group, show results?
    // Complex. For now, we'll just re-init the wheels with CURRENT pools.
    // WARNING: If we spin Group 1, candidates are removed.
    // If we go BACK to Group 1, we can't really "re-spin".
    // AND the wheels shouldn't change.

    // Simplified Logic:
    // This tool is for a linear reveal.
    // "Cycling through groups" -> 1 -> 2 -> 3.
    // If you go back, you just see the empty wheels?
    // Or we just block navigation until spin is done?

    // Let's assume linear progression.
    // But we need to Populate wheels with *current* pools.

    wheelTank.init(candidatePools.tanks);
    wheelHealer.init(candidatePools.healers);
    wheelDps.init(candidatePools.dps);

    spinBtn.disabled = false;
    spinBtn.innerText = "SPIN GROUP " + (index + 1) + "!";
    statusMsg.innerText = "";
}

function removePlayerFromPools(name) {
    if (!name) return;
    candidatePools.tanks = candidatePools.tanks.filter(n => n !== name);
    candidatePools.healers = candidatePools.healers.filter(n => n !== name);
    candidatePools.dps = candidatePools.dps.filter(n => n !== name);
}

spinBtn.addEventListener('click', async () => {
    if (!appData) return;

    const group = appData.groups[currentGroupIndex];
    spinBtn.disabled = true;

    // Execute Spins in Parallel (Tank, Healer) + DPS Sequence

    const promises = [];

    // Tank
    if (group.tank) {
        promises.push(
            wheelTank.spinTo(group.tank).then(() => {
                removePlayerFromPools(group.tank);
            })
        );
    }

    // Healer
    if (group.healer) {
        promises.push(
            wheelHealer.spinTo(group.healer).then(() => {
                removePlayerFromPools(group.healer);
            })
        );
    }

    // DPS Sequence
    if (group.dps && group.dps.length > 0) {
        const dpsPromise = (async () => {
            // Wait a bit before starting DPS? Or start immediately?
            // Start immediately.

            for (const dpsName of group.dps) {
                // Ensure wheel is updated with latest removals from other spins?
                // Tank/Healer spins take 4s.
                // We want to update the wheel visually *between* DPS spins.

                // Spin 1
                await wheelDps.spinTo(dpsName, 4000);
                removePlayerFromPools(dpsName);

                // Wait briefly to show result
                await new Promise(r => setTimeout(r, 1000));

                // Re-init wheel to remove the winner visually
                wheelDps.init(candidatePools.dps);
            }
        })();
        promises.push(dpsPromise);
    }

    await Promise.all(promises);

    statusMsg.innerText = "Group Complete!";

    // Check if next group exists
    if (currentGroupIndex < appData.groups.length - 1) {
        spinBtn.innerText = "Next Group >";
        spinBtn.disabled = false;

        // Change button behavior to just go next?
        // Or unhide the actual next button?
        // Let's auto-advance or let user click Next Btn
        nextBtn.classList.remove('hidden');

        // Use the Main button as "Next"
        spinBtn.onclick = () => {
            // Restore original handler
            spinBtn.onclick = null; // Rebinds via addEventListener? No.
            // This is messy.
            // Better: Just show the Next arrow.
            spinBtn.style.display = 'none';
        };
    } else {
        spinBtn.innerText = "All Groups Done!";
    }
});

// Nav Buttons
nextBtn.addEventListener('click', () => {
    if (currentGroupIndex < appData.groups.length - 1) {
        renderGroup(currentGroupIndex + 1);
        spinBtn.style.display = 'inline-block'; // Show spin button again
    }
});

prevBtn.addEventListener('click', () => {
    if (currentGroupIndex > 0) {
        renderGroup(currentGroupIndex - 1);
        spinBtn.style.display = 'inline-block';
    }
});

// Start
init();
