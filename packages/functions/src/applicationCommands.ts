import { isRecord } from '@mythicplus/shared';
import { DESCRIPTION_MAX } from './issueReports.js';

// Wheelson's application commands: `/bug` and `/featurerequest`, which
// `discordInteractions` answers, and the activity's Entry Point command (its
// Launch button). `scripts/registerCommands.ts` registers them on every deploy.

const DISCORD_API = 'https://discord.com/api/v10';

const CHAT_INPUT = 1;
const PRIMARY_ENTRY_POINT = 4;
const STRING_OPTION = 3;

// Installed to servers; usable in servers and in DMs with Wheelson.
const GUILD_INSTALL = 0;
const GUILD = 0;
const BOT_DM = 1;

// Discord launches the activity itself, so the Launch button works even if
// `discordInteractions` doesn't answer.
const DISCORD_LAUNCH_ACTIVITY = 2;

type Command = Record<string, unknown>;

function reportCommand(name: string, description: string, textDescription: string): Command {
  return {
    type: CHAT_INPUT,
    name,
    description,
    integration_types: [GUILD_INSTALL],
    contexts: [GUILD, BOT_DM],
    options: [
      { type: STRING_OPTION, name: 'text', description: textDescription, required: false, max_length: DESCRIPTION_MAX },
    ],
  };
}

export const REPORT_COMMANDS: readonly Command[] = [
  reportCommand('bug', 'Report a bug', 'Quick bug description (skips the form)'),
  reportCommand('featurerequest', 'Request a feature', 'Quick feature description (skips the form)'),
];

/** Used only when the application has no Entry Point command yet. */
export const DEFAULT_ENTRY_POINT: Command = {
  type: PRIMARY_ENTRY_POINT,
  name: 'launch',
  description: 'Launch Wheelson',
  handler: DISCORD_LAUNCH_ACTIVITY,
  integration_types: [GUILD_INSTALL],
  contexts: [GUILD],
};

/**
 * The full command list to register. Discord refuses a bulk overwrite that
 * drops the Entry Point command, so the existing one is kept as it is (its
 * settings live in the Developer Portal); every other command is replaced.
 */
export function commandsToRegister(existing: unknown): Command[] {
  const current = Array.isArray(existing) ? existing.filter(isRecord) : [];
  const entryPoint = current.find((c) => c.type === PRIMARY_ENTRY_POINT) ?? DEFAULT_ENTRY_POINT;
  return [...REPORT_COMMANDS, entryPoint];
}

/** Replace the application's global commands with Wheelson's. Throws if Discord refuses. */
export async function registerCommands(botToken: string, applicationId: string): Promise<Command[]> {
  const url = `${DISCORD_API}/applications/${applicationId}/commands`;
  const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };

  const existing = await fetch(url, { headers });
  if (!existing.ok) throw new Error(`Failed to read the commands: ${existing.status}`);
  const body = commandsToRegister(await existing.json());

  const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Failed to register the commands: ${response.status}`);
  return body;
}
