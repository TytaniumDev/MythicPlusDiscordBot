const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spin');
const resultDiv = document.getElementById('result');

const colors = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#1abc9c', '#34495e'
];

let names = ['Tank', 'Healer', 'DPS 1', 'DPS 2', 'DPS 3', 'Brez', 'Lust', 'Bench'];

// Parse names from URL if available
const urlParams = new URLSearchParams(window.location.search);
const namesParam = urlParams.get('names');
if (namesParam) {
    names = namesParam.split(',').map(n => n.trim());
}

let startAngle = 0;
const arc = Math.PI / (names.length / 2);
let spinTimeout = null;

let spinAngleStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;

function drawWheel() {
    ctx.clearRect(0, 0, 500, 500);
    const outsideRadius = 200;
    const textRadius = 160;
    const insideRadius = 0;

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.font = 'bold 16px Helvetica, Arial';

    for (let i = 0; i < names.length; i++) {
        const angle = startAngle + i * arc;
        ctx.fillStyle = colors[i % colors.length];

        ctx.beginPath();
        ctx.arc(250, 250, outsideRadius, angle, angle + arc, false);
        ctx.arc(250, 250, insideRadius, angle + arc, angle, true);
        ctx.stroke();
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "white";
        ctx.translate(250 + Math.cos(angle + arc / 2) * textRadius,
            250 + Math.sin(angle + arc / 2) * textRadius);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        const text = names[i];
        ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
        ctx.restore();
    }
}

function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }
    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawWheel();
    spinTimeout = setTimeout(rotateWheel, 30);
}

function stopRotateWheel() {
    clearTimeout(spinTimeout);
    const degrees = startAngle * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - degrees % 360) / arcd);
    resultDiv.innerHTML = "Result: " + names[index];
}

function easeOut(t, b, c, d) {
    const ts = (t /= d) * t;
    const tc = ts * t;
    return b + c * (tc + -3 * ts + 3 * t);
}

spinBtn.addEventListener('click', () => {
    if (spinTimeout) return;
    resultDiv.innerHTML = "Spinning...";
    spinAngleStart = Math.random() * 10 + 10;
    spinTime = 0;
    spinTimeTotal = Math.random() * 3000 + 4000;
    rotateWheel();
});

drawWheel();
