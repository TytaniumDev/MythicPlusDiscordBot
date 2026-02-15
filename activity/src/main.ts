import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Session, WoWPlayer, WoWGroup, VoiceChannel, WheelEntry } from './types';
import { mockSession, mockPlayers, mockGroups } from './mockData';
import { Wheel } from './wheel';
import { audio } from './audio';
import './style.css';

// ── UI Elements ──────────────────────────────────────────────
const statusMsg = document.getElementById('status-message') as HTMLDivElement;
const demoControls = document.getElementById('demo-controls') as HTMLDivElement;
const startDemoBtn = document.getElementById('start-demo-btn') as HTMLButtonElement;

// Views
const viewChannels = document.getElementById('view-channels') as HTMLElement;
const viewLobby = document.getElementById('view-lobby') as HTMLElement;
const viewWheels = document.getElementById('view-wheels') as HTMLElement;
const viewResults = document.getElementById('view-results') as HTMLElement;

// Channel picker
const channelList = document.getElementById('channel-list') as HTMLDivElement;

// Lobby
const playerList = document.getElementById('player-list') as HTMLDivElement;
const playerCount = document.getElementById('player-count') as HTMLSpanElement;
const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement;

// Wheels
const wheelStatus = document.getElementById('wheel-status') as HTMLDivElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;

// Side panel
const sidePanel = document.getElementById('side-panel') as HTMLElement;
const groupsList = document.getElementById('groups-list') as HTMLDivElement;

// Results
const finalGroups = document.getElementById('final-groups') as HTMLDivElement;
const newRoundBtn = document.getElementById('new-round-btn') as HTMLButtonElement;

// ── Wheels (5 total) ─────────────────────────────────────────
let wheelTank: Wheel | null = null;
let wheelHealer: Wheel | null = null;
let wheelDps1: Wheel | null = null;
let wheelDps2: Wheel | null = null;
let wheelDps3: Wheel | null = null;

// ── State ────────────────────────────────────────────────────
let currentSessionId: string | null = null;
let currentSessionData: Session | null = null;
let isDemoMode = false;

// Spin sequence state
let groups: WoWGroup[] = [];
let currentGroupIndex = 0;
let isAnimating = false;
let spinSequenceStarted = false;

// Candidate pools (filtered between groups)
let poolTanks: WheelEntry[] = [];
let poolHealers: WheelEntry[] = [];
let poolDps: WheelEntry[] = [];

// ── Initialization ───────────────────────────────────────────
function init() {
  const urlParams = new URLSearchParams(window.location.search);

  // Initialize wheels
  wheelTank = new Wheel('wheel-tank', 'result-tank');
  wheelHealer = new Wheel('wheel-healer', 'result-healer');
  wheelDps1 = new Wheel('wheel-dps1', 'result-dps1');
  wheelDps2 = new Wheel('wheel-dps2', 'result-dps2');
  wheelDps3 = new Wheel('wheel-dps3', 'result-dps3');

  // Event listeners
  spinBtn.addEventListener('click', requestSpin);
  nextBtn.addEventListener('click', spinForCurrentGroup);
  startDemoBtn.addEventListener('click', startDemo);
  newRoundBtn.addEventListener('click', startNewRound);

  // Check for injected mock data (testing)
  const dataParam = urlParams.get('data');
  if (dataParam) {
    try {
      const json = atob(dataParam);
      const data = JSON.parse(json);
      handleSessionUpdate(data);
      return;
    } catch (e) {
      console.error('Invalid data param', e);
    }
  }

  // Subscribe to Firebase
  currentSessionId = urlParams.get('guildId') || urlParams.get('sessionId');

  if (!currentSessionId) {
    statusMsg.textContent = 'No Guild/Session ID found. Try the Demo below.';
    demoControls.classList.remove('hidden');
    return;
  }

  const docRef = doc(db, 'sessions', currentSessionId);
  onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        handleSessionUpdate(docSnap.data() as Session);
      } else {
        statusMsg.textContent = 'Activity ended.';
      }
    },
    (error) => {
      console.error(error);
      statusMsg.textContent = 'Activity ended.';
    }
  );
}

// ── Session State Handler ────────────────────────────────────
function handleSessionUpdate(data: Session) {
  currentSessionData = data;

  switch (data.status) {
    case 'lobby':
      if (!data.selectedChannelId) {
        showView('channels');
        renderChannelPicker(data.voiceChannels || []);
      } else {
        showView('lobby');
        renderLobby(data.players);
      }
      break;

    case 'request_spin':
      // Stay on lobby view, disable button
      spinBtn.disabled = true;
      spinBtn.textContent = 'Calculating...';
      break;

    case 'spinning':
      if ((data as unknown as Record<string, unknown>).staticWheel) {
        // Static wheel mode for visual testing
        showView('wheels');
        sidePanel.classList.remove('hidden');
        initPools(data.players);
        initAllWheels();
        wheelStatus.textContent = 'Static preview';
        nextBtn.classList.add('hidden');
      } else if (!spinSequenceStarted && data.groups && data.groups.length > 0) {
        spinSequenceStarted = true;
        startSpinSequence(data.groups, data.players);
      }
      break;

    case 'completed':
      showResults(data.groups);
      break;
  }
}

// ── View Management ──────────────────────────────────────────
function showView(view: 'channels' | 'lobby' | 'wheels' | 'results') {
  viewChannels.classList.add('hidden');
  viewLobby.classList.add('hidden');
  viewWheels.classList.add('hidden');
  viewResults.classList.add('hidden');
  sidePanel.classList.add('hidden');
  statusMsg.textContent = '';

  switch (view) {
    case 'channels':
      viewChannels.classList.remove('hidden');
      break;
    case 'lobby':
      viewLobby.classList.remove('hidden');
      break;
    case 'wheels':
      viewWheels.classList.remove('hidden');
      break;
    case 'results':
      viewResults.classList.remove('hidden');
      break;
  }
}

// ── Channel Picker ───────────────────────────────────────────
function renderChannelPicker(channels: VoiceChannel[]) {
  channelList.innerHTML = '';

  if (!channels || channels.length === 0) {
    channelList.innerHTML =
      '<div style="text-align:center;color:var(--text-secondary)">No voice channels found with users.</div>';
    return;
  }

  channels.forEach((ch) => {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.innerHTML = `
      <span class="channel-name">${escapeHtml(ch.name)}</span>
      <span class="channel-count">${ch.userCount} users</span>
    `;
    card.onclick = () => selectChannel(ch.id);
    channelList.appendChild(card);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function selectChannel(channelId: string) {
  if (isDemoMode && currentSessionData) {
    handleSessionUpdate({
      ...currentSessionData,
      selectedChannelId: channelId,
      players: mockPlayers,
    } as Session);
    return;
  }

  if (!currentSessionId) return;
  const docRef = doc(db, 'sessions', currentSessionId);
  await updateDoc(docRef, { selectedChannelId: channelId });
}

// ── Lobby ────────────────────────────────────────────────────
function renderLobby(players: WoWPlayer[]) {
  playerList.innerHTML = '';

  if (!players || players.length === 0) {
    playerList.innerHTML =
      '<div style="color:var(--text-secondary)">Waiting for players to join voice...</div>';
    playerCount.textContent = '';
    spinBtn.disabled = true;
    spinBtn.textContent = 'Waiting for players...';
    return;
  }

  playerCount.textContent = `${players.length} players`;
  spinBtn.disabled = false;
  spinBtn.textContent = 'SPIN THE WHEEL!';

  // Override if request_spin
  if (currentSessionData?.status === 'request_spin') {
    spinBtn.disabled = true;
    spinBtn.textContent = 'Calculating...';
  }

  players.forEach((p) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';

    const roleClass = getPrimaryRole(p);
    chip.innerHTML = `
      <span class="role-dot ${roleClass}"></span>
      <span>${escapeHtml(p.name)}</span>
    `;
    playerList.appendChild(chip);
  });
}

function getPrimaryRole(p: WoWPlayer): string {
  if (p.roles.tankMain) return 'tank';
  if (p.roles.healerMain) return 'healer';
  return 'dps';
}

// ── Spin Request ─────────────────────────────────────────────
async function requestSpin() {
  if (isDemoMode && currentSessionData) {
    spinBtn.disabled = true;
    const calculatingData = { ...currentSessionData, status: 'request_spin' } as Session;
    handleSessionUpdate(calculatingData);

    // Simulate bot processing
    setTimeout(() => {
      handleSessionUpdate({
        ...calculatingData,
        status: 'spinning',
        groups: mockGroups,
      } as Session);
    }, 1500);
    return;
  }

  if (!currentSessionId) return;
  spinBtn.disabled = true;
  const docRef = doc(db, 'sessions', currentSessionId);
  await updateDoc(docRef, { status: 'request_spin' });
}

// ── Spin Sequence ────────────────────────────────────────────
function startSpinSequence(sessionGroups: WoWGroup[], players: WoWPlayer[]) {
  groups = sessionGroups;
  currentGroupIndex = 0;
  isAnimating = false;

  showView('wheels');
  sidePanel.classList.remove('hidden');
  groupsList.innerHTML = '';

  // Build candidate pools
  initPools(players);
  initAllWheels();

  // Set up button for first group
  updateNextButton();
}

function initPools(players: WoWPlayer[]) {
  poolTanks = players
    .filter((p) => p.roles.tankMain || p.roles.offtank)
    .map((p) => ({ name: p.name, isOffspec: !p.roles.tankMain }));

  poolHealers = players
    .filter((p) => p.roles.healerMain || p.roles.offhealer)
    .map((p) => ({ name: p.name, isOffspec: !p.roles.healerMain }));

  poolDps = players
    .filter((p) => p.roles.dpsMain || p.roles.offdps)
    .map((p) => ({ name: p.name, isOffspec: !p.roles.dpsMain }));
}

function initAllWheels() {
  wheelTank?.init(poolTanks);
  wheelHealer?.init(poolHealers);
  wheelDps1?.init(poolDps);
  wheelDps2?.init(poolDps);
  wheelDps3?.init(poolDps);
}

function updateNextButton() {
  nextBtn.classList.remove('hidden');

  if (currentGroupIndex >= groups.length) {
    nextBtn.textContent = 'Finish';
    nextBtn.disabled = false;
    nextBtn.onclick = finishSpinSequence;
    return;
  }

  nextBtn.textContent = `Spin for Group ${currentGroupIndex + 1}`;
  nextBtn.disabled = false;
  nextBtn.onclick = spinForCurrentGroup;
}

async function spinForCurrentGroup() {
  if (isAnimating || currentGroupIndex >= groups.length) return;

  isAnimating = true;
  nextBtn.disabled = true;
  const group = groups[currentGroupIndex];
  wheelStatus.textContent = `Spinning for Group ${currentGroupIndex + 1}...`;

  // Add spinning class for glow animation
  document.querySelectorAll('.wheel-slot').forEach((el) => el.classList.add('spinning'));

  // Clear previous results
  wheelTank?.clearResult();
  wheelHealer?.clearResult();
  wheelDps1?.clearResult();
  wheelDps2?.clearResult();
  wheelDps3?.clearResult();

  // Re-init wheels with current pools
  wheelTank?.init(poolTanks);
  wheelHealer?.init(poolHealers);
  wheelDps1?.init(poolDps);
  wheelDps2?.init(poolDps);
  wheelDps3?.init(poolDps);

  // Spin all 5 wheels simultaneously with slightly staggered stop times
  const spinPromises: Promise<string>[] = [];

  if (group.tank) {
    spinPromises.push(wheelTank!.spinTo(group.tank.name, 4000));
  }
  if (group.healer) {
    spinPromises.push(wheelHealer!.spinTo(group.healer.name, 4000));
  }

  // DPS wheels with staggered durations for visual variety
  const dpsDurations = [4000, 4300, 4600];
  group.dps.forEach((dpsPlayer, i) => {
    const wheel = [wheelDps1, wheelDps2, wheelDps3][i];
    if (wheel) {
      spinPromises.push(wheel.spinTo(dpsPlayer.name, dpsDurations[i]));
    }
  });

  // Wait for all wheels to finish
  await Promise.all(spinPromises);

  // Remove spinning class
  document.querySelectorAll('.wheel-slot').forEach((el) => el.classList.remove('spinning'));

  // Victory sound
  audio.victory();

  // Show group result
  wheelStatus.textContent = `Group ${currentGroupIndex + 1} Formed!`;
  appendGroupCard(group, currentGroupIndex);

  // Remove picked players from pools
  const pickedNames = new Set<string>();
  if (group.tank) pickedNames.add(group.tank.name);
  if (group.healer) pickedNames.add(group.healer.name);
  group.dps.forEach((d) => pickedNames.add(d.name));

  poolTanks = poolTanks.filter((e) => !pickedNames.has(e.name));
  poolHealers = poolHealers.filter((e) => !pickedNames.has(e.name));
  poolDps = poolDps.filter((e) => !pickedNames.has(e.name));

  // Advance to next group
  currentGroupIndex++;
  isAnimating = false;
  updateNextButton();
}

async function finishSpinSequence() {
  if (currentSessionId) {
    const docRef = doc(db, 'sessions', currentSessionId);
    await updateDoc(docRef, { status: 'completed' });
  } else if (isDemoMode && currentSessionData) {
    handleSessionUpdate({ ...currentSessionData, status: 'completed' } as Session);
  }
}

// ── Group Card Rendering ─────────────────────────────────────
function appendGroupCard(group: WoWGroup, index: number) {
  const card = createGroupCard(group, index);
  groupsList.appendChild(card);
}

function createGroupCard(group: WoWGroup, index: number): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'group-card';

  const dpsHtml = group.dps
    .map(
      (d) => `
    <div class="group-role">
      <span class="role-indicator" style="background:var(--color-dps)"></span>
      <span class="role-label">DPS</span>
      <span class="role-name">${escapeHtml(d.name)}</span>
    </div>`
    )
    .join('');

  div.innerHTML = `
    <h4>Group ${index + 1}</h4>
    <div class="group-role">
      <span class="role-indicator" style="background:var(--color-tank)"></span>
      <span class="role-label">Tank</span>
      <span class="role-name">${group.tank ? escapeHtml(group.tank.name) : 'None'}</span>
    </div>
    <div class="group-role">
      <span class="role-indicator" style="background:var(--color-healer)"></span>
      <span class="role-label">Healer</span>
      <span class="role-name">${group.healer ? escapeHtml(group.healer.name) : 'None'}</span>
    </div>
    ${dpsHtml}
  `;
  return div;
}

// ── Results View ─────────────────────────────────────────────
function showResults(sessionGroups: WoWGroup[]) {
  showView('results');
  finalGroups.innerHTML = '';

  sessionGroups.forEach((g, i) => {
    finalGroups.appendChild(createGroupCard(g, i));
  });
}

// ── New Round ────────────────────────────────────────────────
async function startNewRound() {
  spinSequenceStarted = false;
  groups = [];
  currentGroupIndex = 0;
  isAnimating = false;

  if (isDemoMode && currentSessionData) {
    handleSessionUpdate({
      ...currentSessionData,
      status: 'lobby',
      selectedChannelId: null,
      groups: [],
      players: [],
    } as Session);
    return;
  }

  if (!currentSessionId) return;
  const docRef = doc(db, 'sessions', currentSessionId);
  await updateDoc(docRef, {
    status: 'lobby',
    selectedChannelId: null,
    groups: [],
    players: [],
  });
}

// ── Demo Mode ────────────────────────────────────────────────
function startDemo() {
  isDemoMode = true;
  demoControls.classList.add('hidden');
  statusMsg.textContent = '';
  handleSessionUpdate(mockSession);
}

// ── Start ────────────────────────────────────────────────────
init();
