// What a screen plays when it has no paid campaigns: the GZAD banner.
//
// Clearing a screen (clearPlayerTask) drops it back to the controller's
// factory pattern, even when a player background was set (seen on 60755,
// 21 Nov 2026, when its campaigns ran out of budget). So a group with nothing
// live gets this program instead. It is stored on the controller like any
// program, so it keeps playing without a connection.
//
// Its plays are not logged or billed (see the play-log callback), and no
// campaign may take its name. Screens with ads get the same banner once per
// loop as the house slot (HOUSE_PROGRAM_NAME, below).

export const IDLE_PROGRAM_NAME = 'gzad-idle'

// The animated Gzad logo (led-images/gzad-logo-animated-240x80.mp4). When the
// banner changes, upload it under a new name rather than over the old file:
// the server caches each file's MD5 by URL and controllers cache downloads.
// Keep realtime-server/config.js idleMediaUrl the same.
export const IDLE_MEDIA_URL =
  process.env.NEXT_PUBLIC_IDLE_MEDIA_URL ||
  'https://pplspgbppqrtadyvjlzn.supabase.co/storage/v1/object/public/ad-media/backgrounds/gzad-logo-animated-240x80.mp4'

/**
 * The still 240×80 logo. The screens' player background (what the player
 * shows when it has nothing at all, e.g. right after a wipe) is built from it,
 * sized to each screen: see /api/idle-background. When it changes, also change
 * idleBackgroundTag in realtime-server/config.js so screens fetch it again.
 */
export const IDLE_BANNER_URL =
  process.env.IDLE_BANNER_URL ||
  'https://pplspgbppqrtadyvjlzn.supabase.co/storage/v1/object/public/ad-media/backgrounds/gzad-logo-240x80.png'

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

// The GZAD house slot: one 10-second banner in every loop that has client ads
// (1 to SLOTS_PER_DEVICE of them), after the last one. Same media as the idle
// program, under its own name because its plays ARE stored: billing measures
// a screen's loop from every program it played, so the banner has to be seen
// or each block would expect more plays than the loop allows and undercharge.
// It never matches a campaign, so it is never charged or counted for a client.
export const HOUSE_PROGRAM_NAME = 'gzad-house'
export const HOUSE_SLOT_SECONDS = 10

export function houseMediaItem(url: string = IDLE_MEDIA_URL) {
  return { ...idleMediaItems(url)[0], duration: HOUSE_SLOT_SECONDS, campaignName: HOUSE_PROGRAM_NAME }
}

/** For PostgREST `.not('program_name', 'in', …)`: leaves the GZAD banner's plays out of ad statistics. */
export const BANNER_PROGRAMS_FILTER = `(${IDLE_PROGRAM_NAME},${HOUSE_PROGRAM_NAME})`

/** Names no campaign may take: the screens use them for the GZAD banner. */
export function isReservedProgramName(name: unknown): boolean {
  if (typeof name !== 'string') return false
  const n = name.trim().toLowerCase()
  return n === IDLE_PROGRAM_NAME || n === HOUSE_PROGRAM_NAME
}
