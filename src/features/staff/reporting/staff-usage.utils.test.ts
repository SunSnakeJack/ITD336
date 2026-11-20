import{describe,expect,it}from'vitest'
import{filterUsageRows,monthlyUsage,staffUsageStatus,topUsers}from'./staff-usage.utils'
import type{StaffUsageRow}from'./staff-usage.types'
const rows=[
 {transactionId:'1',source:'BOOKING',roomId:'m',roomCode:'M1',roomName:'Meeting',roomCategory:'MEETING',purpose:'A',userName:'Ann',startsAt:'2026-10-01T01:00:00Z',endsAt:'2026-10-01T02:00:00Z',returnedAt:null,status:'COMPLETED'},
 {transactionId:'2',source:'KEY_REQUEST',roomId:'g',roomCode:'S1',roomName:'Lab',roomCategory:'GENERAL_LAB',purpose:'B',userName:'Ann',startsAt:'2026-11-01T01:00:00Z',endsAt:'2026-11-01T02:00:00Z',returnedAt:null,status:'RETURNED'},
 {transactionId:'3',source:'KEY_REQUEST',roomId:'s',roomCode:'ST',roomName:'Studio',roomCategory:'SPECIAL_LAB',purpose:'C',userName:'Bob',startsAt:'2026-11-02T01:00:00Z',endsAt:'2026-11-02T02:00:00Z',returnedAt:null,status:'RETURNED'},
]satisfies StaffUsageRow[]
describe('staff usage analytics',()=>{it('filters by category and range',()=>expect(filterUsageRows(rows,{category:'GENERAL_LAB',roomId:'',from:'2026-11-01',to:'2026-11-30'})).toHaveLength(1));it('groups months',()=>expect(monthlyUsage(rows)).toEqual([{month:'2026-10',count:1},{month:'2026-11',count:2}]));it('ranks users',()=>expect(topUsers(rows)[0]).toEqual(['Ann',2]))})

describe('staff usage return status', () => {
  const end = Date.parse(rows[1].endsAt)

  it.each([['KEY_REQUEST', 'APPROVED'], ['KEY_REQUEST', 'IN_USE'], ['KEY_LOAN', 'CHECKED_OUT']])(
    'marks an unreturned %s in %s as late only after its end time',
    (source, status) => {
      const row = { ...rows[1], source, status }
      expect(staffUsageStatus(row, end)).toBe(status)
      expect(staffUsageStatus(row, end + 1)).toBe('LATE')
    },
  )

  it('distinguishes the actual return from an outstanding key', () => {
    const row = { ...rows[1], status: 'RETURNED' }
    expect(staffUsageStatus({ ...row, returnedAt: new Date(end - 1).toISOString() }, end + 10)).toBe('RETURNED')
    expect(staffUsageStatus({ ...row, returnedAt: row.endsAt }, end + 10)).toBe('RETURNED')
    expect(staffUsageStatus({ ...row, returnedAt: new Date(end + 1).toISOString() }, end + 10)).toBe('RETURNED_LATE')
    expect(staffUsageStatus(row, end + 10)).toBe('RETURNED')
  })

  it('preserves pending, rejected and meeting booking statuses', () => {
    expect(staffUsageStatus({ ...rows[1], status: 'PENDING_APPROVAL' }, end + 1)).toBe('PENDING_APPROVAL')
    expect(staffUsageStatus({ ...rows[1], status: 'REJECTED' }, end + 1)).toBe('REJECTED')
    expect(staffUsageStatus({ ...rows[0], status: 'APPROVED' }, end + 1)).toBe('APPROVED')
  })

  it('expires pending special-room requests at the end, not the start', () => {
    const row = { ...rows[2], status: 'PENDING_APPROVAL' }
    const startAt = Date.parse(row.startsAt)
    const endAt = Date.parse(row.endsAt)
    expect(staffUsageStatus(row, startAt - 1)).toBe('PENDING_APPROVAL')
    expect(staffUsageStatus(row, startAt)).toBe('PENDING_STARTED')
    expect(staffUsageStatus(row, endAt - 1)).toBe('PENDING_STARTED')
    expect(staffUsageStatus({ ...row, status: 'PENDING_STARTED' }, endAt)).toBe('EXPIRED')
    expect(staffUsageStatus({ ...row, status: 'APPROVED' }, endAt)).toBe('APPROVED')
  })
})
