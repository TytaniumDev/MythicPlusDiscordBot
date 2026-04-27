/**
 * Returns today's date as an ISO `YYYY-MM-DD` string in the America/Los_Angeles
 * timezone. Used as the rotation key for daily group history so the bot and
 * frontend agree on "today" regardless of the runtime locale.
 *
 * The PST/PDT pin matches Tyler's home timezone — group history is meant to
 * roll over at midnight Pacific, not midnight UTC or wherever the bot
 * happens to be deployed.
 */
export function todayPST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}
