const fs = require('fs');

let issuesTs = fs.readFileSync('packages/bot/src/core/issues.ts', 'utf8');

issuesTs = issuesTs.replace(
`export interface GroupServiceMinimal {
  lastResults: Map<string, {
    players: { toTestString(): string }[];
    groups: { toTestString(): string }[];
  }>;
}`,
`import { WoWPlayer, WoWGroup } from '@mythicplus/shared';

export interface GroupServiceMinimal {
  lastResults: Map<string, {
    players: WoWPlayer[];
    groups: WoWGroup[];
  }>;
}`
);

// Add docstrings
issuesTs = issuesTs.replace(
`export async function notifyReporterOfIssue(`,
`/**
 * Notifies the user who reported an issue via direct message.
 *
 * This function attempts to track the issue in the database first.
 * Then, it sends a direct message to the user containing a link to
 * the newly created issue so they can follow its progress.
 *
 * @param user - The user object representing the reporter. Must have an \`id\` and a \`send\` function.
 * @param issue - The GitHub issue response containing the issue URL and number.
 * @returns A boolean indicating whether the direct message was sent successfully.
 */
export async function notifyReporterOfIssue(`
);

issuesTs = issuesTs.replace(
`export async function handleModalSubmit(`,
`/**
 * Handles modal submit interactions from Discord.
 *
 * This function determines the type of modal submitted (e.g., bug report, feature request, or bad group report)
 * and dispatches to the appropriate helper function to create a GitHub issue. It extracts user input,
 * optional log attachments, and the current group generation state to build a detailed issue report.
 *
 * @param interaction - The modal submit interaction from discord.js.
 * @param groupService - A minimal representation of the GroupService containing the latest group results.
 */
export async function handleModalSubmit(`
);

fs.writeFileSync('packages/bot/src/core/issues.ts', issuesTs);


let mainTs = fs.readFileSync('packages/bot/src/main.ts', 'utf8');

// remove unused imports reportBadGroup, submitGithubIssueModal, notifyReporterOfIssue
mainTs = mainTs.replace(
`import { reportBadGroup, submitGithubIssueModal, notifyReporterOfIssue, handleModalSubmit } from './core/issues.js';`,
`import { handleModalSubmit } from './core/issues.js';`
);

fs.writeFileSync('packages/bot/src/main.ts', mainTs);
