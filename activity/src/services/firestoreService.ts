import { doc, collection, addDoc, onSnapshot, updateDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { GuildData, ChannelData } from '../types';
import { useAppStore } from '../store/store';
import type { SessionService } from './types';
import {
  WoWGroup,
  createMythicPlusGroups,
  decodeGroupHistoryRounds,
  encodeGroupHistoryRounds,
  setGroupHistory,
  todayPST,
} from '@mythicplus/shared';
import type { CharacterClass, WoWGroupDict } from '@mythicplus/shared';
import { reportError } from '../lib/sentry';
import { eligibleSpinPlayers } from '../lib/spinEligibility';

const MAX_LISTENER_RETRIES = 5;
const NON_RECOVERABLE_CODES = new Set(['permission-denied', 'not-found', 'unauthenticated']);

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
 * Parse the persisted group history from a guild doc. Returns empty rounds
 * when the date doesn't match today or the data is malformed — the spin
 * should never be blocked by stale or bad history. Wire-shape normalization
 * (wrapped vs legacy flat) is handled by `decodeGroupHistoryRounds`.
 */
function parseExistingRounds(
  guildData: GuildData | null | undefined,
  todayIso: string,
): WoWGroupDict[][] {
  const history = guildData?.groupHistory;
  if (!history || history.date !== todayIso || !Array.isArray(history.rounds)) {
    return [];
  }
  return decodeGroupHistoryRounds(history.rounds);
}

class FirestoreSessionService implements SessionService {
  private guildUnsub: (() => void) | null = null;
  private channelUnsub: (() => void) | null = null;
  private guildRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private channelRetryTimer: ReturnType<typeof setTimeout> | null = null;

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
          s.setGuildData(docSnap.data() as GuildData);
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
        reportError(error, { tag: 'firestoreService.guildListener', extra: { retryCount } });
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
    this.channelUnsub?.();
    this.channelUnsub = null;

    const docRef = doc(db, 'channels', channelId);

    this.channelUnsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          useAppStore.getState().setChannelData(docSnap.data() as ChannelData);
        } else {
          // Expected during normal lifecycle: the listener fires before
          // selectChannel finishes creating the doc, or before the bot has
          // written it on activity launch. The next snapshot will arrive once
          // the doc is created; the UI shows "Loading..." in the meantime.
          console.warn(`[Wheelson] No doc at channels/${channelId}`);
        }
      },
      (error) => {
        reportError(error, { tag: 'firestoreService.channelListener', extra: { retryCount } });
        this.scheduleRetry('channelRetryTimer', 'channel', retryCount, error, () =>
          this.subscribeToChannel(channelId, retryCount + 1),
        );
      },
    );

    return () => {
      this.clearRetry('channelRetryTimer');
      this.channelUnsub?.();
      this.channelUnsub = null;
    };
  }

  async requestSpin(): Promise<void> {
    const { currentChannelId, channelData, guildData } = useAppStore.getState();
    if (!currentChannelId || !channelData) return;

    const guildId = channelData.guildId || null;
    const today = todayPST();

    // Restore group history from Firestore so the algorithm avoids repeat
    // groupings. Malformed history should never block a spin — fall back to
    // empty history.
    let existingRounds: WoWGroupDict[][] = [];
    try {
      existingRounds = parseExistingRounds(guildData, today);
      const rounds = existingRounds.map(round => round.map(g => WoWGroup.fromDict(g)));
      setGroupHistory(rounds, guildId);
    } catch (err) {
      reportError(err, { tag: 'firestoreService.restoreGroupHistory' });
      existingRounds = [];
      setGroupHistory([], guildId);
    }

    const players = eligibleSpinPlayers(channelData.players, channelData.sittingOut ?? []);

    const groups = createMythicPlusGroups(players, true, guildId);
    const groupDicts = groups.map(g => g.toDict());

    // Persist group history to guild doc for cross-session diversity.
    // Intentionally not awaited — history save should not block the spin.
    if (guildId) {
      const guildDocRef = doc(db, 'guilds', guildId);
      const wireRounds = encodeGroupHistoryRounds([...existingRounds, groupDicts]);
      setDoc(guildDocRef, {
        groupHistory: { date: today, rounds: wireRounds },
      }, { merge: true }).catch(err => reportError(err, { tag: 'firestoreService.saveGroupHistory' }));
    }

    const channelRef = doc(db, 'channels', currentChannelId);
    await updateDoc(channelRef, {
      status: 'spinning',
      groups: groupDicts,
      revealedGroups: 0,
    });
  }

  async revealAllGroups(): Promise<void> {
    const { currentChannelId, fullGroups } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { revealedGroups: fullGroups.length });
  }

  async finishSequence(): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { status: 'completed' });
  }

  async newRound(): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] });
  }

  async cancelToLobby(): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    // Intentionally reset sittingOut on cancel — "sit out this round" applies to the
    // round that was cancelled, so players re-enter the pool for the next attempt.
    await updateDoc(docRef, { status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] });
  }

  async saveRoles(playerId: string, playerName: string, roles: string[], inGameName?: string): Promise<void> {
    const prefRef = doc(db, 'preferences', playerId);
    await setDoc(prefRef, {
      roles,
      wowName: playerName,
      inGameName: inGameName ?? '',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const { currentChannelId } = useAppStore.getState();
    if (currentChannelId) {
      const channelRef = doc(db, 'channels', currentChannelId);
      await updateDoc(channelRef, { refreshPlayers: true });
    }
  }

  async saveLinkedCharacter(
    playerId: string,
    linkedCharacter: { name: string; realm: string; region: string },
    mediaUrl?: string | null,
    characterClass?: CharacterClass | null,
  ): Promise<void> {
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
    const docRef = doc(db, 'guilds', guildId);
    await updateDoc(docRef, { refreshRequest: serverTimestamp() });
  }

  async selectChannel(channelId: string, channelName: string, guildId: string): Promise<void> {
    const channelDocRef = doc(db, 'channels', channelId);
    await setDoc(channelDocRef, {
      channelId,
      channelName: channelName || '',
      guildId,
      status: 'lobby',
      groups: [],
      sittingOut: [],
      isDebug: false,
      refreshPlayers: true,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true });
  }

  async reportBadGroup(title: string, description: string): Promise<void> {
    const { channelData, currentPlayerName, currentPlayerId } = useAppStore.getState();
    if (!channelData) return;

    await addDoc(collection(db, 'badGroupReports'), {
      title,
      description,
      reporterName: currentPlayerName || 'Unknown',
      reporterId: currentPlayerId || 'Unknown',
      guildId: channelData.guildId || null,
      players: channelData.players,
      groups: channelData.groups,
      createdAt: serverTimestamp(),
    });
  }

  async claimPlayer(playerId: string): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { claimedPlayers: arrayUnion(playerId) });
  }

  async unclaimPlayer(playerId: string): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);
    await updateDoc(docRef, { claimedPlayers: arrayRemove(playerId) });
  }

  async toggleSitOut(discordId: string): Promise<void> {
    const { currentChannelId } = useAppStore.getState();
    if (!currentChannelId) return;
    const docRef = doc(db, 'channels', currentChannelId);

    // Use a transaction to read authoritative Firestore state and toggle atomically,
    // avoiding stale local state from the Zustand store / onSnapshot listener
    await runTransaction(db, async (transaction) => {
      const channelDoc = await transaction.get(docRef);
      if (!channelDoc.exists()) return;

      const data = channelDoc.data();
      const current: string[] = data.sittingOut ?? [];
      if (current.includes(discordId)) {
        transaction.update(docRef, { sittingOut: arrayRemove(discordId) });
      } else {
        transaction.update(docRef, { sittingOut: arrayUnion(discordId) });
      }
    });
  }

  async createGuildEntry(guildId: string, discordChannelId: string | null): Promise<void> {
    if (!/^\d+$/.test(guildId) && guildId !== 'demo-guild') {
      reportError(new Error(`Invalid guild ID: ${guildId}`), {
        tag: 'firestoreService.createGuildEntry',
        extra: { guildId },
      });
      return;
    }

    const guildDocRef = doc(db, 'guilds', guildId);
    await setDoc(guildDocRef, {
      guildId,
      voiceChannels: [],
      refreshRequest: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });

    if (discordChannelId) {
      const channelDocRef = doc(db, 'channels', discordChannelId);
      await setDoc(channelDocRef, {
        channelId: discordChannelId,
        channelName: '',
        guildId,
        status: 'lobby',
        players: [],
        groups: [],
        isDebug: false,
        refreshPlayers: true,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      });
    }
  }
}

export const firestoreService = new FirestoreSessionService();
