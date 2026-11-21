// What a screen plays when it has no paid campaigns: the GZAD banner.
//
// Clearing a screen (clearPlayerTask) drops it back to the controller's
// factory pattern, even when a player background was set (seen on 60755,
// 21 Nov 2026, when its campaigns ran out of budget). So a group with nothing
// live gets this program instead. It is stored on the controller like any
// program, so it keeps playing without a connection.
//
// Its plays are not logged or billed (see the play-log callback), and no
// campaign may take its name.

export const IDLE_PROGRAM_NAME = 'gzad-idle'

export const IDLE_MEDIA_URL =
  process.env.NEXT_PUBLIC_IDLE_MEDIA_URL ||
  'https://pplspgbppqrtadyvjlzn.supabase.co/storage/v1/object/public/ad-media/backgrounds/gzad-background-animated-240x80.mp4'

/**
 * The filler program's single item, in the shape push-program takes. The
 * animated banner by default; NEXT_PUBLIC_IDLE_MEDIA_URL can point at a PNG
 * instead (gzad-background-240x80.png), for a screen that won't play the video.
 */
export function idleMediaItems(url: string = IDLE_MEDIA_URL) {
  const type = /\.png(\?|$)/i.test(url) ? 'image/png' : /\.jpe?g(\?|$)/i.test(url) ? 'image/jpeg' : 'video/mp4'
  return [{ url, type, duration: 10, campaignName: IDLE_PROGRAM_NAME }]
}

export function isIdleProgramName(name: unknown): boolean {
  return typeof name === 'string' && name.trim().toLowerCase() === IDLE_PROGRAM_NAME
}
