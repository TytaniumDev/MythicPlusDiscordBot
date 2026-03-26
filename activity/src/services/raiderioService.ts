// Note: This endpoint is not part of Raider.io's official public API and may change without notice.
// If it breaks, fall back to manual character name entry (the search is a convenience, not a requirement).

export interface RaiderioCharacterResult {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  className: string;
}

interface RaiderioSearchMatch {
  type: string;
  data: {
    name: string;
    class: { name: string };
    realm: { name: string; slug: string };
    region: { slug: string };
  };
}

interface RaiderioSearchResponse {
  matches: RaiderioSearchMatch[];
}

function isCharacterMatch(m: RaiderioSearchMatch): m is RaiderioSearchMatch & { type: 'character' } {
  return m.type === 'character';
}

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
    console.warn('[Wheelson] Raider.io profile lookup failed:', err);
    return null;
  }
}

export async function searchCharacters(
  query: string,
  signal?: AbortSignal,
): Promise<RaiderioCharacterResult[]> {
  const response = await fetch(
    `https://raider.io/api/search?term=${encodeURIComponent(query)}`,
    { signal },
  );

  if (!response.ok) return [];

  const data: RaiderioSearchResponse = await response.json();

  return (data.matches ?? [])
    .filter(isCharacterMatch)
    .map((m) => ({
      name: m.data.name,
      realm: m.data.realm.name,
      realmSlug: m.data.realm.slug,
      region: m.data.region.slug,
      className: m.data.class.name,
    }));
}
