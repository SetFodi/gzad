import { describe, expect, it } from 'vitest'
import { rotationCycles, slotsToMediaItems } from './device-sync'
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

    expect(items).toHaveLength(4) // 2 cycles x 2 slots
    const alpha = items.filter(i => i.campaignName === 'alpha')
    const beta = items.filter(i => i.campaignName === 'beta')
    expect(alpha).toHaveLength(2)
    expect(beta).toHaveLength(2)
  })

  it('rotates creatives instead of repeating the first', () => {
    const slots = [slot(1, 'alpha', [creative('a1'), creative('a2'), creative('a3')])]
    const urls = slotsToMediaItems(slots).map(i => i.url)
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
    expect(slotsToMediaItems(slots).map(i => i.campaignName)).toEqual(['first', 'second', 'third'])
  })

  it('produces nothing when no campaign is live', () => {
    expect(slotsToMediaItems([])).toEqual([])
  })
})
