export interface RaiderioCharacterResult {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  className: string;
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

  const data = await response.json();

  return (data.matches ?? [])
    .filter((m: { type: string }) => m.type === 'character')
    .map((m: {
      data: {
        name: string;
        class: { name: string };
        realm: { name: string; slug: string };
        region: { slug: string };
      };
    }) => ({
      name: m.data.name,
      realm: m.data.realm.name,
      realmSlug: m.data.realm.slug,
      region: m.data.region.slug,
      className: m.data.class.name,
    }));
}
