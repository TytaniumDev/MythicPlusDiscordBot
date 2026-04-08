export interface SessionService {
  subscribeToGuild(guildId: string): () => void;
  subscribeToChannel(channelId: string): () => void;
  requestSpin(): Promise<void>;
  revealAllGroups(): Promise<void>;
  finishSequence(): Promise<void>;
  newRound(): Promise<void>;
  cancelToLobby(): Promise<void>;
  saveRoles(playerId: string, playerName: string, roles: string[], inGameName?: string): Promise<void>;
  saveLinkedCharacter(playerId: string, linkedCharacter: { name: string; realm: string; region: string }, mediaUrl?: string | null): Promise<void>;
  refreshChannels(guildId: string): Promise<void>;
  selectChannel(channelId: string, channelName: string, guildId: string): Promise<void>;
  createGuildEntry(guildId: string, discordChannelId: string | null): Promise<void>;
  reportBadGroup(title: string, description: string): Promise<void>;
  claimPlayer(playerId: string): Promise<void>;
  unclaimPlayer(playerId: string): Promise<void>;
  toggleSitOut(discordId: string): Promise<void>;
}
