import type { StaffRoleOption } from '../types/staff-user.types'
import { staffRoleThaiLabel } from '../utils/staff-role-label'
import '../pages/StaffUserManagement.css'

const roleIcons: Record<string, string> = {
  ADMIN: 'M4 20v-2a5 5 0 0 1 10 0v2m2-6a4 4 0 0 1 4 4v2M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3-3a3 3 0 0 1 0 6',
  DEAN: 'M5 20v-2a7 7 0 0 1 14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  DEPARTMENT_HEAD: 'M3 8h18v12H3zM8 8V4h8v4M3 13h18m-11 0v2h4v-2',
  STAFF: 'M9 3h6l-1 4 3 12-5 3-5-3 3-12-1-4Zm1 4h4',
  STUDENT: 'm2 9 10-5 10 5-10 5L2 9Zm4 2v5c4 3 8 3 12 0v-5m4-2v7',
  TEACHER: 'M3 4h18v12H3zM12 16v5m-5 0 5-5 5 5',
}

export function StaffRoleChips({ roles, selected, disabled, onToggle }: {
  roles: StaffRoleOption[]
  selected: ReadonlySet<string>
  disabled: boolean
  onToggle: (code: string) => void
}) {
  return <div className="staff-role-choice-chips">
    {roles.map(role => (
      <label key={role.code} className="staff-role-choice-chip">
        <input type="checkbox" checked={selected.has(role.code)} disabled={disabled} onChange={() => onToggle(role.code)} />
        <span className="staff-role-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={roleIcons[role.code] ?? roleIcons.DEAN}/></svg></span>
        <span><strong>{role.name}</strong>{staffRoleThaiLabel(role.code) && <small>{staffRoleThaiLabel(role.code)}</small>}</span>
        <span className="staff-role-choice-check" aria-hidden="true">✓</span>
      </label>
    ))}
  </div>
}
