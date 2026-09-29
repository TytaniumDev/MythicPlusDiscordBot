import { doc, collection, addDoc, getDoc, onSnapshot, updateDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove, increment, runTransaction, query, where, documentId } from 'firebase/firestore';
import { authReady, db } from '../firebase';
import type { GuildData } from '../types';
import { useAppStore } from '../store/store';
import type { SessionService } from './types';
import {
  WoWGroup,
  chunkIds,
  createMythicPlusGroups,
  encodeGroupHistoryRounds,
  parsePlayerPreferences,
  seasonPairsUpdate,
  setGroupHistory,
  todayPST,
} from '@mythicplus/shared';
import type { CharacterClass, PlayerPreferences, WoWGroupDict, WoWPlayerDict } from '@mythicplus/shared';
import type { Profiles } from '../lib/profiles';
import { reportError } from '../lib/sentry';
import { eligibleSpinPlayers } from '../lib/spinEligibility';
import { decodeChannelData, decodeGuildData, reportDecodeIssues } from './firestoreDecoders';
import { ensureLobby } from './lobby';

const MAX_LISTENER_RETRIES = 5;
const NON_RECOVERABLE_CODES = new Set(['permission-denied', 'not-found', 'unauthenticated']);
const CHANNEL_DOC_MISSING_GRACE_MS = 10000;

function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    if (code && NON_RECOVERABLE_CODES.has(code)) return false;
  }
  return true;
}

function backoffDelayMs(retryCount: number): number {
  return Math.min(1000 * 2 ** retryCount, 30000);
}

/**
 * Today's rounds from a guild's group history, or none when the history is
 * from another day. The history was validated when the guild doc was decoded.
 */
function todaysRounds(
  guildData: GuildData | null | undefined,
  todayIso: string,
): WoWGroupDict[][] {
  const history = guildData?.groupHistory;
  return history && history.date === todayIso ? history.rounds : [];
}

/** Decode a guild snapshot and report anything malformed in it. */
function readGuildData(raw: unknown, guildId: string): GuildData {
  const { value, issues } = decodeGuildData(raw, guildId);
  reportDecodeIssues('firestoreService.decodeGuild', `guilds/${guildId}`, issues);
  return value;
}

// Every write awaits `authReady` first: firestore.rules reject writes from a
// client that hasn't finished its anonymous sign-in.
class FirestoreSessionService implements SessionService {
  private guildUnsub: (() => void) | null = null;
  private channelUnsub: (() => void) | null = null;
  private guildRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private channelRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private channelMissingTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Schedule a listener retry with exponential backoff, surfacing a status
   * message to the user. Stores the timer handle on the instance so a fresh
   * subscribe call (or unsubscribe) can clear a pending retry instead of
   * letting it fire and re-establish a stale listener.
   */
  private scheduleRetry(
    slot: 'guildRetryTimer' | 'channelRetryTimer',
    label: string,
    retryCount: number,
    error: unknown,
    retry: () => void,
  ): void {
    if (!isRecoverableError(error) || retryCount >= MAX_LISTENER_RETRIES) {
      useAppStore.getState().setStatusMessage('Connection lost. Please refresh to try again.');
      return;
    }
    const delayMs = backoffDelayMs(retryCount);
    console.info(`[Wheelson] Retrying ${label} listener in ${delayMs}ms (attempt ${retryCount + 1})`);
    useAppStore.getState().setStatusMessage('Connection lost. Reconnecting...');
    this[slot] = setTimeout(() => {
      this[slot] = null;
      retry();
    }, delayMs);
  }

  private clearRetry(slot: 'guildRetryTimer' | 'channelRetryTimer'): void {
    const timer = this[slot];
    if (timer !== null) {
      clearTimeout(timer);
      this[slot] = null;
    }
  }

  subscribeToGuild(guildId: string, retryCount = 0): () => void {
    this.clearRetry('guildRetryTimer');
    this.guildUnsub?.();
    this.guildUnsub = null;

    const docRef = doc(db, 'guilds', guildId);

    this.guildUnsub = onSnapshot(
      docRef,
      (docSnap) => {
        const s = useAppStore.getState();
        if (docSnap.exists()) {
          const data = readGuildData(docSnap.data(), guildId);
          s.setGuildData(data);
          s.setSeasonPairs(data.seasonPairs ?? null);
          s.setStatusMessage('');
          return;
        }
        if (s.guildDocCreationInFlight) return;
        s.setGuildDocCreationInFlight(true);
        s.setStatusMessage('Setting up session...');
        this.createGuildEntry(guildId, s.discordChannelId)
          .catch((err) => {
            reportError(err, { tag: 'firestoreService.createGuildEntry' });
            useAppStore.getState().setStatusMessage('Failed to set up session. Please try again.');
          })
          .finally(() => {
            useAppStore.getState().setGuildDocCreationInFlight(false);
          });
      },
      (error) => {
        // Report only on the first failure to avoid 5x amplification across the
        // retry chain. The status-message UX is driven separately by scheduleRetry.
        if (retryCount === 0) {
          reportError(error, { tag: 'firestoreService.guildListener' });
        }
        this.scheduleRetry('guildRetryTimer', 'guild', retryCount, error, () =>
          this.subscribeToGuild(guildId, retryCount + 1),
        );
      },
    );

    return () => {
      this.clearRetry('guildRetryTimer');
      this.guildUnsub?.();
      this.guildUnsub = null;
    };
  }

  subscribeToChannel(channelId: string, retryCount = 0): () => void {
    this.clearRetry('channelRetryTimer');
    this.clearChannelMissingTimer();
    this.channelUnsub?.();
    this.channelUnsub = null;

    const docRef = doc(db, 'channels', channelId);

    this.channelUnsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          this.clearChannelMissingTimer();
          const { value, issues } = decodeChannelData(docSnap.data(), channelId);
          reportDecodeIssues('firestoreService.decodeChannel', `channels/${channelId}`, issues);
          useAppStore.getState().setChannelData(value);
          return;
        }
        // The listener fires `exists()=false` during normal lifecycle —
        // before `selectChannel` finishes creating the doc, or before the bot
        // has written it on activity launch. Only escalate if the doc is
        // still missing after a grace period AND the user is on a view that
        // depends on channel data; on home/channels the doc may legitimately
        // not exist yet (URL/Discord SDK sets currentChannelId before the
        // user has selected a channel, which is what bootstraps the doc).
        if (this.channelMissingTimer === null) {
          this.channelMissingTimer = setTimeout(() => {
            this.channelMissingTimer = null;
            const view = useAppStore.getState().currentView;
            if (view === 'home' || view === 'channels') return;
            reportError(
              new Error(`No doc at channels/${channelId} after ${CHANNEL_DOC_MISSING_GRACE_MS}ms`),
              { tag: 'firestoreService.channelDocMissing', extra: { channelId, view } },
            );
          }, CHANNEL_DOC_MISSING_GRACE_MS);
        }
      },
      (error) => {
        if (retryCount === 0) {
          reportError(error, { tag: 'firestoreService.channelListener' });
        }
        this.scheduleRetry('channelRetryTimer', 'channel', retryCount, error, () =>
          this.subscribeToChannel(channelId, retryCount + 1),
        );
      },
    );

    return () => {
      this.clearRetry('channelRetryTimer');
      this.clearChannelMissingTimer();
      this.channelUnsub?.();
      this.channelUnsub = null;
    };
  }

  private clearChannelMissingTimer(): void {
    if (this.channelMissingTimer !== null) {
      clearTimeout(this.channelMissingTimer);
      this.channelMissingTimer = null;
    }
  }

  /**
   * Follow the preferences docs for these players (the lobby members plus the
   * current user) and keep `profiles` in the store current. Local writes show
   * up immediately through Firestore's latency compensation, so edits need no
   * optimistic store update.
   */
  subscribeToProfiles(discordIds: string[]): () => void {
    const wanted = new Set(discordIds);
    // Replace one chunk's entries: every ID in it is now known, with or
    // without a doc. Also drops IDs no longer wanted.
    const applyChunk = (chunk: string[], docs: Map<string, PlayerPreferences>) => {
      const store = useAppStore.getState();
      const next: Profiles = {};
      for (const [id, prefs] of Object.entries(store.profiles)) {
        if (wanted.has(id)) next[id] = prefs;
      }
      for (const id of chunk) next[id] = docs.get(id) ?? null;
      store.setProfiles(next);
    };
    const unsubs = chunkIds(discordIds).map((chunk) => onSnapshot(
      query(collection(db, 'preferences'), where(documentId(), 'in', chunk)),
      (snap) => applyChunk(chunk, new Map(snap.docs.map((d) => [d.id, parsePlayerPreferences(d.data())]))),
      (err) => {
        reportError(err, { tag: 'firestoreService.profilesListener' });
        // Show these players without profiles rather than waiting forever.
        const known = useAppStore.getState().profiles;
        applyChunk(chunk, new Map(chunk.flatMap((id) => {
          const prefs = known[id];
          return prefs ? [[id, prefs] as const] : [];
        })));
      },
    ));
    return () => unsubs.forEach((unsub) => unsub());
  }

  subscribeToSeasonConfig(): () => void {
    const ref = doc(db, 'config', 'season');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          useAppStore.getState().setSeasonConfig(null);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        if (
          typeof data.slug === 'string' &&
          typeof data.blizzardSeasonId === 'number' &&
          typeof data.expansionId === 'number'
        ) {
          useAppStore.getState().setSeasonConfig({
            slug: data.slug,
            blizzardSeasonId: data.blizzardSeasonId,
            expansionId: data.expansionId,
          });
        }
      },
      (err) => reportError(err, { tag: 'firestoreService.seasonConfig' }),
    );
    return () => unsub();
  }

  async requestSpin(): Promise<void> {
    const { currentChannelId, channelData, guildData, players: lobbyPlayers } = useAppStore.getState();
    if (!currentChannelId || !channelData) return;

    const guildId = channelData.guildId || null;
    const today = todayPST();

    // Restore today's group history so the algorithm avoids repeat
    // groupings. It was validated when the guild doc was decoded.
    const existingRounds = todaysRounds(guildData, today);
    setGroupHistory(existingRounds.map(round => round.map(g => WoWGroup.fromDict(g))), guildId);

    const players = eligibleSpinPlayers(lobbyPlayers, channelData.sittingOut ?? []);

    const groups = createMythicPlusGroups(players, true, guildId);
    const groupDicts = groups.map(g => g.toDict());

    // Start the round first. The rules reject it if a round is already
    // spinning (e.g. a second Spin click), and in that case nothing below
    // should be recorded.
    await authReady;
    const channelRef = doc(db, 'channels', currentChannelId);
    await updateDoc(channelRef, {
      status: 'spinning',
      groups: groupDicts,
      revealedGroups: 0,
    });

    // Persist group history to guild doc for cross-session diversity.
    // Intentionally not awaited — history save should not block the spin.
    if (guildId) {
      const guildDocRef = doc(db, 'guilds', guildId);
      const wireRounds = encodeGroupHistoryRounds([...existingRounds, groupDicts]);
      setDoc(guildDocRef, {
        groupHistory: { date: today, rounds: wireRounds },
      }, { merge: true }).catch(err => reportError(err, { tag: 'firestoreService.saveGroupHistory' }));

      // Bump season pair counts for cross-session affinity tracking. Skip
      // for debug channels so test spins don't pollute the real tally.
      if (!(channelData.isDebug ?? false)) {
        const { seasonConfig: cfg, seasonPairs: existing } = useAppStore.getState();
        const update = cfg ? seasonPairsUpdate(existing, cfg.slug, groups, increment) : null;
        if (update) {
          setDoc(guildDocRef, update.data, update.options).catch((err) =>
            reportError(err, { tag: 'firestoreService.saveSeasonPairs' }),
          );
        }
      }
    }
  }

  async revealAllGroups(): Promise<void> {
    const { currentChannelId, fullGroups } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { revealedGroups: fullGroups.length });
  }

  async finishSequence(): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { status: 'completed' });
  }

  async newRound(): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] });
  }

  async cancelToLobby(): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);
    // Intentionally reset sittingOut on cancel — "sit out this round" applies to the
    // round that was cancelled, so players re-enter the pool for the next attempt.
    await updateDoc(docRef, { status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] });
  }

  async saveRoles(playerId: string, roles: string[], inGameName: string): Promise<void> {
    await authReady;
    const prefRef = doc(db, 'preferences', playerId);
    await setDoc(prefRef, {
      roles,
      inGameName,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async saveLinkedCharacter(
    playerId: string,
    linkedCharacter: { name: string; realm: string; region: string },
    mediaUrl?: string | null,
    characterClass?: CharacterClass | null,
  ): Promise<void> {
    await authReady;
    const prefRef = doc(db, 'preferences', playerId);
    const payload: Record<string, unknown> = { linkedCharacter, updatedAt: serverTimestamp() };
    if (mediaUrl !== undefined) {
      payload.mediaUrl = mediaUrl;
      payload.mediaUrlUpdatedAt = serverTimestamp();
    }
    if (characterClass !== undefined) payload.characterClass = characterClass;
    await setDoc(prefRef, payload, { merge: true });
  }

  async refreshChannels(guildId: string): Promise<void> {
    await authReady;
    const docRef = doc(db, 'guilds', guildId);
    await updateDoc(docRef, { refreshRequest: serverTimestamp() });
  }

  async selectChannel(channelId: string, channelName: string, guildId: string): Promise<void> {
    await authReady;
    await ensureLobby(db, channelId, channelName || '', guildId);
  }

  async reportBadGroup(title: string, description: string): Promise<void> {
    const { channelData, guildData, currentPlayerName, currentPlayerId, players: lobbyPlayers } = useAppStore.getState();
    if (!channelData) return;

    // Use the players actually in the spin output, not the lobby roster —
    // voice-channel membership drifts (people leave to start the dungeon)
    // between spin and report, which would otherwise silently truncate the
    // input list and make the report unreproducible.
    const playersFromGroups = channelData.groups.flatMap((g) => {
      const members: WoWPlayerDict[] = [];
      if (g.tank) members.push(g.tank);
      if (g.healer) members.push(g.healer);
      if (g.dps) members.push(...g.dps);
      return members;
    });
    const players = playersFromGroups.length > 0 ? playersFromGroups : lobbyPlayers;

    // Read fresh guild history rather than trusting the cached `guildData`,
    // which can lag the spin's own `setDoc` if the user clicks Report before
    // the onSnapshot listener has caught up. Falls back to the cached value
    // on read failure so a transient network blip still produces a report
    // (without history) instead of dropping it entirely.
    let freshGuildData = guildData;
    if (channelData.guildId) {
      try {
        const snap = await getDoc(doc(db, 'guilds', channelData.guildId));
        if (snap.exists()) freshGuildData = readGuildData(snap.data(), channelData.guildId);
      } catch (err) {
        reportError(err, { tag: 'firestoreService.reportBadGroup.getGuildDoc' });
      }
    }

    // Prior rounds = persisted group history minus the round being reported.
    // The algorithm's pair-history scoring depends on these, so omitting them
    // makes "shouldn't have grouped me with X again" complaints undebuggable.
    const allRounds = todaysRounds(freshGuildData, todayPST());
    const priorRounds = allRounds.slice(0, Math.max(0, allRounds.length - 1));

    await authReady;
    await addDoc(collection(db, 'badGroupReports'), {
      title,
      description,
      reporterName: currentPlayerName || 'Unknown',
      reporterId: currentPlayerId || 'Unknown',
      guildId: channelData.guildId || null,
      players,
      groups: channelData.groups,
      priorRounds: encodeGroupHistoryRounds(priorRounds),
      createdAt: serverTimestamp(),
    });
  }

  async claimPlayer(playerId: string): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { claimedPlayers: arrayUnion(playerId) });
  }

  async unclaimPlayer(playerId: string): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { claimedPlayers: arrayRemove(playerId) });
  }

  async toggleSitOut(discordId: string): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    await authReady;
    const docRef = doc(db, 'channels', currentChannelId);

    // Use a transaction to read authoritative Firestore state and toggle atomically,
    // avoiding stale local state from the Zustand store / onSnapshot listener
    await runTransaction(db, async (transaction) => {
      const channelDoc = await transaction.get(docRef);
      if (!channelDoc.exists()) return;

      const { sittingOut } = channelDoc.data();
      const current: unknown[] = Array.isArray(sittingOut) ? sittingOut : [];
      if (current.includes(discordId)) {
        transaction.update(docRef, { sittingOut: arrayRemove(discordId) });
      } else {
        transaction.update(docRef, { sittingOut: arrayUnion(discordId) });
      }
    });
  }

  async createGuildEntry(guildId: string, discordChannelId: string | null): Promise<void> {
    if (!/^\d+$/.test(guildId) && guildId !== 'demo-guild') {
      // Precondition check on URL-derived input — a user opening a malformed
      // activity link is bad input, not an actionable error.
      console.warn(`[Wheelson] Invalid guild ID: ${guildId}`);
      return;
    }

    await authReady;
    // Merge: the "missing" snapshot that triggers this can come from the local
    // cache, and an overwrite would wipe the guild's group history and season
    // pair counts. The lobby is only created if it doesn't exist.
    const guildDocRef = doc(db, 'guilds', guildId);
    await setDoc(guildDocRef, {
      guildId,
      voiceChannels: [],
      refreshRequest: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true });

    if (discordChannelId) {
      await ensureLobby(db, discordChannelId, '', guildId);
    }
  }
}

export const firestoreService = new FirestoreSessionService();
