import{describe,expect,it}from'vitest'
import{filterUsageRows,monthlyUsage,topUsers}from'./staff-usage.utils'
import type{StaffUsageRow}from'./staff-usage.types'
const rows=[
 {transactionId:'1',source:'BOOKING',roomId:'m',roomCode:'M1',roomName:'Meeting',roomCategory:'MEETING',purpose:'A',userName:'Ann',startsAt:'2026-10-01T01:00:00Z',endsAt:'2026-10-01T02:00:00Z',returnedAt:null,status:'COMPLETED'},
 {transactionId:'2',source:'KEY_REQUEST',roomId:'g',roomCode:'S1',roomName:'Lab',roomCategory:'GENERAL_LAB',purpose:'B',userName:'Ann',startsAt:'2026-11-01T01:00:00Z',endsAt:'2026-11-01T02:00:00Z',returnedAt:null,status:'RETURNED'},
 {transactionId:'3',source:'KEY_REQUEST',roomId:'s',roomCode:'ST',roomName:'Studio',roomCategory:'SPECIAL_LAB',purpose:'C',userName:'Bob',startsAt:'2026-11-02T01:00:00Z',endsAt:'2026-11-02T02:00:00Z',returnedAt:null,status:'RETURNED'},
]satisfies StaffUsageRow[]
describe('staff usage analytics',()=>{it('filters by category and range',()=>expect(filterUsageRows(rows,{category:'GENERAL_LAB',roomId:'',from:'2026-11-01',to:'2026-11-30'})).toHaveLength(1));it('groups months',()=>expect(monthlyUsage(rows)).toEqual([{month:'2026-10',count:1},{month:'2026-11',count:2}]));it('ranks users',()=>expect(topUsers(rows)[0]).toEqual(['Ann',2]))})
