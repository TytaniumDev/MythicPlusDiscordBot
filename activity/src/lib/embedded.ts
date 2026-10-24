/**
 * True when the page runs as a Discord activity. Being in an iframe isn't
 * enough (Storybook's preview is iframed too), so this also requires the
 * `frame_id` query param that Discord always appends to activity URLs.
 */
export function isDiscordEmbedded(): boolean {
  try {
    const inIframe = window.self !== window.top;
    return inIframe && new URLSearchParams(window.location.search).has('frame_id');
  } catch {
    // intentional: reading window.top across origins throws, which only happens when framed
    return true;
  }
}
