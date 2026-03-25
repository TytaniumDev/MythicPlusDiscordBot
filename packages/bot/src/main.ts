import { initSentry, Sentry } from './core/sentry.js';
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
  ButtonBuilder,
  ButtonStyle as DjsButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InviteTargetType,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Message as DjsMessage,
  type Interaction,
} from 'discord.js';
import * as config from './core/config.js';
import logger from './core/logger.js';
import { GroupService } from './services/groupService.js';
import { SessionService, type Bot, type Guild, type VoiceChannel } from './services/sessionService.js';
import { GeneralHandler } from './commands/general.js';
import { GroupsHandler } from './commands/groups.js';
import { DebugHandler } from './commands/debug.js';
import { onReady } from './events/ready.js';
import { getWowName, getPlayerList, type DiscordMember } from './core/utils.js';
import { FirebaseService, DELETE_FIELD } from './core/firebaseService.js';
import { WoWPlayer, WoWGroup } from '@mythicplus/shared';
import { reportBadGroup, submitGithubIssueModal } from './core/issues.js';
import { getPreferenceService } from './core/preferenceService.js';
import {
  createMainSpecView,
  createOffspecView,
  createUtilitiesView,
  handleRoleButtonClick,
  handleNoneButtonClick,
  handleNextButtonClick,
  type RoleSelectionState,
} from './core/roleUi.js';

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

// ---------------------------------------------------------------------------
// Adapter: Discord.js Client → Bot interface for SessionService
// ---------------------------------------------------------------------------

function createBotAdapter(client: Client): Bot {
  return {
    get_guild(id: string): Guild | null {
      const g = client.guilds.cache.get(id);
      if (!g) return null;
      const guildIcon = g.iconURL();
      return {
        id: g.id,
        name: g.name,
        icon: guildIcon ? { url: guildIcon } : null,
        get voice_channels(): VoiceChannel[] {
          return g.channels.cache
            .filter((ch) => ch.isVoiceBased())
            .map((ch) => adaptVoiceChannel(ch as unknown as import('discord.js').VoiceChannel));
        },
        get_channel(chId: string): VoiceChannel | null {
          const ch = g.channels.cache.get(chId);
          if (!ch || !ch.isVoiceBased()) return null;
          return adaptVoiceChannel(ch as unknown as import('discord.js').VoiceChannel);
        },
      };
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
      opts?: { embed?: PlainEmbed; ephemeral?: boolean; view?: string },
    ) {
      // Build payload
      const payload: Record<string, unknown> = {};
      const embeds: EmbedBuilder[] = [];
      const components: ActionRowBuilder<ButtonBuilder>[] = [];

      if (typeof content === 'string') {
        if (content) payload.content = content;
        if (opts?.embed) embeds.push(toDiscordEmbed(opts.embed));
        if (opts?.ephemeral) payload.ephemeral = true;
      } else if (content && typeof content === 'object' && 'embed' in content) {
        embeds.push(toDiscordEmbed(content.embed));
      }

      // Add "Edit My Roles" button for role board views
      if (opts?.view === 'role_board') {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('role:edit')
            .setLabel('Edit My Roles')
            .setStyle(DjsButtonStyle.Success),
        );
        components.push(row);
      }

      if (embeds.length) payload.embeds = embeds;
      if (components.length) payload.components = components;

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
  new SlashCommandBuilder().setName('version').setDescription('Show the bot version'),
  new SlashCommandBuilder().setName('status').setDescription('Show bot status and uptime'),
  new SlashCommandBuilder().setName('invite').setDescription('Get the bot invite link'),
  new SlashCommandBuilder().setName('wheel').setDescription('Create Mythic+ groups from voice channel members'),
  new SlashCommandBuilder().setName('wheelson').setDescription('Start a Mythic+ lobby activity'),
  new SlashCommandBuilder()
    .setName('badgroup')
    .setDescription('Report a bad group formation')
    .addStringOption((opt) => opt.setName('title').setDescription('Issue title').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('description').setDescription('Issue description').setRequired(false),
    ),
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
  new SlashCommandBuilder().setName('sitout').setDescription('Toggle sitting out of the current wheel spin round'),
  new SlashCommandBuilder().setName('test').setDescription('[Debug] Run wheel with mock players'),
];

// ---------------------------------------------------------------------------
// Role selection button state
// ---------------------------------------------------------------------------

const activeRoleSelections = new Map<string, RoleSelectionState & { currentViewIndex: number }>();

function buildRoleButtons(
  state: RoleSelectionState & { currentViewIndex: number },
): ActionRowBuilder<ButtonBuilder>[] {
  const view = state.views[state.currentViewIndex];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const groups = new Map<number, ButtonBuilder[]>();

  for (const btn of view.buttons) {
    const row = btn.row;
    let arr = groups.get(row);
    if (!arr) { arr = []; groups.set(row, arr); }

    let style: DjsButtonStyle;
    switch (btn.style) {
      case 'primary': style = DjsButtonStyle.Primary; break;
      case 'success': style = DjsButtonStyle.Success; break;
      default: style = DjsButtonStyle.Secondary; break;
    }

    const b = new ButtonBuilder()
      .setCustomId(btn.customId)
      .setLabel(btn.label)
      .setStyle(style);

    if ('disabled' in btn && btn.disabled) b.setDisabled(true);
    arr.push(b);
  }

  // Add save button on last view
  if (state.currentViewIndex === state.views.length - 1) {
    const saveRow = state.views.length; // use a new row number
    let saveArr = groups.get(saveRow);
    if (!saveArr) { saveArr = []; groups.set(saveRow, saveArr); }
    saveArr.push(
      new ButtonBuilder()
        .setCustomId(`role:${state.discordId}:save`)
        .setLabel('Save')
        .setStyle(DjsButtonStyle.Success),
    );
  }

  for (const [, btns] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...btns));
  }

  return rows;
}

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

  const generalHandler = new GeneralHandler(0, config.DISCORD_APPLICATION_ID);
  const groupsHandler = new GroupsHandler(botAdapter, groupService, sessionService);
  const debugHandler = new DebugHandler(groupService);

  // Track listeners for shutdown cleanup
  let badGroupReportListener: { unsubscribe(): void } | null = null;
  let guildRefreshListener: { unsubscribe(): void } | null = null;
  let channelRefreshListener: { unsubscribe(): void } | null = null;
  let channelStatusListener: { unsubscribe(): void } | null = null;
  let channelRemovedListener: { unsubscribe(): void } | null = null;

  // -- Ready event --
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);

    // Update latency
    generalHandler.latency = readyClient.ws.ping / 1000;

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

    // Run ready handler (preference cache, cleanup old docs)
    await onReady();

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
        lastGlobalReportTimestamp = now;

        // Per-guild rate limit: one report per minute per guild
        const reportGuildId = String(data.guildId ?? 'unknown');
        const lastTimestamp = reportTimestamps.get(reportGuildId) ?? 0;
        if (now - lastTimestamp < REPORT_COOLDOWN_MS) {
          logger.warn(`Rate-limited bad group report from guild ${reportGuildId} (doc ${docId}), skipping`);
          await firebase.deleteDoc('badGroupReports', docId);
          return;
        }
        reportTimestamps.set(reportGuildId, now);

        const playersData = (data.players ?? []) as Record<string, unknown>[];
        const groupsData = (data.groups ?? []) as Record<string, unknown>[];
        const players = playersData.map((p) => WoWPlayer.fromDict(p));
        const groups = groupsData.map((g) => WoWGroup.fromDict(g));

        const issue = await reportBadGroup({
          reporterName: String(data.reporterName ?? 'Unknown'),
          reporterId: String(data.reporterId ?? 'Unknown'),
          title: String(data.title ?? 'Bad Group Report'),
          description: String(data.description ?? ''),
          players,
          groups,
        });

        logger.info(`Bad group report processed: ${issue.html_url}`);
      } catch (e) {
        logger.error(`Failed to process bad group report ${docId}: ${e}`);
      } finally {
        // Always delete the report doc to prevent reprocessing on restart
        try {
          await firebase.deleteDoc('badGroupReports', docId);
        } catch (delErr) {
          logger.error(`Failed to delete bad group report doc ${docId}: ${delErr}`);
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

        const voiceChannelsData = discordGuild.channels.cache
          .filter((ch) => ch.isVoiceBased())
          .map((ch) => {
            const vc = ch as import('discord.js').VoiceChannel;
            const count = vc.members.filter((m) => !m.user.bot).size;
            return { id: ch.id, name: ch.name, userCount: count };
          })
          .sort((a, b) => {
            if (b.userCount !== a.userCount) return b.userCount - a.userCount;
            return a.name.localeCompare(b.name);
          });

        const updateData: Record<string, unknown> = {
          voiceChannels: voiceChannelsData,
          guildName,
        };
        if (guildIconUrl) updateData.guildIconUrl = guildIconUrl;

        await firebase.updateGuildDoc(guildId, updateData);
        logger.debug(`Refreshed voice channels for guild ${guildId}`);
      } catch (e) {
        logger.error(`Failed to refresh voice channels for guild ${guildId}: ${e}`);
      } finally {
        try {
          await firebase.updateGuildDoc(guildId, { refreshRequest: DELETE_FIELD });
        } catch {
          // best effort
        }
      }
    });

    if (guildRefreshListener) {
      logger.info('Listening for guild refresh requests from activity frontend');
    }

    // Listen for channel player refresh requests from the activity frontend.
    // When a user selects a voice channel in the embedded app, the frontend
    // creates a channel doc with refreshPlayers=true. The bot responds by
    // populating the players array from the Discord voice channel.
    channelRefreshListener = firebase.listenForChannelPlayerRefreshRequests(async (channelId, data) => {
      try {
        const guildId = String(data.guildId ?? '');
        if (!guildId) {
          logger.warn(`Channel ${channelId} refresh request missing guildId`);
          await firebase.updateChannelDoc(channelId, { refreshPlayers: DELETE_FIELD });
          return;
        }

        const discordGuild = readyClient.guilds.cache.get(guildId);
        if (!discordGuild) {
          logger.warn(`Guild ${guildId} not found in cache for channel player refresh`);
          await firebase.updateChannelDoc(channelId, { refreshPlayers: DELETE_FIELD });
          return;
        }

        const voiceChannel = discordGuild.channels.cache.get(channelId);
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
          logger.warn(`Voice channel ${channelId} not found in guild ${guildId}`);
          await firebase.updateChannelDoc(channelId, { refreshPlayers: DELETE_FIELD });
          return;
        }

        const vc = voiceChannel as import('discord.js').VoiceChannel;
        const members = vc.members.filter((m) => !m.user.bot);

        // Refresh preference cache for these members so roles are up-to-date
        const prefSvc = getPreferenceService();
        await Promise.all(
          members.map((m) => prefSvc.refreshPreference(m.id)),
        );

        const players = getPlayerList(members.map((m) => adaptMember(m)));
        const playersData = players.map((p) => p.toDict());

        await firebase.updateChannelDoc(channelId, {
          players: playersData,
          refreshPlayers: DELETE_FIELD,
        });

        // Register the channel as active so voice state changes are tracked.
        if (!sessionService.activeChannels.has(channelId)) {
          sessionService.activeChannels.set(channelId, {
            docId: channelId,
            guildId,
          });
          sessionService.activeGuilds.add(guildId);
        }

        logger.debug(`Refreshed players for channel ${channelId} (${playersData.length} players)`);
      } catch (e) {
        logger.error(`Failed to refresh players for channel ${channelId}: ${e}`);
      }
    });

    if (channelRefreshListener) {
      logger.info('Listening for channel player refresh requests from activity frontend');
    }

    // Listen for channel status changes to announce completion to Discord.
    // Also handles lobby resets to clear the dedup guard for subsequent rounds.
    channelStatusListener = firebase.listenForChannelStatusChanges(async (channelId, data) => {
      try {
        // New round resets dedup guard so the next completion can be announced
        if (data.status === 'lobby') {
          sessionService.announcedChannels.delete(channelId);
          return;
        }

        // Only announce once per completion (prevents duplicates if doc is modified again)
        if (sessionService.announcedChannels.has(channelId)) return;
        sessionService.announcedChannels.add(channelId);

        const announceResults = data.announceResults !== false;
        if (!announceResults) {
          logger.debug(`Channel ${channelId} completed but announceResults is false, skipping`);
          return;
        }

        // Resolve guild/channel using string-based Discord.js cache lookups
        const guildId = String(data.guildId ?? '');
        const discordGuild = readyClient.guilds.cache.get(guildId);
        if (!discordGuild) {
          logger.warn(`Guild ${guildId} not in cache for completion announcement`);
          return;
        }
        const discordChannel = discordGuild.channels.cache.get(channelId);
        if (!discordChannel || !discordChannel.isVoiceBased()) {
          logger.warn(`Voice channel ${channelId} not found in guild ${guildId}`);
          return;
        }

        const vc = adaptVoiceChannel(discordChannel as import('discord.js').VoiceChannel);
        await sessionService.announceCompletion(vc, data);
        logger.info(`Announced completion for channel ${channelId}`);
      } catch (e) {
        logger.error(`Failed to announce completion for channel ${channelId}: ${e}`);
      }
    });

    if (channelStatusListener) {
      logger.info('Listening for channel status changes from activity frontend');
    }

    // Listen for channel docs being removed (e.g. frontend cleanup or TTL expiry)
    channelRemovedListener = firebase.listenForChannelRemovedDocs((docId) => {
      sessionService.handleCollectionRemoved({ document: { id: docId } });
    });

    if (channelRemovedListener) {
      logger.info('Listening for channel doc removals');
    }
  });

  // -- Interaction handler --
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
    } catch (e) {
      logger.error(`Interaction error: ${e}`);
      Sentry.captureException(e, {
        tags: {
          command: interaction.isChatInputCommand() ? interaction.commandName : 'button',
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
      } catch {
        // best effort
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
      case 'version':
        await generalHandler.version({ guild: guildObj, send: sender.send });
        break;

      case 'status':
        generalHandler.latency = client.ws.ping / 1000;
        await generalHandler.status({ guild: guildObj, send: sender.send });
        break;

      case 'invite':
        await generalHandler.invite({ guild: guildObj, send: sender.send });
        break;

      case 'wheel': {
        const voiceChannel = member?.voice.channel;
        const voiceMembers = voiceChannel
          ? voiceChannel.members.map((m) => adaptMember(m))
          : [];
        await groupsHandler.wheel({
          guild: guildObj,
          author: {
            id: interaction.user.id,
            name: member?.displayName ?? interaction.user.displayName,
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
        // activity's getOrCreateSession needs extra guild fields; cast to satisfy handler
        const djsGuild = interaction.guild;
        const activityIconUrl = djsGuild?.iconURL();
        const activityGuild = djsGuild
          ? {
              id: djsGuild.id,
              name: djsGuild.name,
              icon: activityIconUrl ? { url: activityIconUrl } : null,
              voice_channels: djsGuild.channels.cache
                .filter((ch) => ch.isVoiceBased())
                .map((ch) => adaptVoiceChannel(ch as import('discord.js').VoiceChannel)),
              get_channel(chId: string): VoiceChannel | null {
                const ch = djsGuild.channels.cache.get(chId);
                if (!ch || !ch.isVoiceBased()) return null;
                return adaptVoiceChannel(ch as import('discord.js').VoiceChannel);
              },
            }
          : null;
        await groupsHandler.activity(
          {
            guild: activityGuild,
            author: {
              id: interaction.user.id,
              name: member?.displayName ?? interaction.user.displayName,
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

      case 'badgroup': {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');

        // If no title provided, show a modal for the user to fill in
        if (title == null) {
          const guildId = guildObj?.id ?? null;
          const lastResults = guildId ? groupService.lastResults.get(guildId) : undefined;
          if (!lastResults) {
            await sender.send(
              '❌ No group creation data found for this server. Run /wheel first.',
            );
            break;
          }

          const modal = new ModalBuilder()
            .setCustomId('badgroup_modal')
            .setTitle('Report Bad Group');

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
          );

          await interaction.showModal(modal);
          break;
        }

        await groupsHandler.badgroup(
          {
            guild: guildObj,
            author: {
              id: interaction.user.id,
              name: member?.displayName ?? interaction.user.displayName,
            },
            send: sender.send,
            defer: sender.defer,
          },
          title,
          description,
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
            const reporterName = member?.displayName ?? interaction.user.displayName;

            const issue = await submitGithubIssueModal({
              issueType: 'bug',
              title: quickTitle,
              description: quickText,
              extraInfo: '',
              includeLogs: true,
              reporterName,
              reporterId: interaction.user.id,
            });
            await sender.send(`✅ Bug reported: ${issue.html_url}`);
          } catch (e) {
            logger.error(`Failed to submit quick bug: ${e}`);
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
            const reporterName = member?.displayName ?? interaction.user.displayName;

            const issue = await submitGithubIssueModal({
              issueType: 'feature',
              title: quickTitle,
              description: quickFeatureText,
              extraInfo: '',
              includeLogs: false,
              reporterName,
              reporterId: interaction.user.id,
            });
            await sender.send(`✅ Feature request created: ${issue.html_url}`);
          } catch (e) {
            logger.error(`Failed to submit quick feature request: ${e}`);
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

      case 'sitout': {
        const voiceChannel = member?.voice.channel;
        if (!voiceChannel) {
          await interaction.reply({ content: 'You must be in a voice channel with an active session.', ephemeral: true });
          break;
        }
        if (!sessionService.activeChannels.has(voiceChannel.id)) {
          await interaction.reply({ content: 'No active session in your voice channel. Start one with /wheelson first.', ephemeral: true });
          break;
        }
        const result = await sessionService.toggleSitOut(voiceChannel.id, interaction.user.id);
        if (!result.active) {
          await interaction.reply({ content: 'No active session found.', ephemeral: true });
          break;
        }
        const msg = result.sittingOut
          ? "You're **sitting out** this round. You won't be included in the next spin."
          : "You're **back in**! You'll be included in the next spin.";
        await interaction.reply({ content: msg, ephemeral: true });
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

  // -- Button handler --
  async function handleButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    if (customId === 'role:edit') {
      // Start role selection for the user who clicked
      const member = interaction.member as import('discord.js').GuildMember;
      const discordId = interaction.user.id;
      const playerName = getWowName(adaptMember(member));
      const prefix = `role:${discordId}`;

      const state: RoleSelectionState & { currentViewIndex: number } = {
        playerName,
        discordId,
        selectedRoles: new Set<string>(),
        views: [],
        stepContents: [
          `**${playerName}** — Select your **main spec**:`,
          `**${playerName}** — Select your **offspecs** (optional):`,
          `**${playerName}** — Select your **utilities**:`,
        ],
        currentViewIndex: 0,
      };

      // Load existing preferences
      const prefSvc = getPreferenceService();
      const existing = prefSvc.getPreferenceSync(discordId);
      if (existing) {
        for (const r of existing) state.selectedRoles.add(r);
      }

      state.views.push(createMainSpecView(state, prefix));
      state.views.push(createOffspecView(state, prefix));
      state.views.push(createUtilitiesView(state, prefix));

      activeRoleSelections.set(discordId, state);

      const rows = buildRoleButtons(state);
      await interaction.reply({
        content: state.stepContents[0],
        components: rows,
        ephemeral: true,
      });
      return;
    }

    // Handle role selection buttons: role:<discordId>:<action>
    const match = customId.match(/^role:(\d+):(.+)$/);
    if (!match) return;

    const [, targetId, action] = match;
    if (targetId !== interaction.user.id) {
      await interaction.reply({ content: '❌ This is not your role selection.', ephemeral: true });
      return;
    }

    const state = activeRoleSelections.get(targetId);
    if (!state) {
      await interaction.reply({ content: '❌ Role selection expired. Click "Edit My Roles" again.', ephemeral: true });
      return;
    }

    const currentView = state.views[state.currentViewIndex];

    if (action === 'next') {
      const result = handleNextButtonClick(state, currentView.buttons);
      if (result) {
        state.currentViewIndex++;
        const rows = buildRoleButtons(state);
        await interaction.update({
          content: result.content,
          components: rows,
        });
      }
      return;
    }

    if (action === 'none') {
      const noneBtn = currentView.buttons.find((b) => 'clearRoles' in b);
      if (noneBtn && 'clearRoles' in noneBtn) {
        handleNoneButtonClick(state, currentView.buttons, noneBtn.clearRoles);
      }
      const rows = buildRoleButtons(state);
      await interaction.update({ components: rows });
      return;
    }

    if (action === 'save') {
      // Save roles
      const prefSvc = getPreferenceService();
      const roles = [...state.selectedRoles];
      await prefSvc.setPreference(targetId, state.playerName, roles);
      activeRoleSelections.delete(targetId);

      await interaction.update({
        content: `Saved roles for **${state.playerName}**: ${roles.length > 0 ? roles.join(', ') : 'none'}`,
        components: [],
      });

      // Sync updated roles to Firebase for any active sessions in this guild
      try {
        const guild = interaction.guild;
        if (guild) {
          const channelIds = sessionService.getActiveChannelIdsForGuild(guild.id);
          if (channelIds.length > 0) {
            const guildAdapter = createBotAdapter(client).get_guild(guild.id);
            if (guildAdapter) {
              await Promise.all(
                channelIds.map((chId) => sessionService.updateChannelPlayers(chId, guildAdapter)),
              );
            }
          }
        }
      } catch {
        // best effort — role was already saved locally
      }
      return;
    }

    // It's a role toggle
    const btn = currentView.buttons.find((b) => 'roleName' in b && b.roleName === action);
    if (btn && 'roleName' in btn) {
      handleRoleButtonClick(state, currentView.buttons, btn.roleName, btn.isMainSpec);
      const rows = buildRoleButtons(state);
      await interaction.update({ components: rows });
    }
  }

  // -- Modal submit handler --
  async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    const customId = interaction.customId;
    const member = interaction.member as import('discord.js').GuildMember | null;
    const reporterName = member?.displayName ?? interaction.user.displayName;
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
        await interaction.editReply(`✅ Issue created: ${issue.html_url}`);
      } catch (e) {
        logger.error(`Failed to submit ${customId}: ${e}`);
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply(`❌ Failed to create issue: ${msg}`);
      }
      return;
    }

    if (customId === 'badgroup_modal') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const guildId = interaction.guild?.id ?? null;
        const lastResults = guildId ? groupService.lastResults.get(guildId) : undefined;
        if (!lastResults) {
          await interaction.editReply('❌ No group data found. Run /wheel first.');
          return;
        }

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');

        const issue = await reportBadGroup({
          reporterName,
          reporterId,
          title,
          description,
          players: lastResults.players,
          groups: lastResults.groups,
        });
        await interaction.editReply(`✅ Bad group reported: ${issue.html_url}`);
      } catch (e) {
        logger.error(`Failed to submit badgroup modal: ${e}`);
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
      const member = newState.member ?? oldState.member;
      if (!member) return;

      const guild = member.guild;
      const voiceGuildIcon = guild.iconURL();
      const guildAdapter: Guild = {
        id: guild.id,
        name: guild.name,
        icon: voiceGuildIcon ? { url: voiceGuildIcon } : null,
        get voice_channels() {
          return guild.channels.cache
            .filter((ch) => ch.isVoiceBased())
            .map((ch) => adaptVoiceChannel(ch as import('discord.js').VoiceChannel));
        },
        get_channel(chId: string) {
          const ch = guild.channels.cache.get(chId);
          if (!ch || !ch.isVoiceBased()) return null;
          return adaptVoiceChannel(ch as import('discord.js').VoiceChannel);
        },
      };

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

      await groupsHandler.onVoiceStateUpdate(
        { bot: member.user.bot, guild: guildAdapter },
        before,
        after,
      );
    } catch (e) {
      logger.error(`Voice state update error: ${e}`);
      Sentry.captureException(e, { tags: { handler: 'voiceStateUpdate' } });
    }
  });

  // -- Graceful shutdown --
  async function shutdown() {
    logger.info('Shutting down...');
    badGroupReportListener?.unsubscribe();
    guildRefreshListener?.unsubscribe();
    channelRefreshListener?.unsubscribe();
    channelStatusListener?.unsubscribe();
    channelRemovedListener?.unsubscribe();
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
  logger.error(`Fatal: ${e}`);
  Sentry.captureException(e, { tags: { handler: 'fatal' } });
  await Sentry.flush(2000);
  process.exit(1);
});
