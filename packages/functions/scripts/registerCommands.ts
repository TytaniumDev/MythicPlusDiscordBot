// Registers Wheelson's application commands. `deploy.yml` runs it on every
// merge to main:
//
//   BOT_TOKEN=... DISCORD_APPLICATION_ID=... npm -w packages/functions run register-commands
import { registerCommands } from '../src/applicationCommands.js';

const botToken = process.env.BOT_TOKEN?.trim();
const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
if (!botToken || !applicationId) {
  console.error('BOT_TOKEN and DISCORD_APPLICATION_ID must be set');
  process.exit(1);
}

const commands = await registerCommands(botToken, applicationId);
console.log(`Registered ${commands.map((c) => `${c.name}`).join(', ')}`);
