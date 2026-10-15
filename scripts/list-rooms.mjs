import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map((line) => {
  const index = line.indexOf('=')
  return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]
}))
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const password = await new Promise((resolve) => { let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => { value += chunk; if (value.includes('\n')) resolve(value.trim()) }) })
const { error: authError } = await supabase.auth.signInWithPassword({ email: 'admin@itd336.local', password })
if (authError) throw authError
const { data, error } = await supabase.from('rooms').select('id,code,name,building,floor,active,room_type_id').order('code')
if (error) throw error
console.log(JSON.stringify(data, null, 2))
