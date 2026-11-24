import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRoleCatalog, roleCatalogKey, saveRoleLabel, type CatalogRole, type RoleOperation } from '../staff-role-label.service'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { auditLogKeys } from '../audit/staff-audit'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import { StaffRoleLabelEditor } from '../components/StaffRoleLabelEditor'
import { staffUserKeys } from '../staff-user.queries'
import './StaffRoleSettingsPage.css'

const filters = { all: 'ทั้งหมด', system: 'บทบาทระบบ', custom: 'ป้ายกำกับ' } as const
const pageSize = 5

export function StaffRoleSettingsPage() {
  const client = useQueryClient()
  const roles = useQuery({ queryKey: roleCatalogKey, queryFn: getRoleCatalog })
  const [showRoles, setShowRoles] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<keyof typeof filters>('all')
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<RoleOperation | null>(null)
  const save = useMutation({ mutationFn: saveRoleLabel, onSuccess: async () => {
    setDraft(null)
    await Promise.all([roleCatalogKey, staffUserKeys.roles, staffUserKeys.directory, auditLogKeys].map(queryKey => client.invalidateQueries({ queryKey })))
  } })
  const open = (operation: RoleOperation['operation'], role?: CatalogRole) => {
    save.reset()
    setDraft({ operation, code: role?.code ?? '', name: role?.name ?? '', nameTh: role?.name_th ?? '' })
  }
  const term = search.trim().toLocaleLowerCase()
  const matching = (roles.data ?? []).filter(role =>
    (filter === 'all' || role.locked === (filter === 'system')) &&
    [role.name, role.name_th, role.code].some(value => value?.toLocaleLowerCase().includes(term)),
  )
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = matching.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return <StaffPage eyebrow="" title="การตั้งค่าเพิ่มเติม" description="" hideHeader>
    <nav className="staff-extra-categories" aria-label="หมวดการตั้งค่าเพิ่มเติม">
      <button type="button" aria-expanded={showRoles} aria-controls="staff-role-panel" onClick={() => setShowRoles(value => !value)}>
        <strong>บทบาท</strong>{roles.isSuccess && <small>{roles.data.length} บทบาท</small>}
      </button>
    </nav>
    <section id="staff-role-panel" hidden={!showRoles} aria-labelledby="staff-role-heading">
      <h2 id="staff-role-heading">จัดการบทบาท</h2>
      <div className="staff-role-toolbar">
        <input type="search" aria-label="ค้นหาบทบาท" placeholder="ค้นหาบทบาท" value={search}
          onChange={event => { setSearch(event.target.value); setPage(1) }} />
        <div role="group" aria-label="ประเภทบทบาท">
          {(['all', 'system', 'custom'] as const).map(value => <button key={value} type="button"
            aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1) }}>{filters[value]}</button>)}
        </div>
        <button className="staff-button" type="button" onClick={() => open('CREATE')}>+ เพิ่มบทบาท</button>
      </div>
      <StaffQueryState loading={roles.isPending} error={roles.error} empty={!matching.length} emptyText="ไม่พบบทบาทที่ตรงกับการค้นหา">
        <div className="staff-table-wrap staff-role-table-wrap" role="region" aria-label="ตารางบทบาท" tabIndex={0}>
          <table className="staff-table staff-role-compact-table">
            <thead><tr><th scope="col">ชื่อบทบาท</th><th scope="col">รหัส</th><th scope="col">ประเภท</th><th scope="col">จัดการ</th></tr></thead>
            <tbody>{visible.map(role => <tr key={role.code}>
              <td><strong>{role.name}</strong>{role.name_th && role.name_th !== role.name && <small>{role.name_th}</small>}</td>
              <td><code>{role.code}</code></td><td>{role.locked ? 'บทบาทระบบ' : 'ป้ายกำกับ'}</td>
              <td><div className="staff-role-row-actions">
                <button type="button" aria-label={`แก้ไข ${role.name}`} onClick={() => open('RENAME', role)}>แก้ไข</button>
                {!role.locked && <button className="staff-role-delete" type="button" aria-label={`ลบ ${role.name}`}
                  onClick={() => open('DELETE', role)}>ลบ</button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {pageCount > 1 && <nav className="staff-role-pagination" aria-label="หน้ารายการบทบาท">
          <span>หน้า {currentPage} จาก {pageCount}</span>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
        </nav>}
      </StaffQueryState>
    </section>
    {draft?.operation === 'DELETE' && <ConfirmDialog title="ลบบทบาท"
      message={`ลบป้ายกำกับ «${draft.name}» ออกจากระบบหรือไม่?`} confirmLabel="ลบบทบาท" danger
      pending={save.isPending} error={save.error?.message} onClose={() => setDraft(null)} onConfirm={() => save.mutate(draft)}/>}
    {draft && draft.operation !== 'DELETE' && <StaffRoleLabelEditor draft={draft} pending={save.isPending}
      error={save.error?.message} onChange={setDraft} onClose={() => setDraft(null)} onSave={() => save.mutate(draft)} />}
  </StaffPage>
}
