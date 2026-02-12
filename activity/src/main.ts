import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Session, WoWPlayer, WoWGroup, VoiceChannel } from './types';
import { mockSession, mockPlayers, mockGroups } from './mockData';
import { Wheel } from './wheel';
import './style.css';

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
const demoControls = document.getElementById('demo-controls') as HTMLDivElement;
const startDemoBtn = document.getElementById('start-demo-btn') as HTMLButtonElement;
const newRoundBtn = document.getElementById('new-round-btn') as HTMLButtonElement;

// Wheels
let wheelTank: Wheel | null = null;
let wheelHealer: Wheel | null = null;
let wheelDps: Wheel | null = null;

// State
let currentSessionId: string | null = null;
let currentSessionData: Session | null = null;
let spinSequenceStarted = false;
let isDemoMode = false;

// Initialize
function init() {
  const urlParams = new URLSearchParams(window.location.search);

  // Setup Wheels
  wheelTank = new Wheel('wheel-tank', 'result-tank', 'tank-wrapper');
  wheelHealer = new Wheel('wheel-healer', 'result-healer', 'healer-wrapper');
  wheelDps = new Wheel('wheel-dps', 'result-dps', 'dps-wrapper');

  spinBtn.addEventListener('click', requestSpin);
  startDemoBtn.addEventListener('click', startDemo);
  newRoundBtn.addEventListener('click', startNewRound);

  // Check for Mock Data injection
  const dataParam = urlParams.get('data');
  if (dataParam) {
    try {
      const json = atob(dataParam);
      const data = JSON.parse(json);
      handleSessionUpdate(data);
      return; // Bypass Firebase
    } catch (e) {
      console.error("Invalid data param", e);
    }
  }

  // Support both guildId (new) and sessionId (legacy/alias)
  currentSessionId = urlParams.get('guildId') || urlParams.get('sessionId');

  if (!currentSessionId) {
    statusMsg.innerText = "No Guild/Session ID found. You can try the Demo below.";
    demoControls.classList.remove('hidden');
    return;
  }

  // Subscribe to Session
  const docRef = doc(db, 'sessions', currentSessionId);
  onSnapshot(docRef, (docSnap) => {
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
}

function handleSessionUpdate(data: Session) {
  currentSessionData = data;

  // 1. Render Lobby or Channel Picker
  renderLobby(data);

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

      // Check for static wheel mode (testing)
      if ((data as any).staticWheel) {
        prepareWheelView();
        initWheelsForGroup(data.players);
      } else {
        if (!spinSequenceStarted && data.groups && data.groups.length > 0) {
          spinSequenceStarted = true;
          startSpinSequence(data.groups);
        }
      }
      break;
    case 'completed':
      showResults(data.groups);
      break;
  }
}

function renderChannelPicker(channels: VoiceChannel[]) {
    playerList.innerHTML = '';

    if (!channels || channels.length === 0) {
        playerList.innerHTML = '<li>No voice channels found with users.</li>';
        return;
    }

    channels.forEach(ch => {
        const li = document.createElement('li');
        li.className = 'channel-picker-item';
        li.innerHTML = `
            <span>${ch.name}</span>
            <span class="channel-count">${ch.userCount} users</span>
        `;
        li.onclick = () => selectChannel(ch.id);
        playerList.appendChild(li);
    });
}

async function selectChannel(channelId: string) {
    if (isDemoMode && currentSessionData) {
        // Mock update
        const newData = { ...currentSessionData, selectedChannelId: channelId, players: mockPlayers } as Session;
        handleSessionUpdate(newData);
        return;
    }

    if (!currentSessionId) return;

    const docRef = doc(db, 'sessions', currentSessionId);
    await updateDoc(docRef, { selectedChannelId: channelId });
}

async function startNewRound() {
    if (isDemoMode && currentSessionData) {
        // Mock Reset
        const newData = {
            ...currentSessionData,
            status: 'lobby',
            selectedChannelId: null,
            groups: [],
            players: []
        } as Session;
        spinSequenceStarted = false;
        handleSessionUpdate(newData);
        return;
    }

    if (!currentSessionId) return;

    const docRef = doc(db, 'sessions', currentSessionId);
    await updateDoc(docRef, {
        status: 'lobby',
        selectedChannelId: null,
        groups: [],
        players: []
    });
    spinSequenceStarted = false;
}

function renderLobby(session: Session) {
  // If no channel selected, show picker
  if (!session.selectedChannelId) {
    renderChannelPicker(session.voiceChannels || []);
    spinBtn.disabled = true;
    spinBtn.innerText = "Select Channel";
    return;
  }

  const players = session.players;
  playerList.innerHTML = '';
  if (!players || players.length === 0) {
    playerList.innerHTML = '<li>Waiting for players...</li>';
    spinBtn.disabled = true; // Cannot spin without players
    return;
  } else {
     spinBtn.disabled = false;
     spinBtn.innerText = "SPIN THE WHEEL!";
  }

  // If request_spin, override button text/state
  if (session.status === 'request_spin') {
      spinBtn.disabled = true;
      spinBtn.innerText = "Calculating...";
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
  statusMsg.innerText = "";

  // Spin button state is handled in renderLobby based on player count/channel selection
}

function prepareWheelView() {
  // Switch to Wheel View
  lobbyDiv.classList.add('hidden');
  wheelDiv.classList.remove('hidden');

  // Show and clear formed groups panel
  formedGroupsList.innerHTML = '';
  formedGroupsPanel.classList.remove('hidden');
}

function getPools(players: WoWPlayer[]) {
  const poolTanks = players.filter(p => p.roles.tankMain || p.roles.offtank).map(p => ({
    name: p.name,
    isOffspec: !p.roles.tankMain
  }));
  const poolHealers = players.filter(p => p.roles.healerMain || p.roles.offhealer).map(p => ({
    name: p.name,
    isOffspec: !p.roles.healerMain
  }));
  const poolDps = players.filter(p => p.roles.dpsMain || p.roles.offdps).map(p => ({
    name: p.name,
    isOffspec: !p.roles.dpsMain
  }));
  return { poolTanks, poolHealers, poolDps };
}

function initWheelsForGroup(players: WoWPlayer[]) {
  const { poolTanks, poolHealers, poolDps } = getPools(players);
  wheelTank?.init(poolTanks);
  wheelHealer?.init(poolHealers);
  wheelDps?.init(poolDps);
}

function startDemo() {
  isDemoMode = true;
  demoControls.classList.add('hidden');
  statusMsg.innerText = "";
  handleSessionUpdate(mockSession);
}

async function requestSpin() {
  if (isDemoMode && currentSessionData) {
    spinBtn.disabled = true;

    // Simulate server processing: request_spin
    const calculatingData = { ...currentSessionData, status: 'request_spin' } as Session;
    handleSessionUpdate(calculatingData);

    // Simulate delay
    setTimeout(() => {
      // Transition to spinning, injecting mock groups
      const spinningData = {
          ...calculatingData,
          status: 'spinning',
          groups: mockGroups
      } as Session;
      handleSessionUpdate(spinningData);
    }, 1500);

    return;
  }

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
  prepareWheelView();

  // Initialize Wheels with all candidates
  const players = currentSessionData?.players || [];
  let { poolTanks, poolHealers, poolDps } = getPools(players);

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
       poolTanks = poolTanks.filter(e => e.name !== group.tank?.name);
       poolHealers = poolHealers.filter(e => e.name !== group.tank?.name);
       poolDps = poolDps.filter(e => e.name !== group.tank?.name);
    }

    // Healer
    if (group.healer) {
       await wheelHealer?.spinTo(group.healer.name);
       poolTanks = poolTanks.filter(e => e.name !== group.healer?.name);
       poolHealers = poolHealers.filter(e => e.name !== group.healer?.name);
       poolDps = poolDps.filter(e => e.name !== group.healer?.name);
    }

    // DPS
    for (const dps of group.dps) {
        // Re-init DPS wheel to ensure taken players are gone?
        wheelDps?.init(poolDps);

        await wheelDps?.spinTo(dps.name);
        poolTanks = poolTanks.filter(e => e.name !== dps.name);
        poolHealers = poolHealers.filter(e => e.name !== dps.name);
        poolDps = poolDps.filter(e => e.name !== dps.name);

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
  } else if (isDemoMode && currentSessionData) {
      const completedData = { ...currentSessionData, status: 'completed' } as Session;
      handleSessionUpdate(completedData);
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
