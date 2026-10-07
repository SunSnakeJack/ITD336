import type { UserAttributes } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
export const getSession=()=>supabase.auth.getSession()
export const signOut=()=>supabase.auth.signOut()
export const updateMyAuthProfile=(attributes:UserAttributes)=>supabase.auth.updateUser(attributes)
