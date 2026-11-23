import{supabase}from'../../lib/supabase/client'

// RPC signatures become available in generated types after migration 0073.
export async function getMeetingAdvanceBookingDays(): Promise<number> {
  const { data, error } = await supabase.rpc('get_meeting_advance_booking_days' as never)
  if (error) throw error
  const days: unknown = data
  if (typeof days !== 'number') throw new Error('Meeting booking limit unavailable')
  return days
}

export async function setMeetingAdvanceBookingDays(days: number) {
  const { error } = await supabase.rpc('set_meeting_advance_booking_days' as never, { p_days: days } as never)
  if (error) throw error
  return days
}
export async function setOpenSaturday(date: string | null) {
  const { error } = await supabase.rpc('set_open_saturday' as never, { p_date: date } as never)
  if (error) throw new Error(error.message)
}
export async function getKeyRequestTimingSetting(){const{data,error}=await supabase.rpc('get_admin_key_request_timing_setting' as never)as unknown as{data:boolean|null;error:{message:string}|null};if(error)throw new Error(error.message);return data===true}
export async function setKeyRequestTimingSetting(enabled:boolean){const{data,error}=await supabase.rpc('set_admin_key_request_timing_setting' as never,{p_enabled:enabled}as never)as unknown as{data:boolean|null;error:{message:string}|null};if(error)throw new Error(error.message);return data===true}

export type PermissionChanges = {
  roomPolicies?: Partial<Record<RoomPolicyCategory, RoomCategoryPolicy>>
  roleGrants?: { role: string; permission: string; enabled: boolean }[]
  meetingAdvanceDays?: number
  allowElapsed?: boolean
  openSaturday?: string | null
}

export async function savePermissionSettings(changes: PermissionChanges) {
  const { error } = await supabase.rpc('save_permission_settings_v2' as never, { p_changes: changes } as never)
  if (error) throw new Error(error.code === '42501' ? 'บัญชีนี้ไม่มีสิทธิ์บันทึกการตั้งค่า' : 'บันทึกการตั้งค่าไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่', { cause: error })
}

export type RoomPolicyCategory = 'LAB' | 'SPECIAL' | 'MEETING'
export type RoomCategoryPolicy = {
  loginForKey?: true
  days?: number[]
  opensAt?: string
  closesAt?: string
  minMinutes?: number
  maxMinutes?: number
  dailyLimit?: number
  advanceDays?: number
}

export async function getRoomCategoryPolicies() {
  const { data, error } = await supabase.rpc('get_room_category_restrictions' as never)
  if (error) throw new Error('ไม่สามารถโหลดกติกาตามประเภทห้องได้', { cause: error })
  return (data ?? {}) as Partial<Record<RoomPolicyCategory, RoomCategoryPolicy>>
}
