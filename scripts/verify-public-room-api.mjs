import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')] }))
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const results = []
const check = (name, passed, detail = '') => { results.push({ name, passed, detail }); if (!passed) throw new Error(`${name}: ${detail}`) }

try {
  const direct = await supabase.from('rooms').select('id').limit(1)
  check('anonymous direct table access denied', Boolean(direct.error), 'rooms table unexpectedly readable')
  const catalog = await supabase.rpc('get_public_room_catalog')
  check('public catalog RPC succeeds', !catalog.error, catalog.error?.message ?? '')
  const expected = ['STUDIO', 'ESPORT', 'ELEARNING', 'MEET-FACULTY', 'S2407', 'S2408', 'S2409', 'S2410', 'S2411', 'S2412']
  check('catalog contains approved room targets', expected.every((code) => catalog.data?.some((room) => room.code === code)), 'one or more approved rooms are missing')
  const room = catalog.data?.find((item) => item.code === 'S2407') ?? catalog.data?.[0]
  check('public room available', Boolean(room), 'catalog is empty')
  const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 6)
  const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const feed = await supabase.rpc('get_public_room_schedule_events', { p_room_id: room.id, p_range_start: key(start), p_range_end: key(end) })
  check('public schedule RPC succeeds', !feed.error, feed.error?.message ?? '')
  check('public feed hides source identifiers', (feed.data ?? []).every((event) => event.source_id === null), 'source identifier exposed')
  check('public bookings use generic title', (feed.data ?? []).filter((event) => event.event_type === 'BOOKING').every((event) => event.title === 'มีการจองห้อง'), 'booking purpose exposed')
  console.log(JSON.stringify({ ok: true, roomCount: catalog.data?.length ?? 0, checkedRoom: room.code, eventCount: feed.data?.length ?? 0, results }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, results, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exitCode = 1
}
