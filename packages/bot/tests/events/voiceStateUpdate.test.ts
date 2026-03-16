import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { onVoiceStateUpdate } from '../../src/events/voiceStateUpdate.js';
import type { VoiceStateUpdateMember } from '../../src/events/voiceStateUpdate.js';
import type { GroupsHandler, VoiceState } from '../../src/commands/groups.js';
import type { GeneralHandler, VoiceClient } from '../../src/commands/general.js';
import type { Guild } from '../../src/services/sessionService.js';

describe('onVoiceStateUpdate', () => {
  let mockGroupsHandler: GroupsHandler;
  let mockGeneralHandler: GeneralHandler;
  let mockMember: VoiceStateUpdateMember;
  let mockBefore: VoiceState;
  let mockAfter: VoiceState;

  beforeEach(() => {
    mockGroupsHandler = {
      onVoiceStateUpdate: vi.fn(),
    } as unknown as GroupsHandler;

    mockGeneralHandler = {
      onVoiceStateUpdate: vi.fn(),
    } as unknown as GeneralHandler;

    mockMember = {
      bot: false,
      guild: {
        voiceClient: null,
      } as unknown as Guild & { voiceClient?: VoiceClient | null },
    };

    mockBefore = {} as VoiceState;
    mockAfter = {} as VoiceState;
  });

  it('delegates to both handlers when voiceClient is null', async () => {
    await onVoiceStateUpdate(
      mockMember,
      mockBefore,
      mockAfter,
      mockGroupsHandler,
      mockGeneralHandler
    );

    expect(mockGroupsHandler.onVoiceStateUpdate).toHaveBeenCalledWith(mockMember, mockBefore, mockAfter);
    expect(mockGeneralHandler.onVoiceStateUpdate).toHaveBeenCalledWith(null);
  });

  it('delegates to both handlers when voiceClient is defined', async () => {
    const mockVoiceClient = {} as VoiceClient;
    mockMember.guild.voiceClient = mockVoiceClient;

    await onVoiceStateUpdate(
      mockMember,
      mockBefore,
      mockAfter,
      mockGroupsHandler,
      mockGeneralHandler
    );

    expect(mockGroupsHandler.onVoiceStateUpdate).toHaveBeenCalledWith(mockMember, mockBefore, mockAfter);
    expect(mockGeneralHandler.onVoiceStateUpdate).toHaveBeenCalledWith(mockVoiceClient);
  });
});
