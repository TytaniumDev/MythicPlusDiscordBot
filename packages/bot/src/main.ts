import { initSentry, reportError, Sentry } from './core/sentry.js';
initSentry();

import {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InviteTargetType,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type Message as DjsMessage,
  type Interaction,
} from 'discord.js';
import * as config from './core/config.js';
import logger from './core/logger.js';
import { GroupService } from './services/groupService.js';
import { SessionService, type Bot, type Guild, type VoiceChannel } from './services/sessionService.js';
import { adaptGuild, buildVoiceChannelsSnapshot } from './core/discordAdapters.js';
import { GroupsHandler } from './commands/groups.js';
import { DebugHandler } from './commands/debug.js';
import type { DiscordMember } from './core/utils.js';
import { FirebaseService, DELETE_FIELD } from './core/firebaseService.js';
import { WoWPlayer, WoWGroup, decodeGroupHistoryRounds } from '@mythicplus/shared';
import { reportBadGroup, submitGithubIssueModal, GitHubError } from './core/issues.js';
import type { GitHubIssueResponse } from './core/issues.js';
import { IssueTrackingService } from './services/issueTrackingService.js';

// ---------------------------------------------------------------------------
// Helpers: convert plain embed objects → discord.js EmbedBuilder
// ---------------------------------------------------------------------------

interface PlainEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string | { text: string };
}

function toDiscordEmbed(plain: PlainEmbed): EmbedBuilder {
  const eb = new EmbedBuilder();
  if (plain.title) eb.setTitle(plain.title);
  if (plain.description) eb.setDescription(plain.description);
  if (plain.color != null) eb.setColor(plain.color);
  if (plain.fields) {
    for (const f of plain.fields) {
      eb.addFields({ name: f.name, value: f.value, inline: f.inline ?? false });
    }
  }
  if (plain.footer) {
    const text = typeof plain.footer === 'string' ? plain.footer : plain.footer.text;
    eb.setFooter({ text });
  }
  return eb;
}

// Wrap a Discord.js Message so that the handler's `.edit({ embed })` works.
function wrapMessage(msg: DjsMessage): { edit(opts: { embed: PlainEmbed }): Promise<ReturnType<typeof wrapMessage>> } {
  return {
    async edit(opts: { embed: PlainEmbed }) {
      const edited = await msg.edit({ embeds: [toDiscordEmbed(opts.embed)] });
      return wrapMessage(edited);
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter: Discord.js GuildMember → handler DiscordMember
// ---------------------------------------------------------------------------

function adaptMember(m: { nickname: string | null; displayName: string; id: string; user: { bot: boolean } }): DiscordMember & { bot: boolean; id: string } {
  return {
    nick: m.nickname,
    global_name: m.displayName,
    id: m.id,
    bot: m.user.bot,
    toString() { return m.displayName; },
  };
}

// Resolve the reporter's display name, preferring the per-guild nickname when
// available and falling back to the global username. Used by issue-reporting
// commands and modal handlers.
function getReporterName(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
): string {
  const member = interaction.member as import('discord.js').GuildMember | null;
  return member?.displayName ?? interaction.user.displayName;
}

// ---------------------------------------------------------------------------
// Adapter: Discord.js Client → Bot interface for SessionService
// ---------------------------------------------------------------------------

function createBotAdapter(client: Client): Bot {
  return {
    get_guild(id: string): Guild | null {
      const g = client.guilds.cache.get(id);
      return adaptGuild(g ?? null, adaptVoiceChannel);
    },
  };
}

function adaptVoiceChannel(ch: import('discord.js').VoiceChannel): VoiceChannel {
  const members = ch.members.map((m) => adaptMember(m));
  return {
    id: ch.id,
    name: ch.name,
    get members() {
      return members;
    },
    async send(content: string | { embed: PlainEmbed }) {
      if (typeof content === 'string') {
        return await ch.send(content);
      }
      return await ch.send({ embeds: [toDiscordEmbed(content.embed)] });
    },
  };
}

// ---------------------------------------------------------------------------
// Issue tracking service + reporter notification helper
// ---------------------------------------------------------------------------

const issueTrackingService = new IssueTrackingService();

async function notifyReporterOfIssue(
  user: { id: string; send: (content: string) => Promise<unknown> },
  issue: GitHubIssueResponse,
): Promise<boolean> {
  let tracked = false;
  try {
    await issueTrackingService.trackIssue({
      issueNumber: issue.number,
      discordUserId: user.id,
      issueUrl: issue.html_url,
      issueTitle: issue.title,
    });
    tracked = true;
  } catch (e) {
    logger.warn(`Failed to store issue tracking for #${issue.number}: ${e}`);
  }

  try {
    const trackingNote = tracked
      ? "\nI'll DM you when it's resolved."
      : '';
    await user.send(
      `Your report has been submitted! You can track it here: ${issue.html_url}${trackingNote}`,
    );
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Context factories: interaction → handler context objects
// ---------------------------------------------------------------------------

function createInteractionSender(interaction: ChatInputCommandInteraction) {
  let deferred = false;
  let firstSent = false;

  return {
    async defer(opts?: { ephemeral?: boolean }) {
      await interaction.deferReply({ ephemeral: opts?.ephemeral });
      deferred = true;
    },
    async send(
      content: string | { embed: PlainEmbed },
      opts?: { embed?: PlainEmbed; ephemeral?: boolean },
    ) {
      // Build payload
      const payload: Record<string, unknown> = {};
      const embeds: EmbedBuilder[] = [];

      if (typeof content === 'string') {
        if (content) payload.content = content;
        if (opts?.embed) embeds.push(toDiscordEmbed(opts.embed));
        if (opts?.ephemeral) payload.ephemeral = true;
      } else if (content && typeof content === 'object' && 'embed' in content) {
        embeds.push(toDiscordEmbed(content.embed));
      }

      if (embeds.length) payload.embeds = embeds;

      let msg: DjsMessage;
      if (deferred && !firstSent) {
        firstSent = true;
        msg = await interaction.editReply(payload) as DjsMessage;
      } else if (!deferred && !firstSent) {
        firstSent = true;
        msg = (await interaction.reply({ ...payload, fetchReply: true })) as DjsMessage;
      } else {
        msg = (await interaction.followUp(payload)) as DjsMessage;
      }

      return wrapMessage(msg);
    },
  };
}

// ---------------------------------------------------------------------------
// Slash command definitions
// ---------------------------------------------------------------------------

const commands = [
  new SlashCommandBuilder().setName('wheel').setDescription('Create Mythic+ groups from voice channel members'),
  new SlashCommandBuilder().setName('wheelson').setDescription('Start a Mythic+ lobby activity'),
  new SlashCommandBuilder()
    .setName('bug')
    .setDescription('Report a bug')
    .addStringOption((opt) =>
      opt.setName('text').setDescription('Quick bug description (skips the form)').setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('featurerequest')
    .setDescription('Request a feature')
    .addStringOption((opt) =>
      opt.setName('text').setDescription('Quick feature description (skips the form)').setRequired(false),
    ),
  new SlashCommandBuilder().setName('test').setDescription('[Debug] Run wheel with mock players'),
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!config.BOT_TOKEN) {
    logger.error('BOT_TOKEN is not set. Exiting.');
    process.exit(1);
  }
  if (!config.DISCORD_APPLICATION_ID) {
    logger.error('DISCORD_APPLICATION_ID is not set. Exiting.');
    process.exit(1);
  }
  const botToken = config.BOT_TOKEN;
  const appId = config.DISCORD_APPLICATION_ID;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
    ],
  });

  // -- Initialize handlers --
  const groupService = new GroupService();
  const botAdapter = createBotAdapter(client);
  const sessionService = new SessionService(botAdapter);

  const groupsHandler = new GroupsHandler(botAdapter, groupService, sessionService);
  const debugHandler = new DebugHandler(groupService);

  // Track listeners for shutdown cleanup
  let badGroupReportListener: { unsubscribe(): void } | null = null;
  let guildRefreshListener: { unsubscribe(): void } | null = null;
  let channelListener: { unsubscribe(): void } | null = null;

  // -- Ready event --
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);

    // Register slash commands globally
    const rest = new REST({ version: '10' }).setToken(botToken);
    const commandsJson = commands.map((c) => c.toJSON());
    try {
      // Preserve entry point commands in global registration
      const existing = (await rest.get(Routes.applicationCommands(appId))) as { type?: number }[];
      const entryPointCommands = existing.filter((cmd) => cmd.type === 4);
      const globalBody = [...commandsJson, ...entryPointCommands];
      await rest.put(Routes.applicationCommands(appId), { body: globalBody });
      logger.info(`Registered ${commands.length} slash commands globally`);

      // Clear stale guild-level commands (duplicates from old per-guild registration)
      for (const guild of readyClient.guilds.cache.values()) {
        try {
          const guildCmds = (await rest.get(
            Routes.applicationGuildCommands(appId, guild.id),
          )) as { id: string }[];
          if (guildCmds.length > 0) {
            await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body: [] });
            logger.info(`Cleared ${guildCmds.length} stale guild commands from ${guild.name}`);
          }
        } catch (guildErr) {
          logger.warn(`Could not clear guild commands for ${guild.name}: ${guildErr}`);
        }
      }
    } catch (e) {
      logger.error(`Failed to register slash commands: ${e}`);
    }

    // Listen for bad group reports from the activity frontend
    const firebase = FirebaseService.getInstance();
    const reportTimestamps = new Map<string, number>(); // per-guild rate limit
    let lastGlobalReportTimestamp = 0; // global hard cap (defense-in-depth)
    const REPORT_COOLDOWN_MS = 60_000; // 1 minute between reports per guild
    const GLOBAL_REPORT_COOLDOWN_MS = 10_000; // 10 seconds between any reports globally

    badGroupReportListener = firebase.listenForBadGroupReports(async (docId, data) => {
      try {
        const now = Date.now();

        // Global hard cap: defense-in-depth against rate-limit bypass
        if (now - lastGlobalReportTimestamp < GLOBAL_REPORT_COOLDOWN_MS) {
          logger.warn(`Global rate-limited bad group report (doc ${docId}), skipping`);
          await firebase.deleteDoc('badGroupReports', docId);
          return;
        }

        // Per-guild rate limit: one report per minute per guild
        const reportGuildId = String(data.guildId ?? 'unknown');
        const lastTimestamp = reportTimestamps.get(reportGuildId) ?? 0;
        if (now - lastTimestamp < REPORT_COOLDOWN_MS) {
          logger.warn(`Rate-limited bad group report from guild ${reportGuildId} (doc ${docId}), skipping`);
          await firebase.deleteDoc('badGroupReports', docId);
          return;
        }

        // Both checks passed — update timestamps so future reports are rate-limited
        lastGlobalReportTimestamp = now;
        reportTimestamps.set(reportGuildId, now);

        const playersData = (data.players ?? []) as Record<string, unknown>[];
        const groupsData = (data.groups ?? []) as Record<string, unknown>[];
        const players = playersData.map((p) => WoWPlayer.fromDict(p));
        const groups = groupsData.map((g) => WoWGroup.fromDict(g));

        // Prior rounds use the same wrapped wire shape as guild groupHistory
        // (Firestore rejects nested arrays). Defensively tolerate missing /
        // malformed history so a bad doc still files an issue rather than
        // dropping the report.
        const priorRoundsRaw = Array.isArray(data.priorRounds) ? data.priorRounds : [];
        const priorRounds = decodeGroupHistoryRounds(priorRoundsRaw)
          .map((round) => round.map((g) => WoWGroup.fromDict(g)));

        const issue = await reportBadGroup({
          reporterName: String(data.reporterName ?? 'Unknown'),
          reporterId: String(data.reporterId ?? 'Unknown'),
          title: String(data.title ?? 'Bad Group Report'),
          description: String(data.description ?? ''),
          players,
          groups,
          priorRounds,
        });

        logger.info(`Bad group report processed: ${issue.html_url}`);
      } catch (e) {
        reportError(e, { tags: { handler: 'badGroupReport' }, extra: { docId } });
      } finally {
        // Always delete the report doc to prevent reprocessing on restart.
        // A persistent delete failure would re-fire the same report on every
        // listener tick, so escalate this rather than swallowing.
        try {
          await firebase.deleteDoc('badGroupReports', docId);
        } catch (delErr) {
          reportError(delErr, { tags: { handler: 'badGroupReportCleanup' }, extra: { docId } });
        }
      }
    });

    if (badGroupReportListener) {
      logger.info('Listening for bad group reports from activity frontend');
    }

    // Listen for guild refresh requests from the activity frontend.
    // Look up guilds by string ID directly to avoid Number() precision loss
    // on 64-bit Discord snowflake IDs.
    guildRefreshListener = firebase.listenForGuildRefreshRequests(async (guildId) => {
      try {
        const discordGuild = readyClient.guilds.cache.get(guildId);
        if (!discordGuild) {
          logger.warn(`Guild ${guildId} not found in cache for refresh request`);
          return;
        }

        const guildName = discordGuild.name;
        const guildIconUrl = discordGuild.iconURL();

        const voiceChannelsData = buildVoiceChannelsSnapshot(
          discordGuild.channels.cache
            .filter((ch) => ch.isVoiceBased())
            .map((ch) => adaptVoiceChannel(ch as import('discord.js').VoiceChannel)),
          { sorted: true },
        );

        const updateData: Record<string, unknown> = {
          voiceChannels: voiceChannelsData,
          guildName,
        };
        if (guildIconUrl) updateData.guildIconUrl = guildIconUrl;

        await firebase.updateGuildDoc(guildId, updateData);
        logger.debug(`Refreshed voice channels for guild ${guildId}`);
      } catch (e) {
        reportError(e, { tags: { handler: 'guildRefresh' }, extra: { guildId } });
      } finally {
        // Best-effort clear; the refresh fires again on the next request, so
        // a transient failure here is recoverable. Keep at debug.
        try {
          await firebase.updateGuildDoc(guildId, { refreshRequest: DELETE_FIELD });
        } catch (e) {
          logger.debug(`Failed to clear refreshRequest for guild ${guildId}: ${e}`);
        }
      }
    });

    if (guildRefreshListener) {
      logger.info('Listening for guild refresh requests from activity frontend');
    }

    // Track every lobby doc and keep its voice members in sync. Existing docs
    // arrive as 'added' on startup, so tracking survives restarts.
    channelListener = sessionService.listen();

    if (channelListener) {
      logger.info('Tracking lobby docs');
    }
  });

  // -- Interaction handler --
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
    } catch (e) {
      reportError(e, {
        tags: {
          handler: 'interaction',
          command: interaction.isChatInputCommand() ? interaction.commandName : 'modal',
          guild: interaction.guildId ?? 'DM',
        },
        user: { id: interaction.user.id, username: interaction.user.username },
      });
      const errorMsg = '❌ An error occurred while processing your command.';
      try {
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMsg, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMsg, ephemeral: true });
          }
        }
      } catch (replyErr) {
        // warn (not debug) — user saw no error feedback at all, worth
        // surfacing in prod logs so we notice interaction failures.
        logger.warn(`Failed to send error reply to interaction: ${replyErr}`);
      }
    }
  });

  async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const sender = createInteractionSender(interaction);
    const member = interaction.member as import('discord.js').GuildMember | null;

    const guildObj = interaction.guild ? { id: interaction.guild.id } : null;
    const textChannel = interaction.channel && 'send' in interaction.channel
      ? interaction.channel
      : null;

    switch (interaction.commandName) {
      case 'wheel': {
        const voiceChannel = member?.voice.channel;
        const voiceMembers = voiceChannel
          ? voiceChannel.members.map((m) => adaptMember(m))
          : [];
        await groupsHandler.wheel({
          guild: guildObj,
          author: {
            id: interaction.user.id,
            name: getReporterName(interaction),
            voice: voiceChannel
              ? { channel: adaptVoiceChannelForCtx(voiceChannel as import('discord.js').VoiceChannel) }
              : null,
          },
          channel: {
            members: voiceMembers,
            async sendTyping() {
              if (textChannel && 'sendTyping' in textChannel) {
                await (textChannel as unknown as { sendTyping(): Promise<void> }).sendTyping();
              }
            },
          },
          send: sender.send,
          defer: sender.defer,
        });
        break;
      }

      case 'wheelson': {
        const voiceChannel = member?.voice.channel;
        // activity's getOrCreateSession needs the adapter Guild shape
        const activityGuild = adaptGuild(interaction.guild, adaptVoiceChannel);
        await groupsHandler.activity(
          {
            guild: activityGuild,
            author: {
              id: interaction.user.id,
              name: getReporterName(interaction),
              voice: voiceChannel
                ? { channel: adaptVoiceChannelForCtx(voiceChannel as import('discord.js').VoiceChannel) }
                : null,
            },
            send: sender.send,
            defer: sender.defer,
          },
        );
        break;
      }

      case 'bug': {
        const quickText = interaction.options.getString('text');

        if (quickText) {
          await sender.defer({ ephemeral: true });
          try {
            const maxTitle = 60;
            const quickTitle = quickText.length > maxTitle
              ? quickText.slice(0, maxTitle) + '...'
              : quickText;
            const reporterName = getReporterName(interaction);

            const issue = await submitGithubIssueModal({
              issueType: 'bug',
              title: quickTitle,
              description: quickText,
              extraInfo: '',
              includeLogs: true,
              reporterName,
              reporterId: interaction.user.id,
            });
            const dmSent = await notifyReporterOfIssue(interaction.user, issue);
            const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
            await sender.send(`✅ Bug reported: ${issue.html_url}${dmHint}`);
          } catch (e) {
            reportError(e, {
              tags: {
                handler: 'submitIssue',
                kind: 'bug',
                source: 'quick',
                errorType: e instanceof GitHubError ? 'github' : 'unknown',
              },
            });
            const msg = e instanceof Error ? e.message : String(e);
            await sender.send(`❌ Failed to create issue: ${msg}`);
          }
          break;
        }

        const modal = new ModalBuilder()
          .setCustomId('bug_modal')
          .setTitle('Report a Bug');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('title')
              .setLabel('Title')
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel('Description')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('steps')
              .setLabel('Reproduction Steps')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('include_logs')
              .setLabel('Include recent logs? (yes/no)')
              .setStyle(TextInputStyle.Short)
              .setValue('yes')
              .setRequired(false),
          ),
        );

        await interaction.showModal(modal);
        break;
      }

      case 'featurerequest': {
        const quickFeatureText = interaction.options.getString('text');

        if (quickFeatureText) {
          await sender.defer({ ephemeral: true });
          try {
            const maxTitle = 60;
            const quickTitle = quickFeatureText.length > maxTitle
              ? quickFeatureText.slice(0, maxTitle) + '...'
              : quickFeatureText;
            const reporterName = getReporterName(interaction);

            const issue = await submitGithubIssueModal({
              issueType: 'feature',
              title: quickTitle,
              description: quickFeatureText,
              extraInfo: '',
              includeLogs: false,
              reporterName,
              reporterId: interaction.user.id,
            });
            const dmSent = await notifyReporterOfIssue(interaction.user, issue);
            const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
            await sender.send(`✅ Feature request created: ${issue.html_url}${dmHint}`);
          } catch (e) {
            reportError(e, {
              tags: {
                handler: 'submitIssue',
                kind: 'feature',
                source: 'quick',
                errorType: e instanceof GitHubError ? 'github' : 'unknown',
              },
            });
            const msg = e instanceof Error ? e.message : String(e);
            await sender.send(`❌ Failed to create issue: ${msg}`);
          }
          break;
        }

        const modal = new ModalBuilder()
          .setCustomId('feature_modal')
          .setTitle('Request a Feature');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('title')
              .setLabel('Title')
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel('Description')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('impact')
              .setLabel('Benefit / Impact')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false),
          ),
        );

        await interaction.showModal(modal);
        break;
      }

      case 'test': {
        await debugHandler.test({
          guild: guildObj,
          channel: {
            async send(content: string) {
              return textChannel ? await textChannel.send(content) : undefined;
            },
            members: [],
            async sendTyping() {
              if (textChannel && 'sendTyping' in textChannel) {
                await (textChannel as unknown as { sendTyping(): Promise<void> }).sendTyping();
              }
            },
          },
          send: sender.send,
        });
        break;
      }

    }
  }

  // -- Modal submit handler --
  async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    const customId = interaction.customId;
    const reporterName = getReporterName(interaction);
    const reporterId = interaction.user.id;

    if (customId === 'bug_modal' || customId === 'feature_modal') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const extraInfo = customId === 'bug_modal'
          ? interaction.fields.getTextInputValue('steps')
          : interaction.fields.getTextInputValue('impact');
        const includeLogs = customId === 'bug_modal'
          ? interaction.fields.getTextInputValue('include_logs').toLowerCase().startsWith('y')
          : false;

        const issue = await submitGithubIssueModal({
          issueType: customId === 'bug_modal' ? 'bug' : 'feature',
          title,
          description,
          extraInfo,
          includeLogs,
          reporterName,
          reporterId,
        });
        const dmSent = await notifyReporterOfIssue(interaction.user, issue);
        const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
        await interaction.editReply(`✅ Issue created: ${issue.html_url}${dmHint}`);
      } catch (e) {
        reportError(e, {
          tags: {
            handler: 'submitIssue',
            kind: customId === 'bug_modal' ? 'bug' : 'feature',
            source: 'modal',
            errorType: e instanceof GitHubError ? 'github' : 'unknown',
          },
        });
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply(`❌ Failed to create issue: ${msg}`);
      }
      return;
    }

    // Unknown modal — acknowledge to avoid Discord "did not respond" error
    await interaction.reply({ content: '❌ Unknown modal.', ephemeral: true });
  }

  // -- Voice state update --
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      const before = {
        channel: oldState.channel
          ? {
              id: oldState.channel.id,
              members: oldState.channel.members.map((m) => adaptMember(m)),
            }
          : null,
      };

      const after = {
        channel: newState.channel
          ? {
              id: newState.channel.id,
              members: newState.channel.members.map((m) => adaptMember(m)),
            }
          : null,
      };

      await sessionService.onVoiceStateUpdate(before, after);
    } catch (e) {
      reportError(e, { tags: { handler: 'voiceStateUpdate' } });
    }
  });

  // -- Graceful shutdown --
  async function shutdown() {
    logger.info('Shutting down...');
    badGroupReportListener?.unsubscribe();
    guildRefreshListener?.unsubscribe();
    channelListener?.unsubscribe();
    sessionService.shutdown();
    client.destroy();
    await Sentry.flush(2000);
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // -- Login --
  await client.login(botToken);
}

// ---------------------------------------------------------------------------
// Helper for voice channel context (commands that need voice info)
// ---------------------------------------------------------------------------

function adaptVoiceChannelForCtx(ch: import('discord.js').VoiceChannel) {
  return {
    id: ch.id,
    name: ch.name,
    members: ch.members.map((m) => adaptMember(m)),
    async createInvite() {
      const invite = await ch.createInvite({
        targetType: InviteTargetType.EmbeddedApplication,
        targetApplication: config.DISCORD_APPLICATION_ID,
        maxAge: 300,
      });
      return { url: invite.url };
    },
  };
}

// -- Start --
main().catch(async (e) => {
  reportError(e, { tags: { handler: 'fatal' } });
  await Sentry.flush(2000);
  process.exit(1);
});
