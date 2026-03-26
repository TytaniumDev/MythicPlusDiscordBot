import type { ViewName } from '../store/types';

export function statusToView(status: string): ViewName {
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

export function routeToView(hash: string): { view: ViewName; guildId: string | null } {
  if (!hash || hash === '#/') return { view: 'home', guildId: null };
  const match = hash.match(/^#\/guild\/([\w-]+)\/(channels|identity|setup|lobby|wheels|results)$/);
  if (match) return { view: match[2] as ViewName, guildId: match[1] };
  return { view: 'home', guildId: null };
}

export function viewToRoute(view: ViewName, guildId?: string | null): string {
  if (view === 'home' || !guildId) return '#/';
  return `#/guild/${guildId}/${view}`;
}
