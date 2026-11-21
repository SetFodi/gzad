import { NextResponse } from 'next/server'
import { IDLE_BANNER_URL } from '@/lib/idle-program'
import { decodePng, encodePng, placeTopLeft, type RgbImage } from '@/lib/png'

export const runtime = 'nodejs'

// GET /api/idle-background/1280x720.png: the GZAD banner in the top-left corner
// of a black image that size. Public: the controllers download it themselves.
//
// The realtime server sets this as each screen's player background, which is
// what shows instead of the factory pattern when the player has nothing to
// play. A background is stretched over the controller's whole canvas
// (1280×720 on 60755, while the LED only shows the top-left 240×80), so it has
// to be exactly the canvas size, which the server reads from each screen.

const MAX_SIDE = 4096

let banner: Promise<RgbImage> | null = null
function loadBanner(): Promise<RgbImage> {
  banner ??= fetch(IDLE_BANNER_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`banner download returned ${res.status}`)
      return decodePng(new Uint8Array(await res.arrayBuffer()))
    })
    .catch((err) => { banner = null; throw err })   // try again on the next request
  return banner
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const match = /^(\d{1,4})x(\d{1,4})(?:\.png)?$/.exec((await params).size)
  const width = Number(match?.[1])
  const height = Number(match?.[2])
  if (!match || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) {
    return NextResponse.json({ error: `size must look like 1280x720.png, each side 1 to ${MAX_SIDE}` }, { status: 404 })
  }

  try {
    const png = encodePng(placeTopLeft(await loadBanner(), width, height))
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.length),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'could not build the background' }, { status: 502 })
  }
}
