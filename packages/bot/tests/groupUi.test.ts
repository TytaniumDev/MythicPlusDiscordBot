import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WoWPlayer, WoWGroup, ROLE_TANK, ROLE_HEALER, ROLE_MELEE, ROLE_RANGED, ROLE_BREZ, ROLE_LUST } from '@mythicplus/shared';
import { buildGroupEmbed, announceGroup } from '../src/core/groupUi.js';
import type { Embed, Message, Sendable } from '../src/core/groupUi.js';

// Mock the utils module
vi.mock('../src/core/utils.js', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    getMaskedName: (n: string) => '?'.repeat(n.length),
    showShortTyping: vi.fn().mockResolvedValue(undefined),
  };
});

describe('buildGroupEmbed', () => {
  it('has all fields', () => {
    const tank = WoWPlayer.create('TankPlayer', [ROLE_TANK, ROLE_BREZ]);
    const healer = WoWPlayer.create('HealerPlayer', [ROLE_HEALER, ROLE_LUST]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);
    const dps2 = WoWPlayer.create('DPS2', [ROLE_RANGED]);
    const dps3 = WoWPlayer.create('DPS3', [ROLE_MELEE]);

    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);
    const embed = buildGroupEmbed(group, 1);

    expect(embed.title).toBe('Group 1');
    const fields = Object.fromEntries(embed.fields.map((f) => [f.name, f.value]));
    expect(fields['Tank']).toBe('TankPlayer');
    expect(fields['Healer']).toBe('HealerPlayer');
    expect(fields['DPS']).toBe('DPS1, DPS2, DPS3');
    expect(fields['Battle Res']).toBe('TankPlayer');
    expect(fields['Bloodlust']).toBe('HealerPlayer');
  });

  it('shows None for missing utilities', () => {
    const tank = WoWPlayer.create('Tank', [ROLE_TANK]);
    const healer = WoWPlayer.create('Healer', [ROLE_HEALER]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);

    const group = new WoWGroup(tank, healer, [dps1]);
    const embed = buildGroupEmbed(group, 2);

    const fields = Object.fromEntries(embed.fields.map((f) => [f.name, f.value]));
    expect(fields['Battle Res']).toBe('None');
    expect(fields['Bloodlust']).toBe('None');
  });

});

describe('announceGroup', () => {
  let ctx: Sendable;
  let channel: { sendTyping: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ctx = {
      send: vi.fn().mockImplementation(() => {
        const msg: Message = {
          edit: vi.fn().mockReturnThis() as Message['edit'],
        };
        return Promise.resolve(msg);
      }),
    };
    channel = { sendTyping: vi.fn().mockResolvedValue(undefined) };
  });

  it('sends embed directly in debug mode', async () => {
    const tank = WoWPlayer.create('TankPlayer', [ROLE_TANK]);
    const healer = WoWPlayer.create('HealerPlayer', [ROLE_HEALER]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);
    const dps2 = WoWPlayer.create('DPS2', [ROLE_RANGED]);
    const dps3 = WoWPlayer.create('DPS3', [ROLE_MELEE]);

    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);
    await announceGroup(ctx, channel, group, 1, true);

    expect(ctx.send).toHaveBeenCalledTimes(1);
    const sendArgs = vi.mocked(ctx.send).mock.calls[0][0] as { embed: Embed };
    const embed = sendArgs.embed;
    expect(embed.title).toBe('Group 1');
    const fields = Object.fromEntries(embed.fields.map((f) => [f.name, f.value]));
    expect(fields['Tank']).toBe('TankPlayer');
    expect(fields['Healer']).toBe('HealerPlayer');
  });

  it('uses masked names in normal mode with animation', async () => {
    const { showShortTyping } = await import('../src/core/utils.js');

    const tank = WoWPlayer.create('TankPlayer', [ROLE_TANK]);
    const healer = WoWPlayer.create('HealerPlayer', [ROLE_HEALER]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);
    const dps2 = WoWPlayer.create('DPS2', [ROLE_RANGED]);
    const dps3 = WoWPlayer.create('DPS3', [ROLE_MELEE]);

    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);

    const mockMessage = {
      edit: vi.fn().mockReturnThis() as Message['edit'],
    };
    vi.mocked(ctx.send).mockResolvedValue(mockMessage as unknown as Message);

    await announceGroup(ctx, channel, group, 1, false);

    // Verify initial send was called
    expect(ctx.send).toHaveBeenCalledTimes(1);

    // Verify typing was called 5 times (for each role reveal)
    expect(showShortTyping).toHaveBeenCalledTimes(5);

    // Verify edits happened (5 animated + 2 utility = 7)
    expect(mockMessage.edit).toHaveBeenCalledTimes(7);
  });
});
