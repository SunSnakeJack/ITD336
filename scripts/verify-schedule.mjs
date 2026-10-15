import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')] }))
const password = await new Promise((resolve) => { let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => { value += chunk; if (value.includes('\n')) resolve(value.trim()) }) })
const makeClient = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const admin = makeClient(); const student = makeClient()
const results = []
let createdId = null
const check = (name, passed, detail = '') => { results.push({ name, passed, detail }); if (!passed) throw new Error(`${name}: ${detail}`) }
const expectData = (name, response) => { check(name, !response.error, response.error?.message ?? ''); return response.data }

try {
  expectData('admin login', await admin.auth.signInWithPassword({ email: 'admin@itd336.local', password }))
  expectData('student login', await student.auth.signInWithPassword({ email: 'student@itd336.local', password }))

  const rooms = expectData('room read', await admin.from('rooms').select('id,code,name,academic_schedule_confirmed').eq('active', true).order('code'))
  const room = rooms.find((item) => item.code === '2407') ?? rooms[0]
  check('test room exists', Boolean(room), 'No active room found')

  const leftovers = expectData('find prior verification records', await admin.from('class_schedules').select('id').eq('course_code', 'ITD336-VERIFY').eq('active', true))
  for (const leftover of leftovers) expectData('deactivate prior verification record', await admin.rpc('deactivate_academic_schedule', { p_schedule_id: leftover.id, p_reason: 'Cleanup from interrupted integration verification' }))

  const mutationArgs = { p_schedule_id: null, p_room_id: room.id, p_teacher_id: null, p_course_code: 'ITD336-VERIFY', p_subject_name: 'Automated verification only', p_academic_year: '2542', p_semester: 'TEST', p_day_of_week: 1, p_start_time: '09:00', p_end_time: '12:00', p_effective_from: '2099-01-05', p_effective_until: '2099-02-02' }
  const denied = await student.rpc('upsert_academic_schedule', mutationArgs)
  check('student mutation denied', Boolean(denied.error), 'Student mutation unexpectedly succeeded')

  createdId = expectData('admin create schedule', await admin.rpc('upsert_academic_schedule', mutationArgs))
  const created = expectData('admin read created schedule', await admin.from('class_schedules').select('id,start_time,end_time,active').eq('id', createdId).single())
  check('created values persisted', created.start_time.startsWith('09:00') && created.end_time.startsWith('12:00') && created.active, JSON.stringify(created))

  const conflict = await admin.rpc('upsert_academic_schedule', { ...mutationArgs, p_schedule_id: null, p_course_code: 'ITD336-CONFLICT', p_start_time: '10:00', p_end_time: '11:00' })
  check('overlap rejected', Boolean(conflict.error), 'Overlapping schedule unexpectedly succeeded')

  expectData('admin edit schedule', await admin.rpc('upsert_academic_schedule', { ...mutationArgs, p_schedule_id: createdId, p_start_time: '10:00', p_end_time: '12:00' }))
  const edited = expectData('admin read edited schedule', await admin.from('class_schedules').select('start_time,end_time').eq('id', createdId).single())
  check('edit persisted', edited.start_time.startsWith('10:00') && edited.end_time.startsWith('12:00'), JSON.stringify(edited))

  const feed = expectData('student schedule feed', await student.rpc('get_room_schedule_events', { p_room_id: room.id, p_range_start: '2099-01-05', p_range_end: '2099-01-11' }))
  const studentEvent = feed.find((event) => event.source_id === createdId)
  check('student sees admin schedule', Boolean(studentEvent) && new Date(studentEvent.starts_at).getUTCHours() === 3, 'Edited event missing or wrong time')

  expectData('admin deactivate schedule', await admin.rpc('deactivate_academic_schedule', { p_schedule_id: createdId, p_reason: 'Automated integration verification completed' }))
  const afterDeactivate = expectData('student feed after deactivate', await student.rpc('get_room_schedule_events', { p_room_id: room.id, p_range_start: '2099-01-05', p_range_end: '2099-01-11' }))
  check('deactivated hidden from student', !afterDeactivate.some((event) => event.source_id === createdId), 'Deactivated event remains visible')

  const audit = expectData('audit read', await admin.from('audit_logs').select('action,entity_id').eq('entity_id', createdId))
  check('audit history exists', ['ACADEMIC_SCHEDULE_CREATED', 'ACADEMIC_SCHEDULE_UPDATED', 'ACADEMIC_SCHEDULE_DEACTIVATED'].every((action) => audit.some((entry) => entry.action === action)), 'Expected audit actions missing')
  createdId = null
  console.log(JSON.stringify({ ok: true, room: room.code, results }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, results, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exitCode = 1
} finally {
  if (createdId) await admin.rpc('deactivate_academic_schedule', { p_schedule_id: createdId, p_reason: 'Cleanup after interrupted integration verification' })
  await admin.auth.signOut(); await student.auth.signOut()
}
