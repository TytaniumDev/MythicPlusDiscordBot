import type { Decorator } from '@storybook/react-vite';
import { useEffect } from 'react';
import { useAppStore } from '../src/store/store';
import type { AppState } from '../src/store/types';

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
  | 'currentCharacter'
>>;

/**
 * Decorator that pre-populates the Zustand store for stories.
 * Resets to defaults on unmount to avoid cross-story bleed.
 */
export function withStore(overrides: StoreOverrides): Decorator {
  return (Story) => {
    useEffect(() => {
      useAppStore.setState(overrides);
      return () => {
        useAppStore.getState().resetSession();
      };
    }, []);
    return <Story />;
  };
}
