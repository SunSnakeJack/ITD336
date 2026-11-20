import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRoleCatalog, roleCatalogKey, saveRoleLabel, type CatalogRole, type RoleOperation } from '../staff-role-label.service'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { auditLogKeys } from '../audit/staff-audit'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import { staffUserKeys } from '../staff-user.queries'
import { staffRoleThaiLabel } from '../utils/staff-role-label'
import './StaffSystemPages.css'

export function StaffRoleSettingsPage() {
  const client = useQueryClient()
  const roles = useQuery({ queryKey: roleCatalogKey, queryFn: getRoleCatalog })
  const [draft, setDraft] = useState<RoleOperation | null>(null)
  const save = useMutation({ mutationFn: saveRoleLabel, onSuccess: async () => {
    setDraft(null)
    await Promise.all([roleCatalogKey, staffUserKeys.roles, staffUserKeys.directory, auditLogKeys].map(queryKey => client.invalidateQueries({ queryKey })))
  } })
  const open = (operation: RoleOperation['operation'], role?: CatalogRole) => {
    save.reset()
    setDraft({ operation, code: role?.code ?? '', name: role?.name ?? '' })
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft) save.mutate(draft)
  }
  return <StaffPage eyebrow="Settings" title="การตั้งค่าเพิ่มเติม" description="" hideHeader>
    <div className="staff-role-settings-heading"><h2>การตั้งค่าบทบาท</h2>
      <button className="staff-button" type="button" onClick={() => open('CREATE')}>+ เพิ่มบทบาท</button>
    </div>
    <StaffQueryState loading={roles.isPending} error={roles.error}>
      <div className="staff-table-wrap"><table className="staff-table staff-role-settings-table">
        <thead><tr><th>ชื่อบทบาท</th><th>รหัส</th><th>ประเภท</th><th>จัดการ</th></tr></thead>
        <tbody>{roles.data?.map(role => <tr key={role.code}>
          <td><strong>{role.name}</strong>{staffRoleThaiLabel(role.code) && <small>{staffRoleThaiLabel(role.code)}</small>}</td>
          <td>{role.code}</td><td>{role.locked ? 'บทบาทระบบ' : 'ป้ายกำกับ'}</td>
          <td>{role.locked ? '—' : <div className="staff-role-settings-actions">
            <button type="button" onClick={() => open('RENAME', role)}>แก้ไข</button>
            <button type="button" onClick={() => open('DELETE', role)}>ลบ</button>
          </div>}</td>
        </tr>)}</tbody>
      </table></div>
    </StaffQueryState>
    {draft?.operation === 'DELETE' && <ConfirmDialog title="ลบบทบาท"
      message={`ลบป้ายกำกับ «${draft.name}» ออกจากระบบหรือไม่?`} confirmLabel="ลบบทบาท" danger
      pending={save.isPending} error={save.error?.message} onClose={() => setDraft(null)} onConfirm={() => save.mutate(draft)}/>}
    {draft && draft.operation !== 'DELETE' && <div className="staff-role-dialog-backdrop">
      <section className="staff-role-dialog" role="dialog" aria-modal="true" aria-labelledby="role-label-title">
        <header><h2 id="role-label-title">{draft.operation === 'CREATE' ? 'เพิ่มบทบาท' : 'แก้ไขบทบาท'}</h2>
          <button type="button" aria-label="ปิด" disabled={save.isPending} onClick={() => setDraft(null)}>×</button></header>
        <form className="staff-role-label-form" onSubmit={submit}>
          <label className="staff-field">ชื่อบทบาท<input autoFocus required maxLength={80} value={draft.name}
            onChange={event => setDraft({ ...draft, name: event.target.value })}/></label>
          <label className="staff-field">รหัสบทบาท<input required readOnly={draft.operation === 'RENAME'}
            pattern="[A-Z][A-Z0-9_]{1,39}" maxLength={40} value={draft.code}
            onChange={event => setDraft({ ...draft, code: event.target.value.toUpperCase() })}/></label>
          {save.error && <p role="alert" className="staff-role-error">{save.error.message}</p>}
          <footer><button type="button" disabled={save.isPending} onClick={() => setDraft(null)}>ยกเลิก</button>
            <button type="submit" className="staff-button" disabled={save.isPending}>บันทึก</button></footer>
        </form>
      </section>
    </div>}
  </StaffPage>
}
