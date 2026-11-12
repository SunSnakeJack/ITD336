import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql=readFileSync(join(process.cwd(),'supabase/migrations/0057_admin_room_management.sql'),'utf8')

describe('admin room management migration',()=>{
  it('adds only missing rich room metadata',()=>{
    expect(sql).toContain('add column if not exists image_url text')
    expect(sql).toContain('add column if not exists computer_type text')
    expect(sql).toContain('add column if not exists display_type text')
  })

  it('guards transactional room and equipment writes',()=>{
    expect(sql.match(/public\.has_permission\('ROOM_MANAGE'\)/g)).toHaveLength(3)
    expect(sql).toContain('delete from public.room_equipment where room_id=v_room_id')
    expect(sql).toContain('insert into public.room_equipment')
    expect(sql).toContain("'ROOM_CREATED'")
    expect(sql).toContain("'ROOM_UPDATED'")
  })
})
