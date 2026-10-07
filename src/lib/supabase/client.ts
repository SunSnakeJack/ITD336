import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) console.warn('Supabase environment variables are not configured.')

export const supabase = createClient(url || 'http://127.0.0.1:54321', anonKey || 'development-placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export async function unwrap<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('Expected data but received none')
  return data
}
