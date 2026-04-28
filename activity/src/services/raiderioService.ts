// Note: This endpoint is not part of Raider.io's official public API and may change without notice.
// Only used by demo mode — production lookups go through the `lookupCharacter` Cloud Function.
import { reportError } from '../lib/sentry';

interface RaiderioProfileResponse {
  name: string;
  realm: string;
  class: string;
  active_spec_name: string;
  active_spec_role: string;
  thumbnail_url: string;
}

export interface RaiderioCharacterProfile {
  name: string;
  realm: string;
  className: string;
  role: string;
  thumbnailUrl: string;
}

export async function lookupCharacterProfile(
  name: string,
  realm: string,
  region: string,
  signal?: AbortSignal,
): Promise<RaiderioCharacterProfile | null> {
  try {
    const response = await fetch(
      `https://raider.io/api/v1/characters/profile?region=${encodeURIComponent(region)}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}`,
      { signal },
    );

    if (!response.ok) return null;

    const data: RaiderioProfileResponse = await response.json();

    // Convert the small avatar thumbnail to a larger inset render
    const thumbnailUrl = data.thumbnail_url
      ? data.thumbnail_url.replace('-avatar.jpg', '-inset.jpg')
      : '';

    return {
      name: data.name,
      realm: data.realm,
      className: data.class,
      role: data.active_spec_role?.toLowerCase() ?? '',
      thumbnailUrl,
    };
  } catch (err) {
    // Don't report environment failures (offline, abort, generic fetch failure).
    // Demo mode is contributor-facing; offline runs of Storybook etc. would
    // otherwise produce noise without an actionable bug.
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TypeError')) {
      return null;
    }
    reportError(err, { tag: 'raiderioService.fetchProfile' });
    return null;
  }
}
