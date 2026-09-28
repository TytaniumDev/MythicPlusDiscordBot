import type { Decorator } from '@storybook/react-vite';
import { useEffect } from 'react';
import { useAppStore } from '../src/store/store';
import { splitPlayers } from '../src/lib/profiles';
import { mockProfiles } from '../src/lib/mockData';
import type { AppState } from '../src/store/types';
import type { WoWPlayer } from '../src/types';

type StoreOverrides = Partial<Pick<AppState,
  | 'currentPlayerId'
  | 'currentPlayerName'
  | 'identityResolved'
  | 'channelData'
  | 'guildData'
  | 'isDemoMode'
  | 'currentGuildId'
  | 'currentChannelId'
  | 'statusMessage'
  | 'seasonConfig'
  | 'seasonPairs'
  | 'profiles'
>> & {
  /**
   * The lobby roster as the screens show it. Split into the lobby doc's
   * `members` and `profiles`, replacing whatever `channelData` carries.
   * Without it, `profiles` defaults to `mockProfiles` — the preferences
   * behind `mockChannelData`'s members.
   */
  players?: WoWPlayer[];
};

/**
 * Decorator that pre-populates the Zustand store for stories.
 * Resets to defaults on unmount to avoid cross-story bleed.
 */
export function withStore(overrides: StoreOverrides): Decorator {
  return (Story) => {
    useEffect(() => {
      const { players, channelData, profiles, ...rest } = overrides;
      const store = useAppStore.getState();
      useAppStore.setState(rest);
      if (players) {
        const split = splitPlayers(players);
        store.setProfiles({ ...profiles, ...split.profiles });
        store.setChannelData(channelData ? { ...channelData, members: split.members } : null);
      } else {
        store.setProfiles(profiles ?? mockProfiles);
        if (channelData !== undefined) store.setChannelData(channelData);
      }
      return () => {
        useAppStore.getState().resetSession();
      };
    }, []);
    return <Story />;
  };
}
