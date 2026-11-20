import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SelectField } from '../../../shared/components/SelectField'
import { auditActionLabel, auditActions, formatAuditTime, staffAuditQuery, type AuditActor } from '../audit/staff-audit'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import './StaffSystemPages.css'

const actorOptions = [{ value: 'ADMIN', label: 'แอดมิน' }, { value: 'USER', label: 'ผู้ใช้ปกติ' }] as const
const entityLabels: Record<string, string> = { key_request: 'คำขอเบิก', key_loan: 'รายการยืม', booking: 'การจอง', profile: 'ผู้ใช้', room: 'ห้อง', role: 'บทบาท' }

export function StaffAuditLogsPage() {
  const [actor, setActor] = useState<AuditActor | null>(null)
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const term = searchText.trim()
    if (term === search) return
    const timer = window.setTimeout(() => { setSearch(term); setPage(1) }, 250)
    return () => window.clearTimeout(timer)
  }, [searchText, search])
  const query = useQuery(staffAuditQuery(actor, action, page, search))
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 10))
  return <StaffPage eyebrow="Audit" title="Logs" description="" hideHeader>
    <div className="staff-audit-filters">
      <div className="staff-audit-chips" role="group" aria-label="ประเภทผู้ทำรายการ">
        {actorOptions.map(option => <button key={option.value} type="button" aria-pressed={actor === option.value}
          onClick={() => { setActor(actor === option.value ? null : option.value); setPage(1) }}>{option.label}</button>)}
      </div>
      <SelectField label="การทำงาน" value={action} placeholder="ทุกการทำรายการ"
        options={[{ value: '', label: 'ทุกการทำรายการ' }, ...auditActions.map(item => ({ value: item.label, label: item.label }))]}
        onChange={value => { setAction(value); setPage(1) }}/>
      <div className="staff-audit-search">
        <label htmlFor="staff-audit-search">ค้นหา Logs</label>
        <div>
          <input id="staff-audit-search" type="search" maxLength={120} value={searchText}
            placeholder="ค้นหาชื่อ รหัสห้อง หรือรายละเอียด"
            onChange={event => setSearchText(event.target.value)}/>
          {searchText && <button type="button" aria-label="ล้างคำค้น" onClick={() => {
            setSearchText(''); setSearch(''); setPage(1)
          }}>×</button>}
        </div>
      </div>
    </div>
    <StaffQueryState loading={query.isPending} error={query.error}>
      <div className="staff-table-wrap"><table className="staff-table staff-audit-table">
        <thead><tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>การทำงาน</th><th>รายการ</th><th>รายละเอียด</th><th>IP</th></tr></thead>
        <tbody>{query.data?.rows.length ? query.data.rows.map(row => <tr key={row.id}>
          <td><time dateTime={row.createdAt}>{formatAuditTime(row.createdAt)}</time></td>
          <td>{row.actorName ?? (row.actorKind === 'SYSTEM' ? 'ระบบ' : '—')}
            {actor && row.actorKindEstimated && <small>อิงบทบาทปัจจุบัน</small>}</td>
          <td>{auditActionLabel(row.action)}</td>
          <td>{row.reference ?? (row.entityId ? `${entityLabels[row.entityType] ?? row.entityType} · ${row.entityId.slice(0, 8)}` : entityLabels[row.entityType] ?? row.entityType)}</td>
          <td>{row.detail ?? '—'}</td><td>{row.ip ?? '—'}</td>
        </tr>) : <tr><td colSpan={6}>ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>}</tbody>
      </table></div>
      <nav className="staff-pagination" aria-label="หน้า Logs">
        <span>แสดง {query.data?.rows.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, total)} จาก {total} รายการ</span>
        <div><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <b>หน้า {page} / {pages}</b>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป</button></div>
      </nav>
    </StaffQueryState>
  </StaffPage>
}
