import type { WoWGroupDict, WoWPlayerDict } from './types.js';

const WOW_COMMAND_MAX_LENGTH = 255;

function getInviteName(p: WoWPlayerDict): string {
  return p.inGameName || p.name;
}

function buildCommandString(names: string[]): string {
  const nameList = names.map((n) => `"${n}"`).join(',');
  return `/run local p={${nameList}} for _,n in ipairs(p) do C_PartyInfo.InviteUnit(n) end`;
}

function generateSplitInviteCommands(names: string[]): string {
  const commands: string[] = [];
  let current: string[] = [];

  for (const name of names) {
    const test = [...current, name];
    const testCmd = buildCommandString(test);
    if (testCmd.length > WOW_COMMAND_MAX_LENGTH && current.length > 0) {
      commands.push(buildCommandString(current));
      current = [name];
    } else {
      current = test;
    }
  }
  if (current.length > 0) {
    commands.push(buildCommandString(current));
  }

  return commands.join('\n');
}

export function generateInviteCommand(group: WoWGroupDict): string {
  const invitees: WoWPlayerDict[] = [
    ...(group.healer ? [group.healer] : []),
    ...group.dps,
  ];

  if (invitees.length === 0) return '';

  const names = invitees.map(getInviteName);
  const command = buildCommandString(names);

  if (command.length > WOW_COMMAND_MAX_LENGTH) {
    return generateSplitInviteCommands(names);
  }

  return command;
}
