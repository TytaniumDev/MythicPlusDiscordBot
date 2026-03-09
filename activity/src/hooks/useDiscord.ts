import { useEffect, useState } from 'react';
import { setupDiscordSdk, DiscordContext } from '../discordSdk';

export function useDiscord() {
  const [context, setContext] = useState<DiscordContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupDiscordSdk().then((ctx) => {
      setContext(ctx);
      setLoading(false);
    });
  }, []);

  return { context, loading };
}
