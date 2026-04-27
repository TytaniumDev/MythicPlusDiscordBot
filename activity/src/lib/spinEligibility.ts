import type { WoWPlayerDict } from '@mythicplus/shared';
import { WoWPlayer } from '@mythicplus/shared';

/**
 * Filter the channel's players down to those eligible to spin: must have at
 * least one role declared and must not appear in `sittingOut`.
 *
 * Lives here (not in `@mythicplus/shared`) because both call sites are in
 * the activity frontend and the shared package shouldn't depend on the
 * frontend's `WoWPlayerDict` shape contract beyond what's already exported.
 *
 * Both `firestoreService.requestSpin` and `demoService.requestSpin` use this
 * — keeping a single helper means demo and prod can never diverge on what
 * "eligible" means.
 */
export function eligibleSpinPlayers(
  players: WoWPlayerDict[],
  sittingOut: readonly string[],
): WoWPlayer[] {
  return players
    .filter(
      (p) =>
        (p.mainRole !== null || p.offspecs.length > 0) &&
        (!p.discordId || !sittingOut.includes(p.discordId)),
    )
    .map((p) => WoWPlayer.fromDict(p));
}
