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
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type Message as DjsMessage,
  type Interaction,
} from 'discord.js';
import * as config from './core/config.js';
import logger from './core/logger.js';
import { MythicPlusBot } from './bot.js';
import { GroupService } from './services/groupService.js';
import { SessionService, type Bot, type Guild, type VoiceChannel } from './services/sessionService.js';
import { GeneralHandler } from './commands/general.js';
import { GroupsHandler } from './commands/groups.js';
import { RolesHandler } from './commands/roles.js';
import { DebugHandler } from './commands/debug.js';
import { onReady } from './events/ready.js';
import { getWowName, type DiscordMember } from './core/utils.js';
import { FirebaseService } from './core/firebaseService.js';
import { WoWPlayer, WoWGroup } from '@mythicplus/shared';
import { reportBadGroup } from './core/issues.js';
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

function createBotAdapter(client: Client, groupService: GroupService): Bot {
  return {
    groupService,
    get_guild(id: number): Guild | null {
      const g = client.guilds.cache.find((g) => g.id === String(id));
      if (!g) return null;
      return {
        id: Number(g.id),
        name: g.name,
        icon: g.iconURL() ? { url: g.iconURL()! } : null,
        get voice_channels(): VoiceChannel[] {
          return g.channels.cache
            .filter((ch) => ch.isVoiceBased())
            .map((ch) => adaptVoiceChannel(ch as unknown as import('discord.js').VoiceChannel));
        },
        get_channel(chId: number): VoiceChannel | null {
          const ch = g.channels.cache.find((c) => c.id === String(chId));
          if (!ch || !ch.isVoiceBased()) return null;
          return adaptVoiceChannel(ch as unknown as import('discord.js').VoiceChannel);
        },
      };
    },
  };
}

function adaptVoiceChannel(ch: import('discord.js').VoiceChannel): VoiceChannel {
  return {
    id: Number(ch.id),
    name: ch.name,
    get members() {
      return ch.members.map((m) => adaptMember(m));
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
  new SlashCommandBuilder().setName('activity').setDescription('Start a Mythic+ lobby activity'),
  new SlashCommandBuilder().setName('wheelson').setDescription('Start a Mythic+ lobby activity (alias)'),
  new SlashCommandBuilder().setName('readycheck').setDescription('Show the Mythic+ role board for the current channel'),
  new SlashCommandBuilder()
    .setName('badgroup')
    .setDescription('Report a bad group formation')
    .addStringOption((opt) => opt.setName('title').setDescription('Issue title').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('description').setDescription('Issue description').setRequired(false),
    ),
  new SlashCommandBuilder().setName('test').setDescription('[Debug] Run wheel with mock players'),
  new SlashCommandBuilder().setName('testcase').setDescription('[Debug] Print last wheel result as test data'),
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
    if (!groups.has(row)) groups.set(row, []);

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
    groups.get(row)!.push(b);
  }

  // Add save button on last view
  if (state.currentViewIndex === state.views.length - 1) {
    const saveRow = state.views.length; // use a new row number
    if (!groups.has(saveRow)) groups.set(saveRow, []);
    groups.get(saveRow)!.push(
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
  const botAdapter = createBotAdapter(client, groupService);
  const sessionService = new SessionService(botAdapter);

  new MythicPlusBot({
    getUser: (id) => {
      const user = client.users.cache.get(String(id));
      if (!user) return null;
      return {
        async send(content, opts) {
          await user.send({
            content,
            files: opts?.files?.map((f) => ({ name: f.filename, attachment: f.content })),
          });
        },
      };
    },
    async fetchUser(id) {
      const user = await client.users.fetch(String(id));
      return {
        async send(content, opts) {
          await user.send({
            content,
            files: opts?.files?.map((f) => ({ name: f.filename, attachment: f.content })),
          });
        },
      };
    },
  });

  const generalHandler = new GeneralHandler(0, config.DISCORD_APPLICATION_ID);
  const groupsHandler = new GroupsHandler(botAdapter, groupService, sessionService);
  const rolesHandler = new RolesHandler();
  const debugHandler = new DebugHandler(groupService);

  // Track report listener for shutdown cleanup
  let badGroupReportListener: { unsubscribe(): void } | null = null;

  // -- Ready event --
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);

    // Update latency
    generalHandler.latency = readyClient.ws.ping / 1000;

    // Register slash commands per-guild (instant) + globally (propagates over ~1 hour)
    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN!);
    const commandsJson = commands.map((c) => c.toJSON());
    try {
      // Preserve entry point commands in global registration
      const existing = (await rest.get(Routes.applicationCommands(config.DISCORD_APPLICATION_ID!))) as { type?: number }[];
      const entryPointCommands = existing.filter((cmd) => cmd.type === 4);
      const globalBody = [...commandsJson, ...entryPointCommands];
      await rest.put(Routes.applicationCommands(config.DISCORD_APPLICATION_ID!), { body: globalBody });

      // Register per-guild for instant availability
      for (const guild of readyClient.guilds.cache.values()) {
        await rest.put(Routes.applicationGuildCommands(config.DISCORD_APPLICATION_ID!, guild.id), { body: commandsJson });
      }
      logger.info(`Registered ${commands.length} slash commands (global + ${readyClient.guilds.cache.size} guilds)`);
    } catch (e) {
      logger.error(`Failed to register slash commands: ${e}`);
    }

    // Run ready handler (preference cache, cleanup old docs)
    await onReady();

    // Listen for bad group reports from the activity frontend
    const firebase = FirebaseService.getInstance();
    let lastReportTimestamp = 0; // global rate limit (guildId is untrusted client data)
    const REPORT_COOLDOWN_MS = 60_000; // 1 minute between any reports

    badGroupReportListener = firebase.listenForBadGroupReports(async (docId, data) => {
      try {
        // Global rate limit: one report per minute across all sources
        const now = Date.now();
        if (now - lastReportTimestamp < REPORT_COOLDOWN_MS) {
          logger.warn(`Rate-limited bad group report (doc ${docId}), skipping`);
          await firebase.deleteDoc('badGroupReports', docId);
          return;
        }
        lastReportTimestamp = now;

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
  });

  // -- Interaction handler --
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
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

    const guildObj = interaction.guild ? { id: Number(interaction.guild.id) } : null;
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
        await groupsHandler.wheel({
          guild: guildObj,
          author: {
            id: interaction.user.id,
            name: member?.displayName ?? interaction.user.displayName,
            voice: voiceChannel
              ? { channel: adaptVoiceChannelForCtx(voiceChannel as import('discord.js').VoiceChannel) }
              : null,
          },
          send: sender.send,
          defer: sender.defer,
        });
        break;
      }

      case 'activity':
      case 'wheelson': {
        const voiceChannel = member?.voice.channel;
        // activity's getOrCreateSession needs extra guild fields; cast to satisfy handler
        const activityGuild = interaction.guild
          ? {
              id: Number(interaction.guild.id),
              name: interaction.guild.name,
              icon: interaction.guild.iconURL() ? { url: interaction.guild.iconURL()! } : null,
              voice_channels: interaction.guild.channels.cache
                .filter((ch) => ch.isVoiceBased())
                .map((ch) => adaptVoiceChannel(ch as import('discord.js').VoiceChannel)),
            }
          : null;
        await groupsHandler.activity(
          {
            guild: activityGuild as { id: number } | null,
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

      case 'readycheck': {
        const voiceChannel = member?.voice.channel;
        const channelMembers = voiceChannel
          ? voiceChannel.members.map((m) => adaptMember(m))
          : [];

        await rolesHandler.launchRoleBoard({
          guild: guildObj,
          author: {
            ...adaptMember(member!),
            voice: voiceChannel
              ? {
                  channel: {
                    id: Number(voiceChannel.id),
                    members: voiceChannel.members.map((m) => adaptMember(m)),
                  },
                }
              : null,
          },
          channel: { members: channelMembers },
          send: sender.send,
          interaction: interaction,
        });
        break;
      }

      case 'badgroup': {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        await groupsHandler.badgroup(
          {
            guild: guildObj,
            author: {
              id: interaction.user.id,
              name: member?.displayName ?? interaction.user.displayName,
            },
            send: sender.send,
            defer: sender.defer,
            // Modal not supported in activity context; no-op stub
            interaction: { response: { sendModal: async () => {} } },
          },
          title,
          description,
        );
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          send: sender.send,
        });
        break;
      }

      case 'testcase': {
        await debugHandler.testcase({
          guild: guildObj,
          channel: {
            async send(content: string) {
              return textChannel ? await textChannel.send(content) : undefined;
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

      // Refresh the role board embed in the original message if possible
      try {
        const originalMsg = interaction.message;
        if (originalMsg.reference?.messageId) {
          // This was a reply; update the original role board
        }
      } catch {
        // best effort
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

  // -- Voice state update --
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      const member = newState.member ?? oldState.member;
      if (!member) return;

      const guild = member.guild;
      const guildAdapter: Guild = {
        id: Number(guild.id),
        name: guild.name,
        icon: guild.iconURL() ? { url: guild.iconURL()! } : null,
        get voice_channels() {
          return guild.channels.cache
            .filter((ch) => ch.isVoiceBased())
            .map((ch) => adaptVoiceChannel(ch as import('discord.js').VoiceChannel));
        },
        get_channel(chId: number) {
          const ch = guild.channels.cache.find((c) => c.id === String(chId));
          if (!ch || !ch.isVoiceBased()) return null;
          return adaptVoiceChannel(ch as import('discord.js').VoiceChannel);
        },
      };

      const before = {
        channel: oldState.channel
          ? {
              id: Number(oldState.channel.id),
              members: oldState.channel.members.map((m) => adaptMember(m)),
            }
          : null,
      };

      const after = {
        channel: newState.channel
          ? {
              id: Number(newState.channel.id),
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
    sessionService.shutdown();
    client.destroy();
    await Sentry.flush(2000);
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // -- Login --
  await client.login(config.BOT_TOKEN);
}

// ---------------------------------------------------------------------------
// Helper for voice channel context (commands that need voice info)
// ---------------------------------------------------------------------------

function adaptVoiceChannelForCtx(ch: import('discord.js').VoiceChannel) {
  return {
    id: Number(ch.id),
    name: ch.name,
    members: ch.members.map((m) => adaptMember(m)),
    async createInvite() {
      const invite = await ch.createInvite({ maxAge: 86400 });
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
