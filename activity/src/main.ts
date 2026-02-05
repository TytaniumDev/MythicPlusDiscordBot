import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Session, WoWPlayer, WoWGroup } from './types';
import { Wheel } from './wheel';
import './style.css'; // Assume we will move style.css here or import it

// UI Elements
const appDiv = document.getElementById('app') as HTMLDivElement;
const lobbyDiv = document.getElementById('lobby') as HTMLDivElement;
const wheelDiv = document.getElementById('wheel-container') as HTMLDivElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const playerList = document.getElementById('player-list') as HTMLUListElement;
const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement;
const statusMsg = document.getElementById('status-message') as HTMLDivElement;
const groupResults = document.getElementById('group-results') as HTMLDivElement;
const formedGroupsPanel = document.getElementById('formed-groups-panel') as HTMLDivElement;
const formedGroupsList = document.getElementById('formed-groups-list') as HTMLDivElement;

// Wheels
let wheelTank: Wheel | null = null;
let wheelHealer: Wheel | null = null;
let wheelDps: Wheel | null = null;

// State
let currentSessionId: string | null = null;
let currentSessionData: Session | null = null;
let unsubscribe: (() => void) | null = null;
let spinSequenceStarted = false;

// Initialize
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  currentSessionId = urlParams.get('sessionId');

  if (!currentSessionId) {
    statusMsg.innerText = "No Session ID found. Please use the /activity command.";
    return;
  }

  // Subscribe to Session
  const docRef = doc(db, 'sessions', currentSessionId);
  unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as Session;
      handleSessionUpdate(data);
    } else {
      statusMsg.innerText = "Activity ended.";
      if (appDiv) {
        const hint = document.createElement('p');
        hint.className = 'activity-ended-hint';
        hint.innerText = "Use /activity in Discord to start a new one.";
        hint.style.marginTop = "10px";
        hint.style.color = "#aaa";
        if (!appDiv.querySelector('.activity-ended-hint')) {
          appDiv.appendChild(hint);
        }
      }
    }
  }, (error) => {
    console.error(error);
    statusMsg.innerText = "Activity ended.";
  });

  // Setup Wheels
  wheelTank = new Wheel('wheel-tank', 'result-tank', 'tank-wrapper');
  wheelHealer = new Wheel('wheel-healer', 'result-healer', 'healer-wrapper');
  wheelDps = new Wheel('wheel-dps', 'result-dps', 'dps-wrapper');

  spinBtn.addEventListener('click', requestSpin);
}

function handleSessionUpdate(data: Session) {
  currentSessionData = data;

  // 1. Render Lobby (Always show who is here)
  renderLobby(data.players);

  // 2. Handle State
  switch (data.status) {
    case 'lobby':
      showLobby();
      break;
    case 'request_spin':
      spinBtn.disabled = true;
      spinBtn.innerText = "Calculating...";
      break;
    case 'spinning':
      spinBtn.disabled = true;
      spinBtn.innerText = "Spinning...";
      if (!spinSequenceStarted && data.groups && data.groups.length > 0) {
        spinSequenceStarted = true;
        startSpinSequence(data.groups);
      }
      break;
    case 'completed':
      showResults(data.groups);
      break;
  }
}

function renderLobby(players: WoWPlayer[]) {
  playerList.innerHTML = '';
  if (!players || players.length === 0) {
    playerList.innerHTML = '<li>Waiting for players...</li>';
    return;
  }

  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${getRoleString(p)})`;
    playerList.appendChild(li);
  });
}

function getRoleString(p: WoWPlayer) {
  const roles = [];
  if (p.roles.tankMain) roles.push("Tank");
  if (p.roles.healerMain) roles.push("Healer");
  if (p.roles.dpsMain) roles.push("DPS");
  return roles.join(", ");
}

function showLobby() {
  lobbyDiv.classList.remove('hidden');
  wheelDiv.classList.add('hidden');
  resultsDiv.classList.add('hidden');
  formedGroupsPanel.classList.add('hidden');
  formedGroupsList.innerHTML = '';
  spinBtn.disabled = false;
  spinBtn.innerText = "SPIN THE WHEEL!";
}

async function requestSpin() {
  if (!currentSessionId) return;
  spinBtn.disabled = true;

  // Update status to request_spin
  const docRef = doc(db, 'sessions', currentSessionId);
  await updateDoc(docRef, { status: 'request_spin' });
}

function appendFormedGroupCard(group: WoWGroup, index: number) {
  const div = document.createElement('div');
  div.className = 'group-card';
  div.innerHTML = `
    <h3>Group ${index + 1}</h3>
    <p><strong>Tank:</strong> ${group.tank?.name || 'None'}</p>
    <p><strong>Healer:</strong> ${group.healer?.name || 'None'}</p>
    <p><strong>DPS:</strong> ${group.dps.map((p) => p.name).join(', ')}</p>
  `;
  formedGroupsList.appendChild(div);
}

async function startSpinSequence(groups: WoWGroup[]) {
  // Switch to Wheel View
  lobbyDiv.classList.add('hidden');
  wheelDiv.classList.remove('hidden');

  // Show and clear formed groups panel
  formedGroupsList.innerHTML = '';
  formedGroupsPanel.classList.remove('hidden');

  // Initialize Wheels with all candidates
  // We need to reconstruct the candidate pools from the full player list in the session
  // But wait, the wheel logic needs to remove winners as we go.
  // Let's iterate through groups.

  const players = currentSessionData?.players || [];
  let poolTanks = players.filter(p => p.roles.tankMain || p.roles.offtank).map(p => p.name);
  let poolHealers = players.filter(p => p.roles.healerMain || p.roles.offhealer).map(p => p.name);
  let poolDps = players.filter(p => p.roles.dpsMain || p.roles.offdps).map(p => p.name);

  // Initialize Wheels initially
  wheelTank?.init(poolTanks);
  wheelHealer?.init(poolHealers);
  wheelDps?.init(poolDps);

  // Animate Group by Group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    statusMsg.innerText = `Spinning for Group ${i + 1}...`;

    // Tank
    if (group.tank) {
       await wheelTank?.spinTo(group.tank.name);
       // Remove from pools
       poolTanks = poolTanks.filter(n => n !== group.tank?.name);
       poolHealers = poolHealers.filter(n => n !== group.tank?.name);
       poolDps = poolDps.filter(n => n !== group.tank?.name);
       // Update other wheels to reflect removal?
       // Only if we want to show dwindling pools.
    }

    // Healer
    if (group.healer) {
       await wheelHealer?.spinTo(group.healer.name);
       poolTanks = poolTanks.filter(n => n !== group.healer?.name);
       poolHealers = poolHealers.filter(n => n !== group.healer?.name);
       poolDps = poolDps.filter(n => n !== group.healer?.name);
    }

    // DPS
    for (const dps of group.dps) {
        // Re-init DPS wheel to ensure taken players are gone?
        wheelDps?.init(poolDps);

        await wheelDps?.spinTo(dps.name);
        poolTanks = poolTanks.filter(n => n !== dps.name);
        poolHealers = poolHealers.filter(n => n !== dps.name);
        poolDps = poolDps.filter(n => n !== dps.name);

        // Brief pause
        await new Promise(r => setTimeout(r, 1000));
    }

    // Show Group Result and add to formed groups panel
    statusMsg.innerText = `Group ${i + 1} Formed!`;
    appendFormedGroupCard(group, i);
    await new Promise(r => setTimeout(r, 2000));
  }

  // Done
  if (currentSessionId) {
      const docRef = doc(db, 'sessions', currentSessionId);
      await updateDoc(docRef, { status: 'completed' });
  }
}

function showResults(groups: WoWGroup[]) {
  wheelDiv.classList.add('hidden');
  resultsDiv.classList.remove('hidden');
  spinBtn.classList.add('hidden'); // Hide button
  statusMsg.innerText = "All Groups Formed!";

  groupResults.innerHTML = '';
  groups.forEach((g, i) => {
    const div = document.createElement('div');
    div.className = 'group-card';
    div.innerHTML = `
      <h3>Group ${i + 1}</h3>
      <p><strong>Tank:</strong> ${g.tank?.name || 'None'}</p>
      <p><strong>Healer:</strong> ${g.healer?.name || 'None'}</p>
      <p><strong>DPS:</strong> ${g.dps.map(p => p.name).join(', ')}</p>
    `;
    groupResults.appendChild(div);
  });
}

init();
