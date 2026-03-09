import * as fs from 'fs';
import { createErrorIssue } from './core/issues.js';
import { DEVELOPER_ID, LOG_FILE } from './core/config.js';
import logger from './core/logger.js';
import { GroupService } from './services/groupService.js';

export interface DevUser {
  send(
    content: string,
    options?: { files?: { filename: string; content: Buffer }[] },
  ): Promise<void>;
}

export interface BotClient {
  getUser(id: number): DevUser | null;
  fetchUser(id: number): Promise<DevUser>;
}

export class MythicPlusBot {
  groupService: GroupService;
  private client: BotClient;

  constructor(client: BotClient) {
    this.groupService = new GroupService();
    this.client = client;
  }

  async sendErrorToDev(error: Error, contextInfo = 'Unknown Context'): Promise<void> {
    let dev: DevUser | null = null;
    try {
      dev = this.client.getUser(DEVELOPER_ID) ?? (await this.client.fetchUser(DEVELOPER_ID));
      if (dev) {
        const tbStr = error.stack ?? String(error);
        let message =
          `⚠️ **Bot Error Detected**\n**Context:** ${contextInfo}\n` +
          `**Error:** \`${error.message}\`\n**Type:** \`${error.constructor.name}\``;
        const files: { filename: string; content: Buffer }[] = [];

        if (tbStr.length + message.length >= 1900) {
          files.push({ filename: 'traceback.txt', content: Buffer.from(tbStr) });
        } else {
          message += `\n\`\`\`\n${tbStr}\n\`\`\``;
        }

        if (fs.existsSync(LOG_FILE)) {
          const logData = fs.readFileSync(LOG_FILE);
          files.push({
            filename: 'bot.log',
            content: Buffer.isBuffer(logData) ? logData : Buffer.from(logData),
          });
        }

        await dev.send(message, files.length > 0 ? { files } : undefined);
      } else {
        logger.error(`Could not find developer with ID ${DEVELOPER_ID}`);
      }
    } catch (e) {
      logger.error(`Failed to send error DM to developer: ${e}`);
      logger.error(`Original error in ${contextInfo}: ${error}`);
    }

    // Always attempt to create GitHub issue, regardless of DM success
    const issue = await createErrorIssue(error, contextInfo);
    if (issue && dev) {
      try {
        await dev.send(`📋 GitHub issue: ${issue['html_url']}`);
      } catch (e) {
        logger.warn(`Failed to send GitHub issue follow-up DM: ${e}`);
      }
    }
  }

  async handleAppCommandError(
    interaction: {
      commandName?: string;
      user: { id: string; toString(): string };
      channel: { toString(): string } | null;
      responseSent: boolean;
      reply(content: string, options?: { ephemeral?: boolean }): Promise<void>;
      followUp(content: string, options?: { ephemeral?: boolean }): Promise<void>;
    },
    error: Error,
  ): Promise<void> {
    const context =
      `App Command: /${interaction.commandName ?? 'Unknown'}\n` +
      `User: ${interaction.user} (${interaction.user.id})\n` +
      `Channel: ${interaction.channel}`;
    await this.sendErrorToDev(error, context);
    logger.error(`App Command Error: ${error}`);

    const msg = '❌ An error occurred while processing your command. Please try again later.';
    if (!interaction.responseSent) {
      await interaction.reply(msg, { ephemeral: true });
    } else {
      await interaction.followUp(msg, { ephemeral: true });
    }
  }

  async handleCommandError(
    ctx: {
      command: string;
      author: { id: string | number; toString(): string };
      channel: { toString(): string };
      send(content: string): Promise<unknown>;
    },
    error: Error,
  ): Promise<void> {
    const context =
      `Command: !${ctx.command}\n` +
      `User: ${ctx.author} (${ctx.author.id})\n` +
      `Channel: ${ctx.channel}`;
    await this.sendErrorToDev(error, context);
    logger.error(`Error in ${ctx.command}: ${error}`);
    await ctx.send(
      '❌ An error occurred while processing your command. Please try again later.',
    );
  }

  async handleEventError(eventName: string, error: Error, ...args: unknown[]): Promise<void> {
    const context = `Event: ${eventName}\nArgs: ${JSON.stringify(args)}`;
    await this.sendErrorToDev(error, context);
    logger.error(`Error in event ${eventName}: ${error}`);
  }
}
