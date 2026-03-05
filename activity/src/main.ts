// Discord SDK must be imported first — it patches fetch/WebSocket for the
// embedded activity proxy before Firebase opens any connections.
import { setupDiscordSdk } from './discordSdk';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { RecentGuild, WoWPlayer, WoWGroup, VoiceChannel, WheelEntry, GuildData, ChannelData } from './types';
import { mockGuildData, mockChannelData, mockPlayers, mockGroups } from './mockData';
import { WheelsGrid } from './wheelsGrid';
import { audio } from './audio';
import './style.css';

// ── Configurable Timing Constants ────────────────────────────
const CAROUSEL_SPIN_DURATION = 2000;   // ms per wheel in carousel mode
const CAROUSEL_ADVANCE_DELAY = 400;    // ms pause after each landing
const GRID_SPIN_DURATION = 4000;       // ms per wheel in grid mode

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
const refreshChannelsBtn = document.getElementById('refresh-channels-btn') as HTMLButtonElement;

// Lobby
const playerList = document.getElementById('player-list') as HTMLDivElement;
const playerCount = document.getElementById('player-count') as HTMLSpanElement;
const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement;
const changeChannelBtn = document.getElementById('change-channel-btn') as HTMLButtonElement;

// Lobby options
const announceCheckbox = document.getElementById('announce-checkbox') as HTMLInputElement;

// Wheels
const wheelsBackBtn = document.getElementById('wheels-back-btn') as HTMLButtonElement;
const wheelStatus = document.getElementById('wheel-status') as HTMLDivElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const wheelsAreaMount = document.getElementById('wheels-area') as HTMLDivElement;

// Side panel
const sideColumn = document.getElementById('side-column') as HTMLElement;
const groupsList = document.getElementById('groups-list') as HTMLDivElement;

// Results
const finalGroups = document.getElementById('final-groups') as HTMLDivElement;
const newRoundBtn = document.getElementById('new-round-btn') as HTMLButtonElement;

// ── Wheels Grid Component ────────────────────────────────────
let wheelsGrid: WheelsGrid | null = null;

// ── Routing ──────────────────────────────────────────────────
type ViewName = 'home' | 'channels' | 'lobby' | 'wheels' | 'results';

function viewToRoute(view: ViewName, guildId?: string | null): string {
  if (view === 'home' || !guildId) return '#/';
  return `#/guild/${guildId}/${view}`;
}

function routeToView(hash: string): { view: ViewName; guildId: string | null } {
  if (!hash || hash === '#/') return { view: 'home', guildId: null };
  const match = hash.match(/^#\/guild\/([\w-]+)\/(channels|lobby|wheels|results)$/);
  if (match) return { view: match[2] as ViewName, guildId: match[1] };
  return { view: 'home', guildId: null };
}

let currentView: ViewName = 'home';

// ── State ────────────────────────────────────────────────────
let currentGuildId: string | null = null;
let currentChannelId: string | null = null;
let guildData: GuildData | null = null;
let channelData: ChannelData | null = null;
let guildUnsubscribe: Unsubscribe | null = null;
let channelUnsubscribe: Unsubscribe | null = null;
let isDemoMode = false;
let discordChannelId: string | null = null;
let guildDocCreationInFlight = false;
let awaitingInitialChannelSnapshot = false;

// Spin sequence state
let fullGroups: WoWGroup[] = [];
let remainderGroups: WoWGroup[] = [];
let currentGroupIndex = 0;
let spinSequenceStarted = false;

// Candidate pools (filtered between groups)
let poolTanks: WheelEntry[] = [];
let poolHealers: WheelEntry[] = [];
let poolDps: WheelEntry[] = [];

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

// ── Guild Listener ───────────────────────────────────────────
function subscribeToGuild(guildId: string) {
  if (guildUnsubscribe) {
    guildUnsubscribe();
    guildUnsubscribe = null;
  }

  const docRef = doc(db, 'guilds', guildId);
  guildUnsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        handleGuildUpdate(docSnap.data() as GuildData);
      } else {
        // Auto-create guild doc instead of showing a button
        if (!guildDocCreationInFlight) {
          guildDocCreationInFlight = true;
          statusMsg.textContent = 'Setting up session...';
          createGuildEntry(guildId)
            .catch((err) => {
              console.error('[Wheelson] Failed to auto-create guild doc:', err);
              statusMsg.textContent = 'Failed to set up session. Please try again.';
            })
            .finally(() => {
              guildDocCreationInFlight = false;
            });
        }
      }
    },
    (error) => {
      console.error('[Wheelson] Guild Firestore error:', error);
      statusMsg.textContent = 'Connection lost. Please refresh to try again.';
    },
  );
}

// ── Channel Listener ─────────────────────────────────────────
function subscribeToChannel(channelId: string) {
  if (channelUnsubscribe) {
    channelUnsubscribe();
    channelUnsubscribe = null;
  }

  const docRef = doc(db, 'channels', channelId);
  channelUnsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        handleChannelUpdate(docSnap.data() as ChannelData);
      } else {
        console.warn('[Wheelson] No doc at channels/' + channelId);
      }
    },
    (error) => {
      console.error('[Wheelson] Channel Firestore error:', error);
      statusMsg.textContent = 'Connection lost. Please refresh to try again.';
    },
  );
}

// ── View Management (pure DOM) ───────────────────────────────
function showView(view: ViewName) {
  viewHome.classList.add('hidden');
  viewChannels.classList.add('hidden');
  viewLobby.classList.add('hidden');
  viewWheels.classList.add('hidden');
  viewResults.classList.add('hidden');
  sideColumn.classList.add('hidden');
  statusMsg.textContent = '';

  // Demo controls are only relevant on the home view
  demoControls.classList.toggle('hidden', view !== 'home');

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
      sideColumn.classList.remove('hidden');
      if (channelData) {
        announceCheckbox.checked =
          channelData.announceResults !== false;
      }
      // Force redraw wheels after layout transition
      requestAnimationFrame(() => {
        wheelsGrid?.forceRedraw();
      });
      break;
    case 'results':
      viewResults.classList.remove('hidden');
      break;
  }

  currentView = view;
}

// ── Navigation ───────────────────────────────────────────────

function handleRouteChange(view: ViewName) {
  // ── Tear down ──
  if (view === 'home') {
    if (channelUnsubscribe) { channelUnsubscribe(); channelUnsubscribe = null; }
    if (guildUnsubscribe) { guildUnsubscribe(); guildUnsubscribe = null; }
    currentGuildId = null; currentChannelId = null;
    channelData = null; guildData = null;
    isDemoMode = false;
  }
  if (view === 'channels') {
    if (channelUnsubscribe) { channelUnsubscribe(); channelUnsubscribe = null; }
    currentChannelId = null; channelData = null;
    resetSpinState();
  }
  if (view === 'lobby') {
    resetSpinState();
  }

  // ── Show ──
  showView(view);

  // ── Render ──
  switch (view) {
    case 'home':
      renderRecentGuilds();
      break;
    case 'channels':
      if (guildData?.voiceChannels) {
        renderChannelPicker(guildData.voiceChannels);
      } else {
        statusMsg.textContent = 'Loading channels...';
      }
      break;
    case 'lobby':
      if (channelData?.players) renderLobby(channelData.players);
      break;
    case 'wheels':
      wheelStatus.textContent = 'Calculating...';
      nextBtn.classList.add('hidden');
      groupsList.textContent = '';
      break;
    case 'results':
      if (channelData?.groups) renderResultsContent(channelData.groups);
      break;
  }
}

function navigateTo(view: ViewName, opts?: { replace?: boolean }) {
  handleRouteChange(view);

  // ── URL ──
  const route = viewToRoute(view, currentGuildId);
  if (opts?.replace) {
    history.replaceState({ view }, '', route);
  } else {
    history.pushState({ view }, '', route);
  }
}

// ── Guild Update Handler (data only) ─────────────────────────
function handleGuildUpdate(data: GuildData) {
  guildData = data;

  // Re-enable refresh button once bot has processed the request
  if (!('refreshRequest' in data && data.refreshRequest) && refreshChannelsBtn.disabled) {
    refreshChannelsBtn.disabled = false;
  }

  // Persist guild info for recent guilds list (skip demo mode; validate snowflake format)
  if (currentGuildId && data.guildName && !isDemoMode && /^\d+$/.test(currentGuildId)) {
    saveRecentGuild(currentGuildId, data.guildName, data.guildIconUrl);
  }

  // Re-render channel picker if we're on that view
  if (currentView === 'channels') {
    if (data.refreshRequest && (!data.voiceChannels || data.voiceChannels.length === 0)) {
      statusMsg.textContent = 'Loading channels...';
    } else {
      statusMsg.textContent = '';
      renderChannelPicker(data.voiceChannels || []);
    }
  }
}

// ── Channel Update Handler (data only) ───────────────────────
function handleChannelUpdate(data: ChannelData) {
  channelData = data;

  // First snapshot after init with a pre-resolved channel (Discord Activity):
  // navigate to the view matching the channel's current status.
  if (awaitingInitialChannelSnapshot) {
    awaitingInitialChannelSnapshot = false;
    const view = statusToView(data.status);
    navigateTo(view, { replace: true });
    // Fall through to apply view-specific state (e.g., startSpinSequence for spinning)
  }

  // Re-render lobby if we're on lobby view
  if (currentView === 'lobby') {
    renderLobby(data.players);
    if (data.status === 'request_spin') {
      spinBtn.disabled = true;
      spinBtn.textContent = 'Calculating...';
    }
  }

  // If groups arrived and we're on wheels, start animation
  if (currentView === 'wheels' && data.status === 'spinning') {
    if ((data as unknown as Record<string, unknown>).staticWheel) {
      initPools(data.players);
      wheelsGrid?.initWheels({ tanks: poolTanks, healers: poolHealers, dps: poolDps });
      wheelStatus.textContent = 'Static preview';
      nextBtn.classList.add('hidden');
    } else if (!spinSequenceStarted && data.groups && data.groups.length > 0) {
      spinSequenceStarted = true;
      startSpinSequence(data.groups, data.players);
    }
  }

  // Re-render results if we're on results view
  if (currentView === 'results' && data.status === 'completed') {
    renderResultsContent(data.groups || []);
  }
}

// ── Initialization ───────────────────────────────────────────
async function init() {
  const urlParams = new URLSearchParams(window.location.search);

  // Initialize wheels grid component
  wheelsGrid = new WheelsGrid(wheelsAreaMount);

  // Event listeners
  spinBtn.addEventListener('click', () => {
    navigateTo('wheels');
    requestSpin().catch(() => {
      navigateTo('lobby');
      statusMsg.textContent = 'Spin request failed. Please try again.';
    });
  });
  nextBtn.addEventListener('click', spinForCurrentGroup);
  startDemoBtn.addEventListener('click', startDemo);
  newRoundBtn.addEventListener('click', () => navigateTo('channels'));
  startSessionBtn.addEventListener('click', () => createGuildEntry());
  changeChannelBtn.addEventListener('click', () => navigateTo('channels'));
  wheelsBackBtn.addEventListener('click', cancelAndReturnToLobby);
  refreshChannelsBtn.addEventListener('click', refreshChannels);

  const headerTitle = document.querySelector('.app-header h1') as HTMLHeadingElement;
  headerTitle.addEventListener('click', () => navigateTo('home'));
  headerTitle.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateTo('home');
    }
  });

  announceCheckbox.addEventListener('change', async () => {
    if (isDemoMode) return;
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { announceResults: announceCheckbox.checked });
  });

  // Browser back/forward navigation
  window.addEventListener('popstate', () => {
    const parsed = routeToView(location.hash || '#/');
    let view = parsed.view;

    // Switch guild if the URL points to a different one
    let guildChanged = false;
    if (parsed.guildId && parsed.guildId !== currentGuildId && view !== 'home') {
      guildChanged = true;
      connectToGuild(parsed.guildId);
    }

    if (view === currentView && !guildChanged) return;

    // Guard against navigating to wheels/results without active state
    if ((view === 'wheels' || view === 'results') && !channelData?.groups?.length) {
      view = currentGuildId ? 'channels' : 'home';
      history.replaceState({ view }, '', viewToRoute(view, currentGuildId));
    }

    // Don't push to history — browser already updated the URL
    handleRouteChange(view);
  });

  // Check for injected mock data (testing)
  const dataParam = urlParams.get('data');
  if (dataParam) {
    try {
      const json = atob(dataParam);
      const data = JSON.parse(json);
      if (data.guild && data.channel) {
        guildData = data.guild;
        const channelView = statusToView((data.channel as ChannelData).status);
        showView(channelView);
        handleChannelUpdate(data.channel);
      } else if ('voiceChannels' in data && !('status' in data)) {
        guildData = data;
        showView('channels');
        handleGuildUpdate(data);
      } else {
        const cd = data as ChannelData;
        channelData = cd;
        const view = statusToView(cd.status);
        showView(view);
        handleChannelUpdate(cd);
      }
      return;
    } catch (e) {
      console.error('Invalid data param', e);
    }
  }

  // Resolve guild ID: URL params first, then hash route, then Discord SDK
  currentGuildId = urlParams.get('guildId') || urlParams.get('sessionId');
  const urlChannelId = urlParams.get('channelId');
  const initialRoute = routeToView(location.hash);

  if (!currentGuildId && initialRoute.guildId) {
    currentGuildId = initialRoute.guildId;
  }

  if (!currentGuildId) {
    const discordContext = await setupDiscordSdk();
    if (discordContext) {
      currentGuildId = discordContext.guildId;
      discordChannelId = discordContext.channelId;
      console.log('[Wheelson] Discord SDK context:', discordContext);
    } else {
      console.warn('[Wheelson] Discord SDK returned null context');
    }
  }

  console.log('[Wheelson] Resolved guildId:', currentGuildId, 'channelId:', urlChannelId || discordChannelId);

  if (!currentGuildId) {
    navigateTo('home', { replace: true });
    return;
  }

  // Subscribe to guild doc
  subscribeToGuild(currentGuildId);

  // If we have a channel ID, subscribe to it directly and let the first
  // snapshot drive the initial view (via awaitingInitialChannelSnapshot).
  const resolvedChannelId = urlChannelId || discordChannelId;
  if (resolvedChannelId) {
    currentChannelId = resolvedChannelId;
    awaitingInitialChannelSnapshot = true;
    subscribeToChannel(resolvedChannelId);
    // Show channels view as loading placeholder until first snapshot arrives
    showView('channels');
    statusMsg.textContent = 'Loading...';
  } else {
    // No pre-resolved channel — go to channel picker
    if (initialRoute.guildId && (initialRoute.view === 'wheels' || initialRoute.view === 'results')) {
      console.warn('[Wheelson] Stale hash', initialRoute.view, ', redirecting to channels');
    }
    navigateTo('channels', { replace: true });
  }
}

function statusToView(status: string): ViewName {
  switch (status) {
    case 'lobby':
    case 'request_spin':
      return 'lobby';
    case 'spinning':
      return 'wheels';
    case 'completed':
      return 'results';
    default:
      console.warn('[Wheelson] Unknown channel status:', status);
      return 'lobby';
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

    const handleGuildClick = () => {
      connectToGuild(guild.guildId);
      navigateTo('channels');
    };
    card.onclick = handleGuildClick;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleGuildClick();
      }
    };

    recentGuildsList.appendChild(card);
  });
}

function connectToGuild(guildId: string) {
  if (channelUnsubscribe) { channelUnsubscribe(); channelUnsubscribe = null; }
  currentChannelId = null; channelData = null;
  currentGuildId = guildId;
  subscribeToGuild(guildId);
}

// ── Channel Picker ───────────────────────────────────────────
function renderChannelPicker(channels: VoiceChannel[]) {
  channelList.textContent = '';

  if (!channels || channels.length === 0) {
    const msg = document.createElement('div');
    msg.style.textAlign = 'center';
    msg.style.color = 'var(--text-secondary)';
    msg.textContent = 'No voice channels found.';
    channelList.appendChild(msg);
    return;
  }

  channels.forEach((ch) => {
    const card = document.createElement('div');
    card.className = ch.userCount === 0 ? 'channel-card channel-empty' : 'channel-card';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'channel-name';
    nameSpan.textContent = ch.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'channel-count';
    countSpan.textContent = ch.userCount === 0 ? 'Empty' : `${ch.userCount} users`;

    card.appendChild(nameSpan);
    card.appendChild(countSpan);
    card.onclick = () => selectChannel(ch.id, ch.name);
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectChannel(ch.id, ch.name);
      }
    };
    channelList.appendChild(card);
  });
}

async function selectChannel(channelId: string, channelName?: string) {
  if (isDemoMode) {
    currentChannelId = channelId;
    channelData = {
      ...mockChannelData,
      channelId,
      channelName: channelName || 'Demo Channel',
      players: mockPlayers,
    };
    navigateTo('lobby');
    return;
  }

  if (!currentGuildId) return;

  currentChannelId = channelId;

  // Create the channel doc (merge to avoid overwriting bot-owned fields like players)
  const channelDocRef = doc(db, 'channels', channelId);
  await setDoc(channelDocRef, {
    channelId,
    channelName: channelName || '',
    guildId: currentGuildId,
    status: 'lobby',
    groups: [],
    isDebug: false,
    announceResults: true,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  }, { merge: true });

  // Subscribe to the channel doc
  subscribeToChannel(channelId);

  navigateTo('lobby');
}

async function refreshChannels() {
  if (!currentGuildId) return;
  refreshChannelsBtn.disabled = true;
  try {
    const docRef = doc(db, 'guilds', currentGuildId);
    await updateDoc(docRef, { refreshRequest: serverTimestamp() });
    // Button re-enabled in handleGuildUpdate when refreshRequest is cleared
  } catch {
    refreshChannelsBtn.disabled = false;
  }
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
  if (channelData?.status === 'request_spin') {
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
  if (isDemoMode && channelData) {
    const currentData = { ...channelData };
    // Simulate bot processing after delay
    setTimeout(() => {
      handleChannelUpdate({
        ...currentData,
        status: 'spinning',
        groups: mockGroups,
      } as ChannelData);
    }, 1500);
    return;
  }

  if (!currentChannelId) return;
  const docRef = doc(db, 'channels', currentChannelId);
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

  groupsList.textContent = '';

  // Reset carousel state
  wheelsGrid?.resetCarouselDots();
  wheelsGrid?.setCarouselSlide(0);

  // Build candidate pools and init all wheels
  initPools(players);
  wheelsGrid?.initWheels({ tanks: poolTanks, healers: poolHealers, dps: poolDps });

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

function resetSpinState() {
  wheelsGrid?.cancelAll();
  spinSequenceStarted = false;
  fullGroups = [];
  remainderGroups = [];
  currentGroupIndex = 0;
  if (wheelsGrid) {
    wheelsGrid.isAnimating = false;
  }

  // Clean up visual state left behind by a cancelled spin
  wheelsGrid?.clearSpinningState();
  groupsList.textContent = '';
}

async function cancelAndReturnToLobby() {
  navigateTo('lobby');

  if (isDemoMode && channelData) {
    channelData = { ...channelData, status: 'lobby', groups: [] };
    return;
  }

  if (!currentChannelId) return;
  const docRef = doc(db, 'channels', currentChannelId);
  await updateDoc(docRef, { status: 'lobby', groups: [] });
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
  if (!wheelsGrid || wheelsGrid.isAnimating || currentGroupIndex >= fullGroups.length) return;

  if (wheelsGrid.isCarouselMode()) {
    await spinForCurrentGroupCarousel();
  } else {
    await spinForCurrentGroupGrid();
  }
}

// ── Grid Mode Spin (all wheels simultaneously) ───────────────
async function spinForCurrentGroupGrid() {
  if (!wheelsGrid) return;
  wheelsGrid.isAnimating = true;
  nextBtn.disabled = true;
  const group = fullGroups[currentGroupIndex];
  wheelStatus.textContent = `Spinning for Group ${currentGroupIndex + 1}...`;

  // Add spinning class for glow animation
  wheelsGrid.setAllSpinning();

  // Clear previous results
  wheelsGrid.clearAllResults();

  // Re-init wheels with current pools
  wheelsGrid.initWheels({ tanks: poolTanks, healers: poolHealers, dps: poolDps });

  // Spin all 5 wheels simultaneously with slightly staggered stop times
  const spinPromises: Promise<string>[] = [];

  if (group.tank) {
    spinPromises.push(wheelsGrid.tank.spinTo(group.tank.name, GRID_SPIN_DURATION));
  }
  if (group.healer) {
    spinPromises.push(wheelsGrid.healer.spinTo(group.healer.name, GRID_SPIN_DURATION));
  }

  // DPS wheels with staggered durations for visual variety
  const dpsWheels = [wheelsGrid.dps1, wheelsGrid.dps2, wheelsGrid.dps3];
  const dpsDurations = [GRID_SPIN_DURATION, GRID_SPIN_DURATION + 300, GRID_SPIN_DURATION + 600];
  group.dps.forEach((dpsPlayer, i) => {
    const wheel = dpsWheels[i];
    if (wheel) {
      spinPromises.push(wheel.spinTo(dpsPlayer.name, dpsDurations[i]));
    }
  });

  try {
    // Wait for all wheels to finish
    await Promise.all(spinPromises);
  } catch {
    // Spin was cancelled — bail out silently
    return;
  }

  // Remove spinning class
  wheelsGrid.clearSpinningState();
  wheelsGrid.isAnimating = false;

  // Victory sound
  audio.victory();

  // Show group result
  wheelStatus.textContent = `Group ${currentGroupIndex + 1} Formed!`;
  appendGroupCard(group, currentGroupIndex);

  advanceAfterSpin(group);
}

// ── Carousel Mode Spin (sequential per-wheel) ────────────────
async function spinForCurrentGroupCarousel() {
  if (!wheelsGrid) return;
  wheelsGrid.isAnimating = true;
  nextBtn.disabled = true;
  const group = fullGroups[currentGroupIndex];
  wheelStatus.textContent = `Spinning for Group ${currentGroupIndex + 1}...`;

  // Clear previous results
  wheelsGrid.clearAllResults();

  // Re-init wheels with current pools
  wheelsGrid.initWheels({ tanks: poolTanks, healers: poolHealers, dps: poolDps });

  // Reset dots for this spin
  wheelsGrid.resetCarouselDots();

  // Define the sequence: [slideIndex, wheel, winner]
  const wheels = wheelsGrid.orderedWheels();
  const winners = [group.tank, group.healer, group.dps[0] || null, group.dps[1] || null, group.dps[2] || null];

  try {
    for (let slideIndex = 0; slideIndex < wheels.length; slideIndex++) {
      const wheel = wheels[slideIndex];
      const winner = winners[slideIndex];
      if (!winner) continue;

      // Slide to this wheel
      wheelsGrid.setCarouselSlide(slideIndex);
      const slot = wheelsGrid.getSlot(slideIndex);
      slot?.classList.add('spinning');

      // Let carousel transition finish
      await delay(350);

      // Spin this wheel
      await wheel.spinTo(winner.name, CAROUSEL_SPIN_DURATION);

      slot?.classList.remove('spinning');
      wheelsGrid.markDotCompleted(slideIndex);

      // Pause before next wheel
      await delay(CAROUSEL_ADVANCE_DELAY);
    }
  } catch {
    // Spin was cancelled — bail out silently
    return;
  }

  // Remove animation lock
  wheelsGrid.isAnimating = false;

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

  // After all full groups are spun, show remainder groups as cards (no wheel spin)
  if (currentGroupIndex >= fullGroups.length && remainderGroups.length > 0) {
    remainderGroups.forEach((rg, i) => {
      appendGroupCard(rg, fullGroups.length + i, 'Remainder', true);
    });
  }

  updateNextButton();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function finishSpinSequence() {
  navigateTo('results', { replace: true });

  if (isDemoMode && channelData) {
    channelData = { ...channelData, status: 'completed' };
  } else if (currentChannelId) {
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { status: 'completed' });
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
function appendGroupCard(group: WoWGroup, index: number, label?: string, hideEmpty = false) {
  if (isCompactPanel()) {
    groupsList.appendChild(createCompactGroupCard(group, index, label, hideEmpty));
  } else {
    groupsList.appendChild(createGroupCard(group, index, label, hideEmpty));
  }
}

function isCompactPanel(): boolean {
  return window.innerWidth < 900;
}

function createGroupCard(group: WoWGroup, index: number, label?: string, hideEmpty = false): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'group-card';

  const h4 = document.createElement('h4');
  h4.textContent = label ?? `Group ${index + 1}`;
  div.appendChild(h4);

  if (!hideEmpty || group.tank) {
    div.appendChild(createRoleRow('var(--color-tank)', 'Tank', group.tank?.name || 'None', group.tank));
  }
  if (!hideEmpty || group.healer) {
    div.appendChild(
      createRoleRow('var(--color-healer)', 'Healer', group.healer?.name || 'None', group.healer),
    );
  }
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

function createCompactGroupCard(group: WoWGroup, index: number, label?: string, hideEmpty = false): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'group-card-compact';

  const h4 = document.createElement('h4');
  h4.textContent = label ?? `Group ${index + 1}`;
  div.appendChild(h4);

  const roles: { color: string; roleLabel: string; name: string; player?: WoWPlayer | null }[] = [];
  if (!hideEmpty || group.tank) {
    roles.push({
      color: 'var(--color-tank)',
      roleLabel: 'Tank',
      name: group.tank?.name || 'None',
      player: group.tank,
    });
  }
  if (!hideEmpty || group.healer) {
    roles.push({
      color: 'var(--color-healer)',
      roleLabel: 'Healer',
      name: group.healer?.name || 'None',
      player: group.healer,
    });
  }
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
function renderResultsContent(sessionGroups: WoWGroup[]) {
  finalGroups.textContent = '';

  sessionGroups.forEach((g, i) => {
    const remainder = !isCompleteGroup(g);
    finalGroups.appendChild(createGroupCard(g, i, remainder ? 'Remainder' : undefined, remainder));
  });
}

// ── Guild Entry Creation ─────────────────────────────────────
async function createGuildEntry(guildId?: string) {
  const id = guildId ?? currentGuildId;
  if (!id) return;

  // Validate guild ID is a numeric Discord snowflake (no path traversal)
  if (!/^\d+$/.test(id) && id !== 'demo-guild') {
    console.error('[Wheelson] Invalid guild ID:', id);
    return;
  }

  // Create guild doc with refreshRequest so bot populates voice channels
  const guildDocRef = doc(db, 'guilds', id);
  await setDoc(guildDocRef, {
    guildId: id,
    voiceChannels: [],
    refreshRequest: serverTimestamp(),
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  });

  // If we have a channel from Discord SDK, also create a channel doc
  if (discordChannelId) {
    currentChannelId = discordChannelId;
    const channelDocRef = doc(db, 'channels', discordChannelId);
    await setDoc(channelDocRef, {
      channelId: discordChannelId,
      channelName: '',
      guildId: id,
      status: 'lobby',
      players: [],
      groups: [],
      isDebug: false,
      announceResults: true,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });
    subscribeToChannel(discordChannelId);
  }
}

// ── Demo Mode ────────────────────────────────────────────────
function startDemo() {
  isDemoMode = true;
  currentGuildId = 'demo-guild';
  guildData = mockGuildData;
  navigateTo('channels');
}

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
