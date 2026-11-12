import { describe, expect, it } from 'vitest'
import { bangkokClock, bangkokDateKey, freeRangesForBangkokDay, isSlotElapsedForBangkokDate } from './key-catalog-time'

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

  it('removes elapsed time from availability for the current Bangkok day', () => {
    expect(freeRangesForBangkokDay([
      { startsAt: '2026-11-08T04:00:00.000Z', endsAt: '2026-11-08T04:30:00.000Z' },
      { startsAt: '2026-11-08T07:00:00.000Z', endsAt: '2026-11-08T07:30:00.000Z' },
    ], '2026-11-08', new Date('2026-11-08T13:20:00+07:00'))).toEqual([
      '13:30–14:00 น.',
      '14:30–18:00 น.',
    ])
  })

  it('keeps full service hours for a future Bangkok day', () => {
    expect(freeRangesForBangkokDay([], '2026-11-09', new Date('2026-11-08T13:20:00+07:00')))
      .toEqual(['08:00–18:00 น.'])
  })

  it('has no remaining availability after service hours', () => {
    expect(freeRangesForBangkokDay([], '2026-11-08', new Date('2026-11-08T18:01:00+07:00')))
      .toEqual([])
  })

  it('determines if a time slot has elapsed for a given Bangkok date', () => {
    const afternoon = new Date('2026-11-08T14:00:00+07:00')
    expect(isSlotElapsedForBangkokDate('08:00', '2026-11-08', afternoon)).toBe(true)
    expect(isSlotElapsedForBangkokDate('13:30', '2026-11-08', afternoon)).toBe(true)
    expect(isSlotElapsedForBangkokDate('14:00', '2026-11-08', afternoon)).toBe(false)
    expect(isSlotElapsedForBangkokDate('14:30', '2026-11-08', afternoon)).toBe(false)

    const afternoonPlusMinute = new Date('2026-11-08T14:01:00+07:00')
    expect(isSlotElapsedForBangkokDate('14:00', '2026-11-08', afternoonPlusMinute)).toBe(true)
    expect(isSlotElapsedForBangkokDate('14:30', '2026-11-08', afternoonPlusMinute)).toBe(false)

    // Future date: nothing is elapsed
    expect(isSlotElapsedForBangkokDate('08:00', '2026-11-09', afternoon)).toBe(false)

    // Past date: all are elapsed
    expect(isSlotElapsedForBangkokDate('17:30', '2026-11-07', afternoon)).toBe(true)

    // 18:00 end boundary check
    const evening = new Date('2026-11-08T18:01:00+07:00')
    expect(isSlotElapsedForBangkokDate('18:00', '2026-11-08', evening)).toBe(true)
  })

  it('keeps elapsed slots available only when the managed exception is enabled',()=>{
    const afternoon=new Date('2026-11-08T13:30:00+07:00')
    expect(isSlotElapsedForBangkokDate('08:00','2026-11-08',afternoon,true)).toBe(false)
    expect(freeRangesForBangkokDay([],'2026-11-08',afternoon,true)).toEqual(['08:00–18:00 น.'])
  })
})
