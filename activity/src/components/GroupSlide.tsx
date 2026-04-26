import type { WoWGroup, WoWPlayer } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';
import { utilityIcons } from '../lib/roles';
import { SpotlightPortrait } from './SpotlightPortrait';
import { useState } from 'react';
import { useAppStore } from '../store/store';
import { generateInviteCommand } from '@mythicplus/shared';

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

export interface GroupSlideProps {
  group: WoWGroup;
  index: number;
  label?: string;
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}

const SLOT_COUNT = 5;

type SlotRole = 'tank' | 'healer' | 'dps';

interface Slot {
  role: SlotRole;
  // null when the group has no player in this slot (remainder case).
  player: WoWGroup['tank'];
}

const ROLE_LABEL: Record<SlotRole, string> = {
  tank: 'Tank',
  healer: 'Healer',
  dps: 'DPS',
};

// WoW-style role icons: shield (tank), plus (healer), sword (DPS). Inline SVG
// so the bundle stays self-contained — the design-token colors give the
// circular fill, with a gold ring outside and a black outline around the
// glyph for contrast against the bright color.
function RoleGlyph({ role }: { role: SlotRole }) {
  const fill =
    role === 'tank'
      ? 'var(--color-tank)'
      : role === 'healer'
        ? 'var(--color-healer)'
        : 'var(--color-dps)';
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10.5" fill={fill} stroke="#a8842c" strokeWidth="1.5" />
      {role === 'tank' && (
        <path
          d="M12 5.5 L17 7.5 L17 12.5 C17 15.5 14.5 17.5 12 18.5 C9.5 17.5 7 15.5 7 12.5 L7 7.5 Z"
          fill="#fff"
          stroke="#000"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      )}
      {role === 'healer' && (
        <path
          d="M10.5 6 H13.5 V10.5 H18 V13.5 H13.5 V18 H10.5 V13.5 H6 V10.5 H10.5 Z"
          fill="#fff"
          stroke="#000"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      )}
      {role === 'dps' && (
        <g transform="rotate(45 12 12)">
          <path
            d="M12 3.5 L13.4 5 L13.4 12.5 L16 12.5 L16 14 L13.15 14 L13.15 17 L10.85 17 L10.85 14 L8 14 L8 12.5 L10.6 12.5 L10.6 5 Z"
            fill="#fff"
            stroke="#000"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="17.9" r="1.5" fill="#fff" stroke="#000" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}

function isOffspecForSlot(slot: SlotRole, player: WoWPlayer | null): boolean {
  if (!player || player.mainRole == null) return false;
  if (slot === 'tank') return player.mainRole !== 'tank';
  if (slot === 'healer') return player.mainRole !== 'healer';
  // dps slot: any player whose main role is tank or healer is filling DPS as offspec.
  return player.mainRole === 'tank' || player.mainRole === 'healer';
}

function buildSlots(group: WoWGroup): Slot[] {
  const slots: Slot[] = [
    { role: 'tank', player: group.tank },
    { role: 'healer', player: group.healer },
  ];
  for (let i = 0; i < 3; i++) {
    slots.push({ role: 'dps', player: group.dps[i] ?? null });
  }
  return slots.slice(0, SLOT_COUNT);
}

export function GroupSlide({ group, index, label, scoresByDiscordId }: GroupSlideProps) {
  const heading = label ?? `Group ${index + 1}`;
  const slots = buildSlots(group);

  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const inviteCmd = generateInviteCommand(group, currentPlayerId ?? undefined);
  const hasInvite = inviteCmd.length > 0;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(inviteCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group-slide" data-testid={`group-slide-${index}`}>
      <h3 className="group-slide__heading">{heading}</h3>
      <div className="group-slide__grid" role="group" aria-label={heading}>
        <div className="group-slide__row group-slide__row--utils">
          {slots.map((slot, i) => (
            <div className="group-slide__cell" key={i}>
              <span className="group-slide__utility-row" aria-hidden="true">
                {slot.player ? utilityIcons(slot.player).trim() : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="group-slide__row group-slide__row--roles">
          {slots.map((slot, i) => {
            const offspec = isOffspecForSlot(slot.role, slot.player);
            const label = ROLE_LABEL[slot.role];
            const ariaLabel = slot.player ? `${label}${offspec ? ' (offspec)' : ''}` : `${label} slot empty`;
            return (
              <div className="group-slide__cell" key={i}>
                <span
                  className={`group-slide__role-icon${offspec ? ' is-offspec' : ''}${slot.player ? '' : ' is-empty'}`}
                  role="img"
                  aria-label={ariaLabel}
                  title={ariaLabel}
                >
                  <RoleGlyph role={slot.role} />
                </span>
              </div>
            );
          })}
        </div>
        <div className="group-slide__row group-slide__row--portraits">
          {slots.map((slot, i) => (
            <div className="group-slide__cell" key={i}>
              {slot.player ? (
                <SpotlightPortrait
                  name={slot.player.name}
                  characterClass={slot.player.characterClass}
                  mediaUrl={slot.player.mediaUrl}
                  scores={
                    slot.player.discordId
                      ? scoresByDiscordId?.get(slot.player.discordId) ?? null
                      : null
                  }
                />
              ) : (
                <div className="group-slide__portrait-placeholder" aria-hidden="true">
                  <span className="group-slide__placeholder-glyph">?</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {hasInvite && (
        <button
          type="button"
          className="group-slide__copy-invite"
          onClick={handleCopy}
          aria-label={`Copy invite command for ${heading}`}
        >
          {copied ? 'Copied!' : 'Copy Invite'}
        </button>
      )}
    </div>
  );
}
