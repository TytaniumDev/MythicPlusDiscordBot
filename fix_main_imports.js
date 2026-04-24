const fs = require('fs');

let mainTs = fs.readFileSync('packages/bot/src/main.ts', 'utf8');

mainTs = mainTs.replace(
`import { handleModalSubmit } from './core/issues.js';`,
`import { reportBadGroup, submitGithubIssueModal, notifyReporterOfIssue, handleModalSubmit } from './core/issues.js';`
);

fs.writeFileSync('packages/bot/src/main.ts', mainTs);
