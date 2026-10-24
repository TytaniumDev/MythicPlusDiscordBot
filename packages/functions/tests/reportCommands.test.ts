import { describe, it, expect, vi } from 'vitest';
import { handleInteraction, type FileReport } from '../src/reportCommands';

const ISSUE = { number: 42, html_url: 'https://github.com/o/r/issues/42', title: 'Wheel stuck' };
const DM_USER = { id: '123456789012345678', username: 'ty', global_name: 'Tytanium' };

function filer(tracked = true) {
  return vi.fn<FileReport>().mockResolvedValue({ issue: ISSUE, tracked });
}

function command(name: string, text?: string, from: Record<string, unknown> = { user: DM_USER }) {
  return { type: 2, ...from, data: { type: 1, name, options: text === undefined ? [] : [{ name: 'text', type: 3, value: text }] } };
}

function modalSubmit(customId: string, values: Record<string, string>) {
  return {
    type: 5,
    user: DM_USER,
    data: {
      custom_id: customId,
      components: Object.entries(values).map(([id, value]) => ({ type: 1, components: [{ type: 4, custom_id: id, value }] })),
    },
  };
}

describe('handleInteraction', () => {
  it('answers a ping', async () => {
    expect(await handleInteraction({ type: 1 }, filer())).toEqual({ type: 1 });
  });

  it('launches the activity from its Entry Point command', async () => {
    expect(await handleInteraction({ type: 2, data: { type: 4, name: 'launch' } }, filer())).toEqual({ type: 12 });
  });

  it('opens the bug form when there is no text', async () => {
    const response = await handleInteraction(command('bug'), filer());
    expect(response.type).toBe(9);
    expect(response.data).toMatchObject({ custom_id: 'bug_modal', title: 'Report a Bug' });
    const labels = (response.data?.components as { components: { label: string }[] }[]).map((row) => row.components[0].label);
    expect(labels).toEqual(['Title', 'Description', 'Reproduction Steps']);
  });

  it('opens the feature form for /featurerequest', async () => {
    const response = await handleInteraction(command('featurerequest'), filer());
    expect(response.data).toMatchObject({ custom_id: 'feature_modal', title: 'Request a Feature' });
  });

  it('files a submitted bug form as the user who sent it', async () => {
    const fileReport = filer();
    const response = await handleInteraction(
      modalSubmit('bug_modal', { title: 'Wheel stuck', description: 'It stopped.', details: 'Spin twice' }),
      fileReport,
    );

    expect(fileReport).toHaveBeenCalledWith(
      { kind: 'bug', title: 'Wheel stuck', description: 'It stopped.', details: 'Spin twice', reporterName: 'Tytanium', version: '' },
      DM_USER.id,
    );
    expect(response).toEqual({
      type: 4,
      data: { content: `✅ Bug reported: ${ISSUE.html_url}\nI'll DM you when it's resolved.`, flags: 64 },
    });
  });

  it('files quick text straight away, as a server member too', async () => {
    const fileReport = filer(false);
    const long = 'x'.repeat(80);
    const response = await handleInteraction(
      command('featurerequest', long, { member: { user: { id: '1002', username: 'healone' } } }),
      fileReport,
    );

    const [report, discordId] = fileReport.mock.calls[0];
    expect(discordId).toBe('1002');
    expect(report).toMatchObject({ kind: 'feature', title: `${'x'.repeat(60)}...`, description: long, reporterName: 'healone' });
    expect(response.data?.content).toBe(`✅ Feature request created: ${ISSUE.html_url}`);
  });

  it('says so when the form is incomplete or filing fails', async () => {
    const incomplete = await handleInteraction(modalSubmit('bug_modal', { title: 'Only a title' }), filer());
    expect(incomplete.data?.content).toContain('needs a title and a description');

    const failing = vi.fn<FileReport>().mockRejectedValue(new Error('HTTP 500'));
    const failed = await handleInteraction(modalSubmit('feature_modal', { title: 'T', description: 'D' }), failing);
    expect(failed.data?.content).toContain("Couldn't create the issue");
  });

  it('refuses unknown commands and forms', async () => {
    expect((await handleInteraction(command('wheel'), filer())).data?.content).toBe('❌ Unknown command.');
    expect((await handleInteraction(modalSubmit('other_modal', {}), filer())).data?.content).toBe('❌ Unknown command.');
  });
});
