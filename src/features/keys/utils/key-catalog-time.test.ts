import { describe, expect, it } from 'vitest'
import { bangkokClock, bangkokDateKey, freeRangesForBangkokDay } from './key-catalog-time'

describe('key catalog Bangkok time', () => {
  it('formats UTC timestamps in Asia/Bangkok', () => {
    expect(bangkokDateKey('2026-11-08T02:00:00.000Z')).toBe('2026-11-08')
    expect(bangkokClock('2026-11-08T02:00:00.000Z')).toBe('09:00')
  })

  it('subtracts only active events for the requested Bangkok day', () => {
    expect(freeRangesForBangkokDay([
      { startsAt: '2026-11-08T02:00:00.000Z', endsAt: '2026-11-08T03:00:00.000Z' },
      { startsAt: '2026-11-07T02:00:00.000Z', endsAt: '2026-11-07T03:00:00.000Z' },
    ], '2026-11-08')).toEqual(['08:00–09:00 น.', '10:00–18:00 น.'])
  })
})
