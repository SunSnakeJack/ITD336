import { supabase } from '../../lib/supabase/client'

export interface CatalogRole { code: string; name: string; name_th: string | null; locked: boolean }
export type RoleOperation = { operation: 'CREATE' | 'RENAME' | 'DELETE'; code: string; name: string; nameTh: string }
export const roleCatalogKey = ['staff', 'role-catalog'] as const

export async function getRoleCatalog() {
  const { data, error } = await supabase.rpc('get_admin_role_catalog_v2' as never)
  if (error) throw new Error('ไม่สามารถโหลดรายการบทบาทได้')
  return data as CatalogRole[]
}

export async function saveRoleLabel(input: RoleOperation) {
  const { error } = await supabase.rpc('manage_admin_role_label_v2' as never, {
    p_operation: input.operation, p_code: input.code, p_name: input.name, p_name_th: input.nameTh,
  } as never)
  if (!error) return
  if (error.code === '23505') throw new Error('รหัสบทบาทนี้มีอยู่แล้ว')
  if (error.message === 'ROLE_IN_USE') throw new Error('บทบาทนี้ยังถูกกำหนดให้ผู้ใช้อยู่')
  if (error.message === 'SYSTEM_ROLE_LOCKED') throw new Error('ไม่สามารถลบบทบาทที่ระบบสงวนไว้ได้')
  if (error.code === '42501') throw new Error('บัญชีนี้ไม่มีสิทธิ์จัดการบทบาท')
  throw new Error('ไม่สามารถบันทึกบทบาทได้ กรุณาตรวจสอบชื่อและรหัส')
}
