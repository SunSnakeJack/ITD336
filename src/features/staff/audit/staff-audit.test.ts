import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import { auditActionLabel, formatAuditTime, staffAuditQuery } from './staff-audit'

vi.mock('../../../lib/supabase/client', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: { total: 0, rows: [] }, error: null }) },
}))

describe('staff audit formatting', () => {
  it('uses the requested short Gregorian date and Bangkok time', () => {
    expect(formatAuditTime('2026-09-12T17:30:00Z')).toBe('13/09/26 00:30')
  })

  it('labels booking and role changes', () => {
    expect(auditActionLabel('KEY_REQUEST_RETURNED')).toBe('คืนกุญแจ')
    expect(auditActionLabel('ROLE_LABEL_RENAME')).toBe('แก้ไขบทบาท')
  })

  it('sends the trimmed search with both filters and the requested server page', async () => {
    const query = staffAuditQuery('USER', 'เบิกกุญแจ', 2, '  S2407  ')
    expect(query.queryKey).toEqual(['staff', 'audit-logs', 'USER', 'เบิกกุญแจ', 2, 'S2407'])
    await new QueryClient().fetchQuery(query)
    expect(supabase.rpc).toHaveBeenCalledWith('get_staff_audit_logs_search', {
      p_actor: 'USER', p_actions: expect.arrayContaining(['KEY_REQUEST_CREATED']), p_page: 2, p_search: 'S2407',
    })
  })
})
