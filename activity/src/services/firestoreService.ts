import { doc, collection, addDoc, getDoc, onSnapshot, updateDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { authReady, db } from '../firebase';
import type { GuildData, WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import type { BadGroupReportInput, SessionService } from './types';
import { encodeGroupHistoryRounds, parsePlayerPreferences, todayPST } from '@mythicplus/shared';
import type { CharacterClass, PlayerPreferences } from '@mythicplus/shared';
import { reportError } from '../lib/sentry';
import { decodeChannelData, decodeGuildData, reportDecodeIssues } from './firestoreDecoders';
import { ensureLobby, lobbyReset, startSpin, todaysRounds } from './lobby';

const CHANNEL_DOC_MISSING_GRACE_MS = 10000;
// A listener's error callback is final: the SDK retries network trouble on its
// own and only gives up for good (e.g. a rules rejection).
const LISTENER_FAILED_MESSAGE = 'Connection lost. Please refresh to try again.';

/** Decode a guild snapshot and report anything malformed in it. */
function readGuildData(raw: unknown, guildId: string): GuildData {
  const { value, issues } = decodeGuildData(raw, guildId);
  reportDecodeIssues('firestoreService.decodeGuild', `guilds/${guildId}`, issues);
  return value;
}

/** Set one player's profile in the store; null when they have no preferences doc. */
function setProfile(discordId: string, prefs: PlayerPreferences | null): void {
  const store = useAppStore.getState();
  store.setProfiles({ ...store.profiles, [discordId]: prefs });
}

// Every write awaits `authReady` first: firestore.rules reject writes from a
// client that hasn't finished its anonymous sign-in.
class FirestoreSessionService implements SessionService {
  private creatingGuild = false;
  private profileUnsubs = new Map<string, () => void>();

  subscribeToGuild(guildId: string, launchChannelId: string | null): () => void {
    return onSnapshot(
      doc(db, 'guilds', guildId),
      (docSnap) => {
        const s = useAppStore.getState();
        if (docSnap.exists()) {
          s.setGuildData(readGuildData(docSnap.data(), guildId));
          s.setStatusMessage('');
          return;
        }
        // Only the server can say the guild is new: offline, the cache
        // doesn't know about it either.
        if (docSnap.metadata.fromCache || this.creatingGuild) return;
        this.creatingGuild = true;
        s.setStatusMessage('Setting up session...');
        this.createGuildEntry(guildId, launchChannelId)
          .catch((err) => {
            reportError(err, { tag: 'firestoreService.createGuildEntry' });
            useAppStore.getState().setStatusMessage('Failed to set up session. Please try again.');
          })
          .finally(() => {
            this.creatingGuild = false;
          });
      },
      (error) => {
        reportError(error, { tag: 'firestoreService.guildListener' });
        useAppStore.getState().setStatusMessage(LISTENER_FAILED_MESSAGE);
      },
    );
  }

  subscribeToChannel(channelId: string): () => void {
    let missingTimer: ReturnType<typeof setTimeout> | null = null;
    const clearMissingTimer = () => {
      if (missingTimer !== null) clearTimeout(missingTimer);
      missingTimer = null;
    };

    const unsub = onSnapshot(
      doc(db, 'channels', channelId),
      (docSnap) => {
        if (docSnap.exists()) {
          clearMissingTimer();
          const { value, issues } = decodeChannelData(docSnap.data(), channelId);
          reportDecodeIssues('firestoreService.decodeChannel', `channels/${channelId}`, issues);
          useAppStore.getState().setChannelData(value);
          return;
        }
        // The listener fires `exists()=false` during normal lifecycle —
        // before `selectChannel` finishes creating the doc, or before the bot
        // has written it on activity launch. Only escalate if the server
        // still has no doc after a grace period AND the user is on a view that
        // depends on channel data; on home/channels the doc may legitimately
        // not exist yet (URL/Discord SDK sets currentChannelId before the
        // user has selected a channel, which is what bootstraps the doc).
        if (docSnap.metadata.fromCache || missingTimer !== null) return;
        missingTimer = setTimeout(() => {
          missingTimer = null;
          const view = useAppStore.getState().currentView;
          if (view === 'home' || view === 'channels') return;
          reportError(
            new Error(`No doc at channels/${channelId} after ${CHANNEL_DOC_MISSING_GRACE_MS}ms`),
            { tag: 'firestoreService.channelDocMissing', extra: { channelId, view } },
          );
        }, CHANNEL_DOC_MISSING_GRACE_MS);
      },
      (error) => {
        reportError(error, { tag: 'firestoreService.channelListener' });
        useAppStore.getState().setStatusMessage(LISTENER_FAILED_MESSAGE);
      },
    );

    return () => {
      clearMissingTimer();
      unsub();
    };
  }

  /**
   * Follow the preferences docs of exactly these players (the lobby members
   * plus the current user) and keep `profiles` in the store current. One
   * listener per doc, so a player joining or leaving adds or drops a single
   * listener instead of re-reading everyone's profile. Local writes show up
   * immediately through Firestore's latency compensation, so edits need no
   * optimistic store update. Pass [] to stop following.
   */
  followProfiles(discordIds: readonly string[]): void {
    const wanted = new Set(discordIds);
    const dropped = [...this.profileUnsubs.keys()].filter((id) => !wanted.has(id));
    if (dropped.length > 0) {
      for (const id of dropped) {
        this.profileUnsubs.get(id)?.();
        this.profileUnsubs.delete(id);
      }
      const store = useAppStore.getState();
      store.setProfiles(Object.fromEntries(Object.entries(store.profiles).filter(([id]) => wanted.has(id))));
    }

    for (const id of wanted) {
      if (this.profileUnsubs.has(id)) continue;
      this.profileUnsubs.set(id, onSnapshot(
        doc(db, 'preferences', id),
        (snap) => setProfile(id, snap.exists() ? parsePlayerPreferences(snap.data()) : null),
        (err) => {
          reportError(err, { tag: 'firestoreService.profileListener' });
          // Show this player without a profile rather than waiting forever.
          if (!(id in useAppStore.getState().profiles)) setProfile(id, null);
        },
      ));
    }
  }

  /**
   * Follow `config/season`, and through it the connection. Every live client
   * follows this doc and never writes it, so its snapshots' `fromCache` flag
   * flips only when the connection drops and comes back. The SDK reconnects
   * every listener by itself; this just tells the player it's happening.
   * Only a connection that was up can be lost: before the first server
   * snapshot (still connecting, or Playwright's stalled Firestore) nothing shows.
   */
  subscribeToSeasonConfig(): () => void {
    let connected = false;
    const unsub = onSnapshot(
      doc(db, 'config', 'season'),
      { includeMetadataChanges: true },
      (snap) => {
        const store = useAppStore.getState();
        if (!snap.metadata.fromCache) connected = true;
        store.setConnectionLost(connected && snap.metadata.fromCache);
        if (!snap.exists()) {
          store.setSeasonConfig(null);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        if (
          typeof data.slug === 'string' &&
          typeof data.blizzardSeasonId === 'number' &&
          typeof data.expansionId === 'number'
        ) {
          store.setSeasonConfig({
            slug: data.slug,
            blizzardSeasonId: data.blizzardSeasonId,
            expansionId: data.expansionId,
          });
        }
      },
      (err) => reportError(err, { tag: 'firestoreService.seasonConfig' }),
    );
    return () => {
      unsub();
      useAppStore.getState().setConnectionLost(false);
    };
  }

  async requestSpin(channelId: string, players: readonly WoWPlayer[], seasonSlug: string | null): Promise<void> {
    await authReady;
    await startSpin(db, channelId, players, seasonSlug);
  }

  async revealAllGroups(channelId: string, groupCount: number): Promise<void> {
    await authReady;
    await updateDoc(doc(db, 'channels', channelId), { revealedGroups: groupCount });
  }

  async finishSequence(channelId: string): Promise<void> {
    await authReady;
    await updateDoc(doc(db, 'channels', channelId), { status: 'completed' });
  }

  async newRound(channelId: string): Promise<void> {
    await authReady;
    await updateDoc(doc(db, 'channels', channelId), lobbyReset());
  }

  async cancelToLobby(channelId: string): Promise<void> {
    await authReady;
    await updateDoc(doc(db, 'channels', channelId), lobbyReset());
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

  async reportBadGroup({ title, description, reporterName, reporterId, lobby, lobbyPlayers }: BadGroupReportInput): Promise<void> {
    // Use the players actually in the spin output, not the lobby roster —
    // voice-channel membership drifts (people leave to start the dungeon)
    // between spin and report, which would otherwise silently truncate the
    // input list and make the report unreproducible.
    const playersFromGroups = lobby.groups.flatMap((g) => {
      const members: WoWPlayer[] = [];
      if (g.tank) members.push(g.tank);
      if (g.healer) members.push(g.healer);
      if (g.dps) members.push(...g.dps);
      return members;
    });
    const players = playersFromGroups.length > 0 ? playersFromGroups : lobbyPlayers;

    // Read the guild's history fresh: the report needs the rounds before this
    // one. A failed read still files the report, without history.
    let guild: GuildData | null = null;
    if (lobby.guildId) {
      try {
        const snap = await getDoc(doc(db, 'guilds', lobby.guildId));
        if (snap.exists()) guild = readGuildData(snap.data(), lobby.guildId);
      } catch (err) {
        reportError(err, { tag: 'firestoreService.reportBadGroup.getGuildDoc' });
      }
    }

    // Prior rounds = persisted group history minus the round being reported.
    // The algorithm's pair-history scoring depends on these, so omitting them
    // makes "shouldn't have grouped me with X again" complaints undebuggable.
    const allRounds = todaysRounds(guild, todayPST());
    const priorRounds = allRounds.slice(0, Math.max(0, allRounds.length - 1));

    await authReady;
    await addDoc(collection(db, 'badGroupReports'), {
      title,
      description,
      reporterName: reporterName || 'Unknown',
      reporterId: reporterId || 'Unknown',
      guildId: lobby.guildId || null,
      players,
      groups: lobby.groups,
      priorRounds: encodeGroupHistoryRounds(priorRounds),
      createdAt: serverTimestamp(),
    });
  }

  async claimPlayer(channelId: string, playerId: string): Promise<void> {
    await authReady;
    await updateDoc(doc(db, 'channels', channelId), { claimedPlayers: arrayUnion(playerId) });
  }

  async unclaimPlayer(channelId: string, playerId: string): Promise<void> {
    await authReady;
    await updateDoc(doc(db, 'channels', channelId), { claimedPlayers: arrayRemove(playerId) });
  }

  async setSittingOut(channelId: string, discordId: string, sittingOut: boolean): Promise<void> {
    await authReady;
    // Idempotent array ops say what the player wants, so there's nothing to
    // read first, and the change shows at once through latency compensation.
    await updateDoc(doc(db, 'channels', channelId), {
      sittingOut: sittingOut ? arrayUnion(discordId) : arrayRemove(discordId),
    });
  }

  private async createGuildEntry(guildId: string, launchChannelId: string | null): Promise<void> {
    if (!/^\d+$/.test(guildId) && guildId !== 'demo-guild') {
      // Precondition check on URL-derived input — a user opening a malformed
      // activity link is bad input, not an actionable error.
      console.warn(`[Wheelson] Invalid guild ID: ${guildId}`);
      return;
    }

    await authReady;
    // Merge: an overwrite would wipe the guild's group history and season pair
    // counts if the doc appeared meanwhile. The lobby is only created if it
    // doesn't exist.
    const guildDocRef = doc(db, 'guilds', guildId);
    await setDoc(guildDocRef, {
      guildId,
      voiceChannels: [],
      refreshRequest: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true });

    if (launchChannelId) {
      await ensureLobby(db, launchChannelId, '', guildId);
    }
  }
}

export const firestoreService = new FirestoreSessionService();
