import { WoWPlayer } from "../types";
import { useState } from "react";
import { remapImageUrl } from "../discordSdk";
import { getPrimaryRole } from "../lib/roles";

interface SpotlightPortraitsProps {
  players: WoWPlayer[];
}

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: "var(--color-tank)",
  healer: "var(--color-healer)",
  ranged: "var(--color-dps)",
  melee: "var(--color-dps)",
  unassigned: "var(--text-secondary)",
};

function PortraitImage({
  url,
  alt,
  color,
}: {
  url: string;
  alt: string;
  color: string;
}) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke={`${color}54`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spotlight-portrait__svg"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="spotlight-portrait__img"
      onError={() => setError(true)}
    />
  );
}

export function SpotlightPortraits({ players }: SpotlightPortraitsProps) {
  if (!players || players.length === 0) return null;

  return (
    <div className="spotlight-portraits" data-testid="spotlight-portraits">
      {players.map((player, index) => {
        if (!player) return null;
        const proxiedUrl = remapImageUrl(player.mediaUrl);
        const primaryRole = getPrimaryRole(player);
        const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;

        return (
          <div
            key={player.discordId || player.name || index}
            className="spotlight-portrait"
            style={{ "--ch-color": color } as React.CSSProperties}
            title={player.name}
          >
            {proxiedUrl ? (
              <PortraitImage
                url={proxiedUrl}
                alt={`${player.name} character portrait`}
                color={color}
              />
            ) : (
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke={`${color}54`}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="spotlight-portrait__svg"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
