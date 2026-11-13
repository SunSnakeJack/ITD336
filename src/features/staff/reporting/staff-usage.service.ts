import { supabase } from '../../../lib/supabase/client'
import type { StaffUsageRow, UsageCategory } from './staff-usage.types'

interface Row { transaction_id:string;source:string;room_id:string;room_code:string;room_name:string;room_category:UsageCategory;purpose:string;user_name:string;starts_at:string;ends_at:string;returned_at:string|null;status:string }

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
