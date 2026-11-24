import { supabase } from '../../../lib/supabase/client'
import type { StaffUsageRow, UsageCategory } from './staff-usage.types'
import type { ReportDetails } from './staff-report-model'

interface Row { transaction_id:string;source:string;room_id:string;room_code:string;room_name:string;room_category:UsageCategory;purpose:string;user_name:string;starts_at:string;ends_at:string;returned_at:string|null;status:string }

export async function getStaffUsageReportDetails(): Promise<ReportDetails[] | null> {
  // Null allows the report to render while migration 0120 is being rolled out.
  const { data, error } = await supabase.rpc('get_staff_usage_report_details')
  if (error?.code === 'PGRST202') return null
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function confirmOverdueRoomKeyReturns({ roomId, count }: { roomId: string; count: number | null }) {
  // Migration 0101 provides this RPC. Validate its integer response until types can be regenerated.
  const { data, error } = await supabase.rpc('staff_confirm_overdue_key_returns' as never, {
    p_room_id: roomId,
    p_expected_count: count,
  } as never)
  const updatedCount: unknown = data
  if (error?.code === '42501') throw new Error('บัญชีนี้ไม่มีสิทธิ์ยืนยันการรับกุญแจ')
  if (error?.message === 'OVERDUE_RETURN_SET_CHANGED') {
    throw new Error('รายการเกินกำหนดมีการเปลี่ยนแปลง กรุณาปิดหน้าต่างแล้วเปิดใหม่เพื่อตรวจสอบจำนวนล่าสุด')
  }
  if (error || typeof updatedCount !== 'number') throw new Error('บันทึกการคืนกุญแจไม่สำเร็จ กรุณาลองใหม่')
  return updatedCount
}

export async function getStaffUsageHistory(): Promise<StaffUsageRow[]> {
  const { data, error } = await supabase.rpc('get_staff_usage_history' as never) as unknown as { data:Row[]|null;error:{message:string}|null }
  if (error) throw new Error(error.message)
  return (data ?? []).map(row => ({
    transactionId: row.source === 'KEY_REQUEST' ? row.transaction_id.replace('key-request:', '') : row.transaction_id,
    source: row.source, roomId: row.room_id, roomCode: row.room_code, roomName: row.room_name,
    roomCategory: row.room_category, purpose: row.purpose, userName: row.user_name,
    startsAt: row.starts_at, endsAt: row.ends_at, returnedAt: row.returned_at, status: row.status,
  }))
}
