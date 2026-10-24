import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ENTRY_POINT, REPORT_COMMANDS, commandsToRegister, registerCommands } from '../src/applicationCommands';

const ENTRY_POINT = { id: '9', type: 4, name: 'launch', description: 'Custom', handler: 2 };

describe('REPORT_COMMANDS', () => {
  it('offers /bug and /featurerequest in servers and in DMs with Wheelson', () => {
    expect(REPORT_COMMANDS.map((c) => c.name)).toEqual(['bug', 'featurerequest']);
    for (const command of REPORT_COMMANDS) {
      expect(command.contexts).toEqual([0, 1]);
      expect(command.options).toEqual([expect.objectContaining({ name: 'text', required: false, max_length: 2000 })]);
    }
  });
});

describe('commandsToRegister', () => {
  it('keeps the existing Entry Point command and drops every other command', () => {
    const existing = [{ id: '1', type: 1, name: 'wheel' }, ENTRY_POINT, { id: '2', type: 1, name: 'bug' }];
    expect(commandsToRegister(existing)).toEqual([...REPORT_COMMANDS, ENTRY_POINT]);
  });

  it('adds a default Entry Point command when there is none', () => {
    expect(commandsToRegister([])).toEqual([...REPORT_COMMANDS, DEFAULT_ENTRY_POINT]);
    expect(commandsToRegister('junk')).toEqual([...REPORT_COMMANDS, DEFAULT_ENTRY_POINT]);
  });
});

describe('registerCommands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the commands, then overwrites them with the bot token', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([ENTRY_POINT]) })
      .mockResolvedValueOnce({ ok: true });

    await registerCommands('bot-token', 'app');

    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls[0][0]).toBe('https://discord.com/api/v10/applications/app/commands');
    expect(calls[1][0]).toBe('https://discord.com/api/v10/applications/app/commands');
    expect(calls[1][1]?.method).toBe('PUT');
    expect(calls[1][1]?.headers).toMatchObject({ Authorization: 'Bot bot-token' });
    expect(JSON.parse(calls[1][1]!.body as string)).toEqual([...REPORT_COMMANDS, ENTRY_POINT]);
  });

  it('throws when Discord refuses either call', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(registerCommands('bot-token', 'app')).rejects.toThrow('401');

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(registerCommands('bot-token', 'app')).rejects.toThrow('400');
  });
});
