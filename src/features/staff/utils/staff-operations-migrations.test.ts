import{readFileSync}from'node:fs'
import{join}from'node:path'
import{describe,expect,it}from'vitest'
const storage=readFileSync(join(process.cwd(),'supabase/migrations/0062_room_image_storage.sql'),'utf8').toLowerCase()
const queue=readFileSync(join(process.cwd(),'supabase/migrations/0063_staff_key_request_queue.sql'),'utf8').toLowerCase()
describe('staff operational migrations',()=>{
 it('limits room image writes to room managers',()=>{expect(storage).toContain("'room-images'");expect(storage).toContain("public.has_permission('room_manage')");expect(storage).toContain('file_size_limit')})
 it('exposes the current key request queue through existing decision permissions',()=>{expect(queue).toContain('from public.key_requests');expect(queue).toContain("public.has_permission('key_manage')");expect(queue).toContain("'pending_approval'")})
})
