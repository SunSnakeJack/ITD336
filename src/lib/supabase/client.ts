import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) console.warn('Supabase environment variables are not configured.')

const SESSION_ONLY_MARKER = 'itd336-session-only'
let sessionOnly = window.sessionStorage.getItem(SESSION_ONLY_MARKER) === 'true'

const authStorage = {
  getItem(key: string) {
    return sessionOnly ? window.sessionStorage.getItem(key) : window.localStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    const target = sessionOnly ? window.sessionStorage : window.localStorage
    const other = sessionOnly ? window.localStorage : window.sessionStorage
    target.setItem(key, value)
    other.removeItem(key)
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export function setSessionPersistence(remember: boolean) {
  sessionOnly = !remember
  if (sessionOnly) window.sessionStorage.setItem(SESSION_ONLY_MARKER, 'true')
  else window.sessionStorage.removeItem(SESSION_ONLY_MARKER)
}

export const supabase = createClient<Database>(url || 'http://127.0.0.1:54321', anonKey || 'development-placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: authStorage },
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
