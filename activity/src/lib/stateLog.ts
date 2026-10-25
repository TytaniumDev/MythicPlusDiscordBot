import { useAppStore } from '../store/store';
import type { AppState } from '../store/types';
import { logInfo, logWarn } from './log';

// Logs the app state changes a bug report needs to follow along: screen
// changes, the lobby's status and roster, the connection, and the status
// messages players see. Watching the store covers every way in, so the
// navigation code doesn't have to log each one.

export interface StateChange {
  message: string;
  /** A change for the worse, logged as a warning. */
  warn?: boolean;
}

function presence(value: unknown): string {
  return value ? 'set' : 'none';
}

/** What changed between two states, in the order a reader wants it. */
export function describeStateChanges(prev: AppState, next: AppState): StateChange[] {
  const changes: StateChange[] = [];
  if (prev.currentView !== next.currentView) {
    changes.push({ message: `screen: ${prev.currentView} → ${next.currentView}` });
  }
  if (!prev.currentGuildId !== !next.currentGuildId) {
    changes.push({ message: `guild: ${presence(prev.currentGuildId)} → ${presence(next.currentGuildId)}` });
  }
  if (!prev.currentChannelId !== !next.currentChannelId) {
    changes.push({ message: `channel: ${presence(prev.currentChannelId)} → ${presence(next.currentChannelId)}` });
  }
  if (!prev.guildData !== !next.guildData) {
    changes.push({ message: `guild doc: ${next.guildData ? 'loaded' : 'cleared'}` });
  }
  const prevStatus = prev.channelData?.status ?? 'none';
  const nextStatus = next.channelData?.status ?? 'none';
  if (prevStatus !== nextStatus) {
    changes.push({ message: `lobby status: ${prevStatus} → ${nextStatus}` });
  }
  const prevGroups = prev.channelData?.groups.length ?? 0;
  const nextGroups = next.channelData?.groups.length ?? 0;
  if (prevGroups !== nextGroups) {
    changes.push({ message: `round groups: ${prevGroups} → ${nextGroups}` });
  }
  const prevRevealed = prev.channelData?.revealedGroups ?? 0;
  const nextRevealed = next.channelData?.revealedGroups ?? 0;
  if (prevRevealed !== nextRevealed) {
    changes.push({ message: `revealed groups: ${prevRevealed} → ${nextRevealed}` });
  }
  const prevMembers = prev.channelData?.members?.length ?? 0;
  const nextMembers = next.channelData?.members?.length ?? 0;
  if (prevMembers !== nextMembers) {
    changes.push({ message: `lobby members: ${prevMembers} → ${nextMembers}` });
  }
  if (prev.currentPlayerId !== next.currentPlayerId) {
    const how = !prev.currentPlayerId ? 'none → set' : !next.currentPlayerId ? 'set → none' : 'switched';
    changes.push({ message: `my player: ${how}` });
  }
  if (prev.identityResolved !== next.identityResolved) {
    changes.push({ message: `identity: ${next.identityResolved ? 'resolved' : 'unresolved'}` });
  }
  if (!prev.verifiedDiscordId !== !next.verifiedDiscordId) {
    changes.push({ message: `Discord sign-in: ${next.verifiedDiscordId ? 'signed in' : 'signed out'}` });
  }
  if (prev.connectionLost !== next.connectionLost) {
    changes.push(next.connectionLost
      ? { message: 'connection: lost', warn: true }
      : { message: 'connection: back' });
  }
  if (next.statusMessage && next.statusMessage !== prev.statusMessage) {
    changes.push({ message: `status message: "${next.statusMessage}"` });
  }
  return changes;
}

/**
 * Log every state change `describeStateChanges` picks out, until the returned
 * stop is called. The first lobby to load also logs how long it took since
 * the page started, so a report can tell slow from stuck.
 */
export function watchStateForLogs(): () => void {
  let lobbyLoaded = false;
  return useAppStore.subscribe((next, prev) => {
    for (const change of describeStateChanges(prev, next)) {
      (change.warn ? logWarn : logInfo)('state', change.message);
    }
    if (!lobbyLoaded && next.channelData) {
      lobbyLoaded = true;
      logInfo('state', `first lobby loaded ${Math.round(performance.now())}ms after page start`);
    }
  });
}
