import { isRecord } from '@mythicplus/shared';
import type { GithubIssue } from './github.js';
import { DESCRIPTION_MAX, TITLE_MAX, parseIssueReport, type IssueKind, type IssueReport } from './issueReports.js';

// `/bug` and `/featurerequest` as Discord HTTP interactions, usable in a DM
// with Wheelson as well as in servers. With no `text` option the command opens
// a form (a modal); its submission files the issue. The activity's Entry Point
// command (its Launch button) is answered with a launch. `discordInteractions`
// checks the request signature before any of this runs.

const PING = 1;
const APPLICATION_COMMAND = 2;
const MODAL_SUBMIT = 5;

// Application command type of the Entry Point command.
const PRIMARY_ENTRY_POINT = 4;

const PONG = 1;
const CHANNEL_MESSAGE = 4;
const MODAL = 9;
const LAUNCH_ACTIVITY = 12;
const EPHEMERAL = 64;

const QUICK_TITLE_MAX = 60;

export interface InteractionResponse {
  type: number;
  data?: Record<string, unknown>;
}

/** Files the report as an issue; `tracked` says the close DM is set up. */
export type FileReport = (
  report: IssueReport,
  discordId: string,
) => Promise<{ issue: GithubIssue; tracked: boolean }>;

const COMMAND_KINDS: Record<string, IssueKind> = { bug: 'bug', featurerequest: 'feature' };

const FORMS: Record<IssueKind, { customId: string; title: string; detailsLabel: string }> = {
  bug: { customId: 'bug_modal', title: 'Report a Bug', detailsLabel: 'Reproduction Steps' },
  feature: { customId: 'feature_modal', title: 'Request a Feature', detailsLabel: 'Benefit / Impact' },
};

function reply(content: string): InteractionResponse {
  return { type: CHANNEL_MESSAGE, data: { content, flags: EPHEMERAL } };
}

function textInput(customId: string, label: string, paragraph: boolean, required: boolean, maxLength: number) {
  return {
    type: 1,
    components: [{ type: 4, custom_id: customId, label, style: paragraph ? 2 : 1, required, max_length: maxLength }],
  };
}

function reportForm(kind: IssueKind): InteractionResponse {
  const form = FORMS[kind];
  return {
    type: MODAL,
    data: {
      custom_id: form.customId,
      title: form.title,
      components: [
        textInput('title', 'Title', false, true, TITLE_MAX),
        textInput('description', 'Description', true, true, DESCRIPTION_MAX),
        textInput('details', form.detailsLabel, true, false, DESCRIPTION_MAX),
      ],
    },
  };
}

/** The user who ran the interaction: `user` in a DM, `member.user` in a server. */
function interactionUser(body: Record<string, unknown>): { id: string; name: string } | null {
  const user = isRecord(body.user) ? body.user : isRecord(body.member) && isRecord(body.member.user) ? body.member.user : null;
  if (!user || typeof user.id !== 'string' || !/^[0-9]+$/.test(user.id)) return null;
  const name = typeof user.global_name === 'string' ? user.global_name
    : typeof user.username === 'string' ? user.username
      : '';
  return { id: user.id, name };
}

/** A command's `text` option, which skips the form. */
function quickText(data: Record<string, unknown>): string {
  const options = Array.isArray(data.options) ? data.options : [];
  const text = options.find((o) => isRecord(o) && o.name === 'text');
  return isRecord(text) && typeof text.value === 'string' ? text.value.trim() : '';
}

/** The submitted values of a modal, by input custom_id. */
function modalValues(data: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  const rows = Array.isArray(data.components) ? data.components : [];
  for (const row of rows) {
    const inputs = isRecord(row) && Array.isArray(row.components) ? row.components : [];
    for (const input of inputs) {
      if (isRecord(input) && typeof input.custom_id === 'string' && typeof input.value === 'string') {
        values[input.custom_id] = input.value;
      }
    }
  }
  return values;
}

async function file(
  fields: Record<string, unknown>,
  user: { id: string; name: string },
  fileReport: FileReport,
): Promise<InteractionResponse> {
  const report = parseIssueReport({ ...fields, reporterName: user.name.slice(0, 100), version: '' });
  if (!report) return reply('❌ A report needs a title and a description.');
  try {
    const { issue, tracked } = await fileReport(report, user.id);
    const label = report.kind === 'bug' ? 'Bug reported' : 'Feature request created';
    const note = tracked ? "\nI'll DM you when it's resolved." : '';
    return reply(`✅ ${label}: ${issue.html_url}${note}`);
  } catch {
    return reply("❌ Couldn't create the issue. Please try again later.");
  }
}

/** The response to one interaction request whose signature has been checked. */
export async function handleInteraction(body: unknown, fileReport: FileReport): Promise<InteractionResponse> {
  if (!isRecord(body)) return reply('❌ Unknown interaction.');
  if (body.type === PING) return { type: PONG };

  const data = isRecord(body.data) ? body.data : {};
  const user = interactionUser(body);

  if (body.type === APPLICATION_COMMAND && data.type === PRIMARY_ENTRY_POINT) return { type: LAUNCH_ACTIVITY };

  if (body.type === APPLICATION_COMMAND && typeof data.name === 'string' && data.name in COMMAND_KINDS) {
    const kind = COMMAND_KINDS[data.name];
    const text = quickText(data);
    if (!text) return reportForm(kind);
    if (!user) return reply('❌ Unknown user.');
    const title = text.length > QUICK_TITLE_MAX ? `${text.slice(0, QUICK_TITLE_MAX)}...` : text;
    return file({ kind, title, description: text.slice(0, DESCRIPTION_MAX) }, user, fileReport);
  }

  if (body.type === MODAL_SUBMIT) {
    const kind = (Object.keys(FORMS) as IssueKind[]).find((k) => FORMS[k].customId === data.custom_id);
    if (kind && user) {
      const values = modalValues(data);
      return file({ kind, title: values.title, description: values.description, details: values.details }, user, fileReport);
    }
  }

  return reply('❌ Unknown command.');
}
