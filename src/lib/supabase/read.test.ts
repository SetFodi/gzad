import { describe, expect, it } from 'vitest'
import { readAllRows } from './read'

describe('readAllRows', () => {
  it('includes records beyond the API page limit', async () => {
    const rows = Array.from({ length: 1003 }, (_, id) => ({ id }))
    const result = await readAllRows(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))
    expect(result).toEqual(rows)
  })

  it('rejects a later page failure instead of returning a partial total', async () => {
    await expect(readAllRows(async (from) => from === 0
      ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: 'permission denied' } },
    )).rejects.toThrow('permission denied')
  })

  it('preserves a successful empty result', async () => {
    await expect(readAllRows(async () => ({ data: [], error: null }))).resolves.toEqual([])
  })

  it('rejects a failed query instead of treating it as no records', async () => {
    await expect(readAllRows(async () => ({ data: null, error: { message: 'network unavailable' } }))).rejects.toThrow('network unavailable')
  })
})
