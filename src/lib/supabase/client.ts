import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) console.warn('Supabase environment variables are not configured.')

export const supabase = createClient<Database>(url || 'http://127.0.0.1:54321', anonKey || 'development-placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

interface SupabaseResult { data: unknown; error: { message: string } | null }

export async function unwrap<T>(request: PromiseLike<unknown>): Promise<T> {
  const { data, error } = await request as SupabaseResult
  if (error) throw new Error(error.message)
  if (data === null || data === undefined) throw new Error('Expected data but received none')
  return data as T
}

export async function execute(request: PromiseLike<unknown>): Promise<void> {
  const { error } = await request as SupabaseResult
  if (error) throw new Error(error.message)
}
