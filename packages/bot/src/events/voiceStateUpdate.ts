import type { GroupsHandler, VoiceState } from '../commands/groups.js';
import type { GeneralHandler, VoiceClient } from '../commands/general.js';
import type { Guild } from '../services/sessionService.js';

export interface VoiceStateUpdateMember {
  bot: boolean;
  guild: Guild & { voiceClient?: VoiceClient | null };
}

/**
 * Delegates voice state updates to both the groups handler (session tracking)
 * and the general handler (auto-disconnect when alone).
 */
export async function onVoiceStateUpdate(
  member: VoiceStateUpdateMember,
  before: VoiceState,
  after: VoiceState,
  groupsHandler: GroupsHandler,
  generalHandler: GeneralHandler,
): Promise<void> {
  // Groups: track active channel changes for Firebase sessions
  await groupsHandler.onVoiceStateUpdate(member, before, after);

  // General: auto-disconnect when bot is alone in channel
  await generalHandler.onVoiceStateUpdate(member.guild.voiceClient ?? null);
}
