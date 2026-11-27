import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushPlaylistToDevice, rotationCycles, slotsToMediaItems } from './device-sync'
import { cycleTimeSeconds, emptySlotEntries, houseSlotEntry } from './slots'
import { IDLE_PROGRAM_NAME, idleMediaItems, isIdleProgramName } from './idle-program'
import type { CampaignSlot, SlotCreative } from './slots'

function creative(id: string, durationSeconds: 10 | 20 | 30 = 10): SlotCreative {
  return {
    id,
    url: `https://cdn.example/${id}.mp4`,
    type: 'video',
    mime: 'video/mp4',
    durationSeconds,
  }
}

function slot(index: number, name: string, creatives: SlotCreative[]): CampaignSlot {
  return { index, campaignId: `campaign-${index}`, campaignName: name, creatives }
}

describe('rotationCycles', () => {
  it('needs one cycle when every campaign has a single creative', () => {
    expect(rotationCycles([slot(1, 'a', [creative('a1')]), slot(2, 'b', [creative('b1')])])).toBe(1)
  })

  it('runs enough cycles for every creative to appear', () => {
    expect(rotationCycles([
      slot(1, 'a', [creative('a1'), creative('a2')]),
      slot(2, 'b', [creative('b1'), creative('b2'), creative('b3')]),
    ])).toBe(6)
  })

  it('caps the program length', () => {
    expect(rotationCycles([
      slot(1, 'a', [creative('a1'), creative('a2'), creative('a3'), creative('a4'), creative('a5')]),
      slot(2, 'b', [creative('b1'), creative('b2'), creative('b3'), creative('b4'), creative('b5'), creative('b6'), creative('b7')]),
    ])).toBe(6)
  })

  it('is zero with no occupied slots', () => {
    expect(rotationCycles([])).toBe(0)
  })
})

describe('slotsToMediaItems', () => {
  it('gives every campaign exactly one appearance per cycle', () => {
    const slots = [
      slot(1, 'alpha', [creative('a1'), creative('a2')]),
      slot(2, 'beta', [creative('b1')]),
    ]
    const items = slotsToMediaItems(slots)

    expect(items).toHaveLength(6) // 2 cycles x (2 slots + the GZAD banner)
    const alpha = items.filter(i => i.campaignName === 'alpha')
    const beta = items.filter(i => i.campaignName === 'beta')
    expect(alpha).toHaveLength(2)
    expect(beta).toHaveLength(2)
  })

  it('rotates creatives instead of repeating the first', () => {
    const slots = [slot(1, 'alpha', [creative('a1'), creative('a2'), creative('a3')])]
    const urls = slotsToMediaItems(slots).filter(i => i.campaignName === 'alpha').map(i => i.url)
    expect(urls).toEqual([
      'https://cdn.example/a1.mp4',
      'https://cdn.example/a2.mp4',
      'https://cdn.example/a3.mp4',
    ])
  })

  it('does not give a multi-file campaign more airtime than a single-file one', () => {
    const slots = [
      slot(1, 'many', [creative('m1'), creative('m2'), creative('m3'), creative('m4')]),
      slot(2, 'one', [creative('o1')]),
    ]
    const items = slotsToMediaItems(slots)
    const many = items.filter(i => i.campaignName === 'many').length
    const one = items.filter(i => i.campaignName === 'one').length
    expect(many).toBe(one)
  })

  it('carries the purchased slot duration through to the device', () => {
    const slots = [slot(1, 'alpha', [creative('a1', 30)])]
    expect(slotsToMediaItems(slots)[0].duration).toBe(30)
  })

  it('keeps the original MIME type so the controller picks the right decoder', () => {
    const image: SlotCreative = {
      id: 'i1',
      url: 'https://cdn.example/i1.png',
      type: 'image',
      mime: 'image/png',
      durationSeconds: 10,
    }
    expect(slotsToMediaItems([slot(1, 'alpha', [image])])[0].type).toBe('image/png')
  })

  it('preserves slot order within a cycle', () => {
    const slots = [
      slot(1, 'first', [creative('f1')]),
      slot(2, 'second', [creative('s1')]),
      slot(3, 'third', [creative('t1')]),
    ]
    expect(slotsToMediaItems(slots).map(i => i.campaignName)).toEqual(['first', 'second', 'third', 'gzad-house'])
  })

  it('produces nothing when no campaign is live', () => {
    expect(slotsToMediaItems([])).toEqual([])
  })
})

describe('pushPlaylistToDevice with nothing live', () => {
  const empty = { programName: 'gzad playlist', mediaItems: [], campaignNames: [], overflow: 0 }
  const calls: { path: string; body: { name?: string; mediaItems?: { url: string; campaignName: string }[] } }[] = []
  function screenAnswers(status: Record<string, number>) {
    calls.length = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      const path = new URL(url).pathname.split('/').pop() as string
      calls.push({ path, body: JSON.parse(init.body) })
      return new Response('{}', { status: status[path] ?? 200 })
    }))
  }
  afterEach(() => vi.unstubAllGlobals())

  it('puts the GZAD banner on instead of wiping the screen', async () => {
    screenAnswers({})
    const result = await pushPlaylistToDevice('y08-s26-60755', empty)
    expect(result).toEqual({ ok: true, cleared: true, idle: true })
    expect(calls.map(c => c.path)).toEqual(['push-program'])
    expect(calls[0].body.name).toBe(IDLE_PROGRAM_NAME)
    expect(calls[0].body.mediaItems?.map(m => m.campaignName)).toEqual([IDLE_PROGRAM_NAME])
  })

  it('wipes the screen when the banner cannot be pushed, so out-of-budget ads stop', async () => {
    screenAnswers({ 'push-program': 400 })
    const result = await pushPlaylistToDevice('y08-s26-60755', empty)
    expect(calls.map(c => c.path)).toEqual(['push-program', 'clear-program'])
    expect(result.ok).toBe(true)
    expect(result.idle).toBeUndefined()
    expect(result.error).toMatch(/banner push returned 400, screen wiped instead/)
  })

  it('reports success when the server\'s own retry put the banner on', async () => {
    // First push fails (e.g. the screen was busy); clear-program on the realtime
    // server retries the banner, and it works.
    calls.length = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      const path = new URL(url).pathname.split('/').pop() as string
      calls.push({ path, body: JSON.parse(init.body) })
      return path === 'push-program'
        ? new Response('{}', { status: 500 })
        : new Response(JSON.stringify({ success: true, idle: true }), { status: 200 })
    }))
    const result = await pushPlaylistToDevice('y08-s26-60753', empty)
    expect(result).toEqual({ ok: true, cleared: true, idle: true })
  })

  it('says so plainly when the screen really was wiped', async () => {
    calls.length = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = new URL(url).pathname.split('/').pop() as string
      return path === 'push-program'
        ? new Response('{}', { status: 500 })
        : new Response(JSON.stringify({ success: true, idle: false, wiped: true }), { status: 200 })
    }))
    const result = await pushPlaylistToDevice('y08-s26-60753', empty)
    expect(result.idle).toBeUndefined()
    expect(result.error).toBe('banner push returned 500, banner retry failed too, screen wiped so ads stop')
  })

  it('still pushes real playlists as before', async () => {
    screenAnswers({})
    const item = { url: 'https://cdn.example/a.mp4', type: 'video/mp4', duration: 10, campaignName: 'alpha' }
    const result = await pushPlaylistToDevice('y08-s26-60755', { ...empty, programName: 'alpha', mediaItems: [item], campaignNames: ['alpha'] })
    expect(result).toEqual({ ok: true, cleared: false, error: undefined })
    expect(calls[0].body.name).toBe('alpha')
  })
})

describe('isIdleProgramName', () => {
  it('recognises the banner program however the screen cases it', () => {
    expect(isIdleProgramName('gzad-idle')).toBe(true)
    expect(isIdleProgramName(' GZAD-Idle ')).toBe(true)
    expect(isIdleProgramName('gzad playlist')).toBe(false)
    expect(isIdleProgramName(undefined)).toBe(false)
  })
})

describe('idleMediaItems', () => {
  it('plays the animated banner by default and a still image when pointed at one', () => {
    expect(idleMediaItems()[0].type).toBe('video/mp4')
    expect(idleMediaItems('https://x.example/backgrounds/gzad-background-240x80.png')[0].type).toBe('image/png')
  })
})

describe('the GZAD house banner in every loop', () => {
  const names = (n: number) => Array.from({ length: n }, (_, i) => slot(i + 1, `c${i + 1}`, [creative(`c${i + 1}`)]))

  it('plays once per loop, after the client ads, whether 1 or 5 slots are taken', () => {
    for (const n of [1, 3, 5]) {
      const items = slotsToMediaItems(names(n))
      expect(items.map(i => i.campaignName)).toEqual([...names(n).map(s => s.campaignName), 'gzad-house'])
    }
  })

  it('is 10 seconds of the animated banner, under the name billing stores', () => {
    const banner = slotsToMediaItems(names(2)).at(-1)!
    expect(banner).toMatchObject({ campaignName: 'gzad-house', duration: 10, type: 'video/mp4' })
    expect(banner.url).toMatch(/gzad-logo-animated-240x80\.mp4$/)
  })

  it('closes every cycle when creatives rotate over several cycles', () => {
    const items = slotsToMediaItems([slot(1, 'ab', [creative('a'), creative('b')]), slot(2, 'one', [creative('o')])])
    expect(items.map(i => i.campaignName)).toEqual(['ab', 'one', 'gzad-house', 'ab', 'one', 'gzad-house'])
  })

  it('adds nothing when no slot is taken: that screen gets the idle banner instead', () => {
    expect(slotsToMediaItems([])).toEqual([])
  })

  it('counts the banner in the loop the admin sees, and free slots as no time', () => {
    const view = [
      { index: 1, type: 'customer' as const, durationSeconds: 20 },
      { index: 2, type: 'customer' as const, durationSeconds: 10 },
      houseSlotEntry(),
      ...emptySlotEntries(2),
    ]
    expect(view.filter(s => s.type === 'empty').map(s => s.index)).toEqual([3, 4, 5])
    expect(cycleTimeSeconds(view)).toBe(40)
  })
})
