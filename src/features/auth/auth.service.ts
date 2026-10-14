import type { UserAttributes } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'

import type { AuthIdentity, RoleCode } from './auth.types'

const ROLE_PRIORITY: RoleCode[] = ['ADMIN', 'PRIORITY_USER', 'STAFF', 'TEACHER', 'STUDENT']

export const getSession=()=>supabase.auth.getSession()
export const signOut=()=>supabase.auth.signOut()
export const updateMyAuthProfile=(attributes:UserAttributes)=>supabase.auth.updateUser(attributes)

export const signInWithPassword = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

export async function getMyIdentity(userId: string): Promise<AuthIdentity> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, account_status')
    .eq('id', userId)
    .single()

  if (profileError) throw new Error(profileError.message)
  if (profile.account_status !== 'ACTIVE') throw new Error('บัญชีนี้ไม่ได้เปิดใช้งาน')

  const { data: assignments, error: assignmentError } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)

  if (assignmentError) throw new Error(assignmentError.message)
  if (assignments.length === 0) throw new Error('บัญชีนี้ยังไม่ได้รับการกำหนดบทบาท')

  const { data: roles, error: roleError } = await supabase
    .from('roles')
    .select('id, code, name')
    .in('id', assignments.map(({ role_id }) => role_id))

  if (roleError) throw new Error(roleError.message)

  const role = ROLE_PRIORITY
    .map((code) => roles.find((candidate) => candidate.code === code))
    .find((candidate) => candidate !== undefined)

  if (!role) throw new Error('ไม่พบบทบาทที่ระบบรองรับสำหรับบัญชีนี้')

  return {
    userId: profile.id,
    fullName: profile.full_name || profile.email,
    email: profile.email,
    role: role.code as RoleCode,
  }
}
