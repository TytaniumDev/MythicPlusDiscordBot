import { doc, collection, addDoc, onSnapshot, updateDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { GuildData, ChannelData } from '../types';
import { useAppStore } from '../store/store';
import type { SessionService } from './types';
import { WoWPlayer, WoWGroup, createMythicPlusGroups, setGroupHistory } from '@mythicplus/shared';
import { reportError } from '../lib/sentry';

const MAX_LISTENER_RETRIES = 5;

function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    if (code === 'permission-denied' || code === 'not-found' || code === 'unauthenticated') {
      return false;
    }
  }
  return true;
}

class FirestoreSessionService implements SessionService {
  private guildUnsub: (() => void) | null = null;
  private channelUnsub: (() => void) | null = null;

  subscribeToGuild(guildId: string, retryCount = 0): () => void {
    if (this.guildUnsub) {
      this.guildUnsub();
      this.guildUnsub = null;
    }

    const store = useAppStore.getState();
    const docRef = doc(db, 'guilds', guildId);

    this.guildUnsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const s = useAppStore.getState();
          s.setGuildData(docSnap.data() as GuildData);
          s.setStatusMessage('');
        } else {
          const s = useAppStore.getState();
          if (!s.guildDocCreationInFlight) {
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
          }
        }
      },
      (error) => {
        reportError(error, { tag: 'firestoreService.guildListener', extra: { retryCount } });
        if (isRecoverableError(error) && retryCount < MAX_LISTENER_RETRIES) {
          const delayMs = Math.min(1000 * 2 ** retryCount, 30000);
          console.info(`[Wheelson] Retrying guild listener in ${delayMs}ms (attempt ${retryCount + 1})`);
          store.setStatusMessage('Connection lost. Reconnecting...');
          setTimeout(() => this.subscribeToGuild(guildId, retryCount + 1), delayMs);
        } else {
          useAppStore.getState().setStatusMessage('Connection lost. Please refresh to try again.');
        }
      },
    );

    return () => {
      if (this.guildUnsub) {
        this.guildUnsub();
        this.guildUnsub = null;
      }
    };
  }

  subscribeToChannel(channelId: string, retryCount = 0): () => void {
    if (this.channelUnsub) {
      this.channelUnsub();
      this.channelUnsub = null;
    }

    const store = useAppStore.getState();
    const docRef = doc(db, 'channels', channelId);

    this.channelUnsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          useAppStore.getState().setChannelData(docSnap.data() as ChannelData);
        } else {
          console.warn('[Wheelson] No doc at channels/' + channelId);
        }
      },
      (error) => {
        reportError(error, { tag: 'firestoreService.channelListener', extra: { retryCount } });
        if (isRecoverableError(error) && retryCount < MAX_LISTENER_RETRIES) {
          const delayMs = Math.min(1000 * 2 ** retryCount, 30000);
          console.info(`[Wheelson] Retrying channel listener in ${delayMs}ms (attempt ${retryCount + 1})`);
          store.setStatusMessage('Connection lost. Reconnecting...');
          setTimeout(() => this.subscribeToChannel(channelId, retryCount + 1), delayMs);
        } else {
          useAppStore.getState().setStatusMessage('Connection lost. Please refresh to try again.');
        }
      },
    );

    return () => {
      if (this.channelUnsub) {
        this.channelUnsub();
        this.channelUnsub = null;
      }
    };
  }

  async requestSpin(): Promise<void> {
    const { currentChannelId, channelData, guildData } = useAppStore.getState();
    if (!currentChannelId || !channelData) return;

    const guildId = channelData.guildId || null;

    // Restore group history from Firestore so the algorithm avoids repeat groupings.
    // Wire format wraps each round as { groups: [...] } because Firestore rejects nested
    // arrays. Tolerate the legacy flat shape in case older data ever lands in the doc.
    // Malformed history should never block a spin — fall back to empty history.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    let existingRounds: Record<string, unknown>[][] = [];
    try {
      if (
        guildData?.groupHistory &&
        guildData.groupHistory.date === today &&
        Array.isArray(guildData.groupHistory.rounds)
      ) {
        existingRounds = (guildData.groupHistory.rounds as unknown[]).map((r) => {
          if (r && typeof r === 'object' && 'groups' in r && Array.isArray((r as { groups: unknown }).groups)) {
            return (r as { groups: Record<string, unknown>[] }).groups;
          }
          return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
        });
        const rounds = existingRounds.map(round =>
          round.map(g => WoWGroup.fromDict(g)),
        );
        setGroupHistory(rounds, guildId);
      } else {
        setGroupHistory([], guildId);
      }
    } catch (err) {
      reportError(err, { tag: 'firestoreService.restoreGroupHistory' });
      existingRounds = [];
      setGroupHistory([], guildId);
    }

    const sittingOut = channelData.sittingOut ?? [];
    const players = channelData.players
      .filter(p => p.mainRole !== null || p.offspecs.length > 0)
      .filter(p => !p.discordId || !sittingOut.includes(p.discordId))
      .map(p => WoWPlayer.fromDict(p));

    const groups = createMythicPlusGroups(players, true, guildId);

    // Persist group history to guild doc for cross-session diversity.
    // Intentionally not awaited — history save should not block the spin.
    if (guildId) {
      const guildDocRef = doc(db, 'guilds', guildId);
      const newRound = groups.map(g => g.toDict());
      // Wrap each round as { groups: [...] } — Firestore rejects nested arrays.
      const wireRounds = [...existingRounds, newRound].map(round => ({ groups: round }));
      setDoc(guildDocRef, {
        groupHistory: { date: today, rounds: wireRounds },
      }, { merge: true }).catch(err => reportError(err, { tag: 'firestoreService.saveGroupHistory' }));
    }

    const channelRef = doc(db, 'channels', currentChannelId);
    await updateDoc(channelRef, {
      status: 'spinning',
      groups: groups.map(g => g.toDict()),
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
  ): Promise<void> {
    const prefRef = doc(db, 'preferences', playerId);
    const payload: Record<string, unknown> = { linkedCharacter, updatedAt: serverTimestamp() };
    if (mediaUrl !== undefined) payload.mediaUrl = mediaUrl;
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
      console.error('[Wheelson] Invalid guild ID:', guildId);
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
