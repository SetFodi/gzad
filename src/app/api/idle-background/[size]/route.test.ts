import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodePng, encodePng } from '@/lib/png'
import { GET } from './route'

// A 240×80 banner: red in its top-left pixel, green everywhere else.
function bannerPng() {
  const rgb = new Uint8Array(240 * 80 * 3)
  for (let i = 0; i < rgb.length; i += 3) rgb[i + 1] = 200
  rgb.set([255, 0, 0], 0)
  return encodePng({ width: 240, height: 80, rgb })
}

const get = (size: string) => GET(new Request(`http://x/api/idle-background/${size}`), { params: Promise.resolve({ size }) })

describe('GET /api/idle-background/[size]', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the banner top-left on a black canvas of the asked size', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bannerPng()))))
    const res = await get('1280x720.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    const image = decodePng(new Uint8Array(await res.arrayBuffer()))
    expect([image.width, image.height]).toEqual([1280, 720])
    const at = (x: number, y: number) => [...image.rgb.subarray((y * 1280 + x) * 3, (y * 1280 + x) * 3 + 3)]
    expect(at(0, 0)).toEqual([255, 0, 0])
    expect(at(239, 79)).toEqual([0, 200, 0])
    expect(at(240, 0)).toEqual([0, 0, 0])
    expect(at(0, 80)).toEqual([0, 0, 0])
  })

  it('accepts a tag after the size, which only changes the address', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bannerPng()))))
    const res = await get('1280x720-logo.png')
    expect(res.status).toBe(200)
    const image = decodePng(new Uint8Array(await res.arrayBuffer()))
    expect([image.width, image.height]).toEqual([1280, 720])
  })

  it('refuses sizes that are not WIDTHxHEIGHT or are too large', async () => {
    for (const size of ['big.png', '0x720.png', '5000x720.png', '1280x720.gif', '1280x720-../x.png', '1280x720-UPPER.png']) {
      expect((await get(size)).status).toBe(404)
    }
  })
})
