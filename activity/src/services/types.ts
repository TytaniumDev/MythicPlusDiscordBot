export interface SessionService {
  subscribeToGuild(guildId: string): () => void;
  subscribeToChannel(channelId: string): () => void;
  requestSpin(): Promise<void>;
  revealGroup(index: number): Promise<void>;
  finishSequence(): Promise<void>;
  newRound(): Promise<void>;
  cancelToLobby(): Promise<void>;
  updateAnnounce(value: boolean): Promise<void>;
  saveRoles(playerId: string, playerName: string, roles: string[]): Promise<void>;
  refreshChannels(guildId: string): Promise<void>;
  selectChannel(channelId: string, channelName: string, guildId: string): Promise<void>;
  createGuildEntry(guildId: string, discordChannelId: string | null): Promise<void>;
  reportBadGroup(title: string, description: string): Promise<void>;
  claimPlayer(playerId: string): Promise<void>;
  unclaimPlayer(playerId: string): Promise<void>;
}
