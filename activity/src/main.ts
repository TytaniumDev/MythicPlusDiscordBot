// Discord SDK must be imported first — it patches fetch/WebSocket for the
// embedded activity proxy before Firebase opens any connections.
import { setupDiscordSdk } from './discordSdk';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Session, RecentGuild, WoWPlayer, WoWGroup, VoiceChannel, WheelEntry } from './types';
import { mockSession, mockPlayers, mockGroups } from './mockData';
import { Wheel } from './wheel';
import { audio } from './audio';
import './style.css';

// ── Configurable Timing Constants ────────────────────────────
const CAROUSEL_SPIN_DURATION = 2000;   // ms per wheel in carousel mode
const CAROUSEL_ADVANCE_DELAY = 400;    // ms pause after each landing
const GRID_SPIN_DURATION = 4000;       // ms per wheel in grid mode

// ── Carousel State ───────────────────────────────────────────
let carouselIndex = 0;
const CAROUSEL_MQ = window.matchMedia('(max-width: 599px)');

// ── Commit Hash ──────────────────────────────────────────────
const commitLink = document.getElementById('commit-link') as HTMLAnchorElement;
commitLink.textContent = __COMMIT_HASH__;
commitLink.href = `https://github.com/TytaniumDev/MythicPlusDiscordBot/commit/${__COMMIT_HASH__}`;
commitLink.setAttribute('aria-label', `View commit ${__COMMIT_HASH__} on GitHub`);

// ── UI Elements ──────────────────────────────────────────────
const statusMsg = document.getElementById('status-message') as HTMLDivElement;
const demoControls = document.getElementById('demo-controls') as HTMLDivElement;
const startDemoBtn = document.getElementById('start-demo-btn') as HTMLButtonElement;
const startSessionBtn = document.getElementById('start-session-btn') as HTMLButtonElement;

// Views
const viewHome = document.getElementById('view-home') as HTMLElement;
const viewChannels = document.getElementById('view-channels') as HTMLElement;
const viewLobby = document.getElementById('view-lobby') as HTMLElement;
const viewWheels = document.getElementById('view-wheels') as HTMLElement;
const viewResults = document.getElementById('view-results') as HTMLElement;

// Home view
const recentGuildsList = document.getElementById('recent-guilds-list') as HTMLDivElement;
const noRecentGuilds = document.getElementById('no-recent-guilds') as HTMLParagraphElement;

// Channel picker
const channelList = document.getElementById('channel-list') as HTMLDivElement;

// Lobby
const playerList = document.getElementById('player-list') as HTMLDivElement;
const playerCount = document.getElementById('player-count') as HTMLSpanElement;
const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement;
const changeChannelBtn = document.getElementById('change-channel-btn') as HTMLButtonElement;

// Wheels
const wheelStatus = document.getElementById('wheel-status') as HTMLDivElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const wheelsContainer = document.querySelector('.wheels-container') as HTMLDivElement;
const carouselDots = document.querySelectorAll('.carousel-dot') as NodeListOf<HTMLButtonElement>;

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
let discordChannelId: string | null = null;

// Spin sequence state
let fullGroups: WoWGroup[] = [];
let remainderGroups: WoWGroup[] = [];
let currentGroupIndex = 0;
let isAnimating = false;
let spinSequenceStarted = false;

// Candidate pools (filtered between groups)
let poolTanks: WheelEntry[] = [];
let poolHealers: WheelEntry[] = [];
let poolDps: WheelEntry[] = [];

// ── Carousel Controller ──────────────────────────────────────
function isCarouselMode(): boolean {
  return CAROUSEL_MQ.matches;
}

function setCarouselSlide(index: number) {
  carouselIndex = Math.max(0, Math.min(4, index));
  wheelsContainer.style.setProperty('--carousel-index', String(carouselIndex));

  carouselDots.forEach((dot, i) => {
    const isActive = i === carouselIndex;
    dot.classList.toggle('active', isActive);
    if (isActive) {
      dot.setAttribute('aria-current', 'step');
    } else {
      dot.removeAttribute('aria-current');
    }
  });
}

function markCarouselDotCompleted(index: number) {
  carouselDots[index]?.classList.add('completed');
}

function resetCarouselDots() {
  carouselDots.forEach((dot) => {
    dot.classList.remove('completed', 'active');
    dot.removeAttribute('aria-current');
  });
  const firstDot = carouselDots[0];
  firstDot?.classList.add('active');
  firstDot?.setAttribute('aria-current', 'step');
}

// Carousel dot click handlers
carouselDots.forEach((dot) => {
  dot.addEventListener('click', () => {
    if (isAnimating) return;
    const idx = Number(dot.dataset.index);
    if (!isNaN(idx)) setCarouselSlide(idx);
  });
});

// Touch swipe support for carousel
{
  let touchStartX = 0;
  let touchStartY = 0;

  wheelsContainer.addEventListener('touchstart', (e) => {
    if (!isCarouselMode() || isAnimating) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  wheelsContainer.addEventListener('touchend', (e) => {
    if (!isCarouselMode() || isAnimating) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && carouselIndex < 4) {
        setCarouselSlide(carouselIndex + 1);
      } else if (dx > 0 && carouselIndex > 0) {
        setCarouselSlide(carouselIndex - 1);
      }
    }
  }, { passive: true });
}

// ── Recent Guilds (localStorage) ─────────────────────────────
const RECENT_GUILDS_KEY = 'wheelson-recent-guilds';
const MAX_RECENT_GUILDS = 10;

function getRecentGuilds(): RecentGuild[] {
  try {
    const raw = localStorage.getItem(RECENT_GUILDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentGuild[])
      .filter((g) => g.guildId && g.guildName && typeof g.lastVisited === 'number')
      .sort((a, b) => b.lastVisited - a.lastVisited);
  } catch {
    return [];
  }
}

function saveRecentGuild(guildId: string, guildName: string, guildIconUrl?: string) {
  const guilds = getRecentGuilds().filter((g) => g.guildId !== guildId);
  guilds.unshift({ guildId, guildName, guildIconUrl, lastVisited: Date.now() });
  if (guilds.length > MAX_RECENT_GUILDS) guilds.length = MAX_RECENT_GUILDS;
  localStorage.setItem(RECENT_GUILDS_KEY, JSON.stringify(guilds));
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Initialization ───────────────────────────────────────────
async function init() {
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
  startSessionBtn.addEventListener('click', createSession);
  changeChannelBtn.addEventListener('click', changeChannel);

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

  // Resolve session ID: URL params first, then Discord SDK for embedded activities
  currentSessionId = urlParams.get('guildId') || urlParams.get('sessionId');

  if (!currentSessionId) {
    const discordContext = await setupDiscordSdk();
    if (discordContext) {
      currentSessionId = discordContext.guildId;
      discordChannelId = discordContext.channelId;
      console.log('[Activity] Discord SDK context:', discordContext);
    } else {
      console.warn('[Activity] Discord SDK returned null context');
    }
  }

  console.log('[Activity] Resolved sessionId:', currentSessionId);

  if (!currentSessionId) {
    showView('home');
    renderRecentGuilds();
    demoControls.classList.remove('hidden');
    return;
  }

  const docRef = doc(db, 'sessions', currentSessionId);
  onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        startSessionBtn.classList.add('hidden');
        handleSessionUpdate(docSnap.data() as Session);
      } else {
        console.warn('[Activity] No doc at sessions/' + currentSessionId);
        statusMsg.textContent = `No active session found. (ID: ${currentSessionId})`;
        startSessionBtn.classList.remove('hidden');
      }
    },
    (error) => {
      console.error('[Activity] Firestore error:', error);
      statusMsg.textContent = 'Activity ended.';
    }
  );
}

// ── Session State Handler ────────────────────────────────────
function handleSessionUpdate(data: Session) {
  currentSessionData = data;

  // Persist guild info for recent guilds list
  if (currentSessionId && data.guildName) {
    saveRecentGuild(currentSessionId, data.guildName, data.guildIconUrl);
  }

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
function showView(view: 'home' | 'channels' | 'lobby' | 'wheels' | 'results') {
  viewHome.classList.add('hidden');
  viewChannels.classList.add('hidden');
  viewLobby.classList.add('hidden');
  viewWheels.classList.add('hidden');
  viewResults.classList.add('hidden');
  sidePanel.classList.add('hidden');
  statusMsg.textContent = '';

  switch (view) {
    case 'home':
      viewHome.classList.remove('hidden');
      break;
    case 'channels':
      viewChannels.classList.remove('hidden');
      break;
    case 'lobby':
      viewLobby.classList.remove('hidden');
      break;
    case 'wheels':
      viewWheels.classList.remove('hidden');
      // Force redraw wheels after layout transition
      requestAnimationFrame(() => {
        wheelTank?.forceRedraw();
        wheelHealer?.forceRedraw();
        wheelDps1?.forceRedraw();
        wheelDps2?.forceRedraw();
        wheelDps3?.forceRedraw();
      });
      break;
    case 'results':
      viewResults.classList.remove('hidden');
      break;
  }
}

// ── Home View (Recent Guilds) ────────────────────────────────
function renderRecentGuilds() {
  const guilds = getRecentGuilds();
  recentGuildsList.textContent = '';

  if (guilds.length === 0) {
    noRecentGuilds.classList.remove('hidden');
    return;
  }

  noRecentGuilds.classList.add('hidden');

  guilds.forEach((guild) => {
    const card = document.createElement('div');
    card.className = 'guild-card';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    if (guild.guildIconUrl) {
      const icon = document.createElement('img');
      icon.className = 'guild-icon';
      icon.src = guild.guildIconUrl;
      icon.alt = '';
      card.appendChild(icon);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'guild-icon-placeholder';
      card.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.className = 'guild-card-info';

    const name = document.createElement('div');
    name.className = 'guild-card-name';
    name.textContent = guild.guildName;
    info.appendChild(name);

    const time = document.createElement('div');
    time.className = 'guild-last-visited';
    time.textContent = formatRelativeTime(guild.lastVisited);
    info.appendChild(time);

    card.appendChild(info);

    card.onclick = () => connectToGuild(guild.guildId);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        connectToGuild(guild.guildId);
      }
    };

    recentGuildsList.appendChild(card);
  });
}

function connectToGuild(guildId: string) {
  currentSessionId = guildId;
  demoControls.classList.add('hidden');
  statusMsg.textContent = 'Connecting...';

  const docRef = doc(db, 'sessions', guildId);
  onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        startSessionBtn.classList.add('hidden');
        handleSessionUpdate(docSnap.data() as Session);
      } else {
        statusMsg.textContent = `No active session found. (ID: ${guildId})`;
        startSessionBtn.classList.remove('hidden');
      }
    },
    (error) => {
      console.error('[Activity] Firestore error:', error);
      statusMsg.textContent = 'Activity ended.';
    },
  );
}

// ── Channel Picker ───────────────────────────────────────────
function renderChannelPicker(channels: VoiceChannel[]) {
  channelList.textContent = '';

  if (!channels || channels.length === 0) {
    const msg = document.createElement('div');
    msg.style.textAlign = 'center';
    msg.style.color = 'var(--text-secondary)';
    msg.textContent = 'No voice channels found with users.';
    channelList.appendChild(msg);
    return;
  }

  channels.forEach((ch) => {
    const card = document.createElement('div');
    card.className = 'channel-card';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'channel-name';
    nameSpan.textContent = ch.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'channel-count';
    countSpan.textContent = `${ch.userCount} users`;

    card.appendChild(nameSpan);
    card.appendChild(countSpan);
    card.onclick = () => selectChannel(ch.id);
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectChannel(ch.id);
      }
    };
    channelList.appendChild(card);
  });
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

async function changeChannel() {
  const updatePayload = { selectedChannelId: null, players: [] };

  if (isDemoMode && currentSessionData) {
    handleSessionUpdate({
      ...currentSessionData,
      ...updatePayload,
    } as Session);
    return;
  }

  if (!currentSessionId) return;
  const docRef = doc(db, 'sessions', currentSessionId);
  await updateDoc(docRef, updatePayload);
}

// ── Lobby ────────────────────────────────────────────────────
function renderLobby(players: WoWPlayer[]) {
  playerList.textContent = '';

  if (!players || players.length === 0) {
    const msg = document.createElement('div');
    msg.style.color = 'var(--text-secondary)';
    msg.style.gridColumn = '1 / -1';
    msg.style.textAlign = 'center';
    msg.textContent = 'Waiting for players to join voice...';
    playerList.appendChild(msg);
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

  // Group players by main role
  const tanks = players.filter((p) => getPrimaryRole(p) === 'tank');
  const healers = players.filter((p) => getPrimaryRole(p) === 'healer');
  const dps = players.filter((p) => getPrimaryRole(p) === 'dps');

  // Left column: Tank + Heal sections stacked
  const leftCol = document.createElement('div');
  leftCol.className = 'role-column';

  const sections: { label: string; roleClass: string; players: WoWPlayer[] }[] = [
    { label: `Tank (${tanks.length})`, roleClass: 'tank', players: tanks },
    { label: `Heal (${healers.length})`, roleClass: 'healer', players: healers },
  ];

  sections.forEach((sec) => {
    const section = document.createElement('div');
    section.className = 'role-section';

    const heading = document.createElement('div');
    heading.className = `role-column-header ${sec.roleClass}`;
    heading.textContent = sec.label;
    section.appendChild(heading);

    sec.players.forEach((p) => {
      section.appendChild(createPlayerChip(p));
    });

    leftCol.appendChild(section);
  });

  // Right column: DPS section
  const rightCol = document.createElement('div');
  rightCol.className = 'role-column role-column-dps';

  const dpsHeading = document.createElement('div');
  dpsHeading.className = 'role-column-header dps';
  dpsHeading.textContent = `DPS (${dps.length})`;
  rightCol.appendChild(dpsHeading);

  const dpsGrid = document.createElement('div');
  dpsGrid.className = 'dps-grid';
  dps.forEach((p) => {
    dpsGrid.appendChild(createPlayerChip(p));
  });
  rightCol.appendChild(dpsGrid);

  playerList.appendChild(leftCol);
  playerList.appendChild(rightCol);
}

function createPlayerChip(p: WoWPlayer): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'player-chip';

  const roleKey = getPrimaryRole(p);
  const roleName = formatRoleName(roleKey);

  const header = document.createElement('div');
  header.className = 'chip-header';

  const dot = document.createElement('span');
  dot.className = `role-dot ${roleKey}`;
  dot.setAttribute('role', 'img');
  dot.setAttribute('aria-label', roleName);
  dot.setAttribute('title', roleName);

  const name = document.createElement('span');
  name.textContent = p.name;

  header.appendChild(dot);
  header.appendChild(name);
  chip.appendChild(header);

  const tags = getRoleTags(p);
  if (tags.length > 0) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'chip-tags';
    tags.forEach((tag) => {
      const badge = document.createElement('span');
      badge.className = `role-tag ${tag.cssClass}`;
      badge.textContent = tag.label;
      tagsRow.appendChild(badge);
    });
    chip.appendChild(tagsRow);
  }

  return chip;
}

interface RoleTag {
  label: string;
  cssClass: string;
}

function getRoleTags(p: WoWPlayer): RoleTag[] {
  const tags: RoleTag[] = [];

  // Main roles
  if (p.roles.tankMain) tags.push({ label: 'Tank', cssClass: 'tag-tank' });
  if (p.roles.healerMain) tags.push({ label: 'Healer', cssClass: 'tag-healer' });
  if (p.roles.dpsMain) tags.push({ label: 'DPS', cssClass: 'tag-dps' });

  // Offspecs (only show if the corresponding main spec is not active)
  if (p.roles.offtank && !p.roles.tankMain) tags.push({ label: 'Offtank', cssClass: 'tag-tank tag-offspec' });
  if (p.roles.offhealer && !p.roles.healerMain) tags.push({ label: 'Offheal', cssClass: 'tag-healer tag-offspec' });
  if (p.roles.offdps && !p.roles.dpsMain) tags.push({ label: 'OffDPS', cssClass: 'tag-dps tag-offspec' });

  // DPS subtypes
  if (p.roles.ranged) tags.push({ label: 'Ranged', cssClass: 'tag-subtype' });
  if (p.roles.melee) tags.push({ label: 'Melee', cssClass: 'tag-subtype' });

  // Utilities
  if (p.roles.hasBrez) tags.push({ label: 'Brez', cssClass: 'tag-utility' });
  if (p.roles.hasLust) tags.push({ label: 'Lust', cssClass: 'tag-utility' });

  return tags;
}

function getPrimaryRole(p: WoWPlayer): string {
  if (p.roles.tankMain) return 'tank';
  if (p.roles.healerMain) return 'healer';
  return 'dps';
}

function formatRoleName(role: string): string {
  if (role.toLowerCase() === 'dps') return 'DPS';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
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

// ── Group Completeness Check ─────────────────────────────────
function isCompleteGroup(group: WoWGroup): boolean {
  return group.tank !== null && group.healer !== null && group.dps.length === 3;
}

// ── Spin Sequence ────────────────────────────────────────────
function startSpinSequence(sessionGroups: WoWGroup[], players: WoWPlayer[]) {
  fullGroups = sessionGroups.filter(isCompleteGroup);
  remainderGroups = sessionGroups.filter((g) => !isCompleteGroup(g));
  currentGroupIndex = 0;
  isAnimating = false;

  showView('wheels');
  sidePanel.classList.remove('hidden');
  groupsList.textContent = '';

  // Reset carousel state
  resetCarouselDots();
  setCarouselSlide(0);

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

  if (currentGroupIndex >= fullGroups.length) {
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
  if (isAnimating || currentGroupIndex >= fullGroups.length) return;

  if (isCarouselMode()) {
    await spinForCurrentGroupCarousel();
  } else {
    await spinForCurrentGroupGrid();
  }
}

// ── Grid Mode Spin (all wheels simultaneously) ───────────────
async function spinForCurrentGroupGrid() {
  isAnimating = true;
  nextBtn.disabled = true;
  const group = fullGroups[currentGroupIndex];
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
    spinPromises.push(wheelTank!.spinTo(group.tank.name, GRID_SPIN_DURATION));
  }
  if (group.healer) {
    spinPromises.push(wheelHealer!.spinTo(group.healer.name, GRID_SPIN_DURATION));
  }

  // DPS wheels with staggered durations for visual variety
  const dpsDurations = [GRID_SPIN_DURATION, GRID_SPIN_DURATION + 300, GRID_SPIN_DURATION + 600];
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

  advanceAfterSpin(group);
}

// ── Carousel Mode Spin (sequential per-wheel) ────────────────
async function spinForCurrentGroupCarousel() {
  isAnimating = true;
  nextBtn.disabled = true;
  const group = fullGroups[currentGroupIndex];
  wheelStatus.textContent = `Spinning for Group ${currentGroupIndex + 1}...`;

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

  // Reset dots for this spin
  resetCarouselDots();

  // Define the sequence: [slideIndex, wheel, winner]
  const sequence: [number, Wheel | null, WoWPlayer | null][] = [
    [0, wheelTank, group.tank],
    [1, wheelHealer, group.healer],
    [2, wheelDps1, group.dps[0] || null],
    [3, wheelDps2, group.dps[1] || null],
    [4, wheelDps3, group.dps[2] || null],
  ];

  for (const [slideIndex, wheel, winner] of sequence) {
    if (!wheel || !winner) continue;

    // Slide to this wheel
    setCarouselSlide(slideIndex);
    const slot = document.querySelectorAll('.wheel-slot')[slideIndex];
    slot?.classList.add('spinning');

    // Let carousel transition finish
    await delay(350);

    // Spin this wheel
    await wheel.spinTo(winner.name, CAROUSEL_SPIN_DURATION);

    slot?.classList.remove('spinning');
    markCarouselDotCompleted(slideIndex);

    // Pause before next wheel
    await delay(CAROUSEL_ADVANCE_DELAY);
  }

  // Victory sound
  audio.victory();

  // Show group result
  wheelStatus.textContent = `Group ${currentGroupIndex + 1} Formed!`;
  appendGroupCard(group, currentGroupIndex);

  advanceAfterSpin(group);
}

function advanceAfterSpin(_group: WoWGroup) {
  // Advance to next group (pools are kept intact so all players remain in wheels)
  currentGroupIndex++;
  isAnimating = false;

  // After all full groups are spun, show remainder groups as cards (no wheel spin)
  if (currentGroupIndex >= fullGroups.length && remainderGroups.length > 0) {
    remainderGroups.forEach((rg, i) => {
      appendGroupCard(rg, fullGroups.length + i, 'Remainder');
    });
  }

  updateNextButton();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function finishSpinSequence() {
  if (currentSessionId) {
    const docRef = doc(db, 'sessions', currentSessionId);
    await updateDoc(docRef, { status: 'completed' });
  } else if (isDemoMode && currentSessionData) {
    handleSessionUpdate({ ...currentSessionData, status: 'completed' } as Session);
  }
}

// ── Utility Icons ────────────────────────────────────────────
function utilityIcons(player?: WoWPlayer | null): string {
  if (!player) return '';
  let icons = '';
  if (player.roles.hasBrez) icons += ' \u26B0\uFE0F';
  if (player.roles.hasLust) icons += ' \uD83C\uDFBA';
  return icons;
}

// ── Group Card Rendering ─────────────────────────────────────
function appendGroupCard(group: WoWGroup, index: number, label?: string) {
  if (isCompactPanel()) {
    groupsList.appendChild(createCompactGroupCard(group, index, label));
  } else {
    groupsList.appendChild(createGroupCard(group, index, label));
  }
}

function isCompactPanel(): boolean {
  return window.innerWidth < 900;
}

function createGroupCard(group: WoWGroup, index: number, label?: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'group-card';

  const h4 = document.createElement('h4');
  h4.textContent = label ?? `Group ${index + 1}`;
  div.appendChild(h4);

  // Tank role
  div.appendChild(createRoleRow('var(--color-tank)', 'Tank', group.tank?.name || 'None', group.tank));
  // Healer role
  div.appendChild(
    createRoleRow('var(--color-healer)', 'Healer', group.healer?.name || 'None', group.healer),
  );
  // DPS roles
  group.dps.forEach((d) => {
    div.appendChild(createRoleRow('var(--color-dps)', 'DPS', d.name, d));
  });

  return div;
}

function createRoleRow(
  color: string,
  label: string,
  name: string,
  player?: WoWPlayer | null,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'group-role';

  const indicator = document.createElement('span');
  indicator.className = 'role-indicator';
  indicator.style.background = color;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'role-label';
  labelSpan.textContent = label;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'role-name';
  nameSpan.textContent = name + utilityIcons(player);

  row.appendChild(indicator);
  row.appendChild(labelSpan);
  row.appendChild(nameSpan);
  return row;
}

function createCompactGroupCard(group: WoWGroup, index: number, label?: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'group-card-compact';

  const h4 = document.createElement('h4');
  h4.textContent = label ?? `Group ${index + 1}`;
  div.appendChild(h4);

  const roles: { color: string; roleLabel: string; name: string; player?: WoWPlayer | null }[] = [];
  roles.push({
    color: 'var(--color-tank)',
    roleLabel: 'Tank',
    name: group.tank?.name || 'None',
    player: group.tank,
  });
  roles.push({
    color: 'var(--color-healer)',
    roleLabel: 'Healer',
    name: group.healer?.name || 'None',
    player: group.healer,
  });
  group.dps.forEach((d) =>
    roles.push({ color: 'var(--color-dps)', roleLabel: 'DPS', name: d.name, player: d }),
  );

  roles.forEach((r) => {
    div.appendChild(createCompactRoleRow(r.color, r.roleLabel, r.name, r.player));
  });

  return div;
}

function createCompactRoleRow(
  color: string,
  roleLabel: string,
  name: string,
  player?: WoWPlayer | null,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'compact-role';

  const indicator = document.createElement('span');
  indicator.className = 'role-indicator';
  indicator.style.background = color;
  indicator.setAttribute('role', 'img');
  indicator.setAttribute('aria-label', roleLabel);
  indicator.setAttribute('title', roleLabel);

  const nameSpan = document.createElement('span');
  nameSpan.className = 'role-name';
  nameSpan.textContent = name + utilityIcons(player);

  row.appendChild(indicator);
  row.appendChild(nameSpan);
  return row;
}

// ── Results View ─────────────────────────────────────────────
function showResults(sessionGroups: WoWGroup[]) {
  showView('results');
  finalGroups.textContent = '';

  sessionGroups.forEach((g, i) => {
    const label = isCompleteGroup(g) ? undefined : 'Remainder';
    finalGroups.appendChild(createGroupCard(g, i, label));
  });
}

// ── New Round ────────────────────────────────────────────────
async function startNewRound() {
  spinSequenceStarted = false;
  fullGroups = [];
  remainderGroups = [];
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

// ── Session Creation ─────────────────────────────────────────
async function createSession() {
  if (!currentSessionId) return;

  startSessionBtn.disabled = true;
  startSessionBtn.textContent = 'Creating...';

  const docRef = doc(db, 'sessions', currentSessionId);
  await setDoc(docRef, {
    guildId: currentSessionId,
    status: 'lobby',
    players: [],
    groups: [],
    voiceChannels: [],
    selectedChannelId: discordChannelId,
    isDebug: false,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  });

  // onSnapshot will pick up the new doc and hide the button
  startSessionBtn.disabled = false;
  startSessionBtn.textContent = 'Start Session';
}

// ── Demo Mode ────────────────────────────────────────────────
function startDemo() {
  isDemoMode = true;
  demoControls.classList.add('hidden');
  statusMsg.textContent = '';
  handleSessionUpdate(mockSession);
}

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
