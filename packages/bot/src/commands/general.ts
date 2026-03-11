import * as os from 'os';
import * as config from '../core/config.js';

export interface GeneralContext {
  guild: { id: string } | null;
  send(content: string, options?: Record<string, unknown>): Promise<unknown>;
}

export interface VoiceClient {
  channel: { members: unknown[] };
  disconnect(options?: { force?: boolean }): Promise<void>;
}

export interface EmbedData {
  title: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

export class GeneralHandler {
  private startTime: number;
  latency: number;
  applicationId?: string | null;

  constructor(latency = 0, applicationId?: string | null) {
    this.startTime = Date.now() / 1000;
    this.latency = latency;
    this.applicationId = applicationId;
  }

  /** Override start time for testing. */
  _setStartTime(t: number): void {
    this.startTime = t;
  }

  async version(ctx: GeneralContext): Promise<void> {
    let value: string;
    if (config.GIT_SHA && config.GIT_SHA.length >= 7) {
      const shortSha = config.GIT_SHA.slice(0, 7);
      const commitUrl = `https://github.com/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/commit/${config.GIT_SHA}`;
      value = `[\`${shortSha}\`](${commitUrl})`;
    } else {
      value = 'unknown';
    }

    const embed: EmbedData = {
      title: 'Bot Version',
      color: 0x3498db,
      fields: [{ name: 'Commit', value, inline: false }],
    };
    await ctx.send('', { embed });
  }

  async invite(ctx: GeneralContext): Promise<void> {
    const appId = this.applicationId ?? config.DISCORD_APPLICATION_ID;
    if (!appId) {
      await ctx.send(
        '❌ Application ID not available. Set config.DISCORD_APPLICATION_ID in your environment.',
      );
      return;
    }
    const permissions = config.BOT_INVITE_PERMISSIONS;
    const url = `https://discord.com/api/oauth2/authorize?client_id=${appId}&scope=bot&permissions=${permissions}`;
    await ctx.send(`**Add this bot to a server:**\n${url}`);
  }

  async status(ctx: GeneralContext): Promise<void> {
    const now = Date.now() / 1000;
    const uptimeSeconds = Math.floor(now - this.startTime);

    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeStr = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const pingMs = Math.round(this.latency * 1000);

    const embed: EmbedData = {
      title: 'Bot Status',
      color: 0x2ecc71,
      fields: [
        { name: 'Uptime', value: uptimeStr, inline: true },
        { name: 'Ping', value: `${pingMs}ms`, inline: true },
      ],
    };

    try {
      const loadavg = os.loadavg();
      embed.fields.push({
        name: 'System Load',
        value: `${loadavg[0].toFixed(2)}, ${loadavg[1].toFixed(2)}, ${loadavg[2].toFixed(2)}`,
        inline: false,
      });
    } catch {
      // loadavg not available on some platforms
    }

    const serverId = ctx.guild?.id ?? 'DM';
    embed.footer = { text: `Server ID: ${serverId}` };

    await ctx.send('', { embed });
  }

  async onVoiceStateUpdate(voiceClient: VoiceClient | null): Promise<void> {
    if (voiceClient && voiceClient.channel && voiceClient.channel.members.length === 1) {
      await voiceClient.disconnect({ force: false });
    }
  }
}
