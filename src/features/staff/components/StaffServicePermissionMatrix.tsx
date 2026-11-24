import { ROLE_LABELS } from '../../auth/auth.types'

import { serviceRoles, servicePermissionRows } from '../staff-service-permissions'

export function StaffServicePermissionMatrix({ roles, checked, guestEnabled, disabled, toggle, toggleGuest, reset }: {
  roles: ReadonlySet<string>; checked: (role: string, code: string) => boolean; guestEnabled: boolean; disabled: boolean
  toggle: (role: string, code: string, enabled: boolean) => void; toggleGuest: (enabled: boolean) => void; reset: () => void
}) {
  return <div className="staff-settings-matrix">
    <div className="staff-table-wrap"><table className="staff-table">
      <thead><tr><th scope="col">สิทธิ์การใช้งาน</th><th scope="col">ผู้เยี่ยมชม</th>
        {serviceRoles.map(role => <th scope="col" key={role}>{ROLE_LABELS[role]}</th>)}</tr></thead>
      <tbody>{servicePermissionRows.map(([code, label]) => <tr key={code}>
        <th scope="row">{label}</th>
        <td><input type="checkbox" className="staff-permission-choice" aria-label={`ผู้เยี่ยมชม · ${label}`}
          disabled={disabled || code !== 'KEY_REQUEST_GENERAL'} checked={code === 'KEY_REQUEST_GENERAL' && guestEnabled}
          onChange={event => toggleGuest(event.target.checked)} /></td>
        {serviceRoles.map(role => <td key={role}><input type="checkbox" className="staff-permission-choice" aria-label={`${ROLE_LABELS[role]} · ${label}`}
          disabled={disabled || role === 'ADMIN' || !roles.has(role)} checked={role === 'ADMIN' || checked(role, code)}
          onChange={event => toggle(role, code, event.target.checked)} /></td>)}
      </tr>)}</tbody>
    </table></div>
    <footer className="staff-permission-matrix-footer"><small>ผู้ดูแลระบบได้รับสิทธิ์ครบทุกข้อ</small>
      <button type="button" className="staff-button secondary" disabled={disabled} onClick={reset}>คืนค่าเริ่มต้น</button></footer>
  </div>
}
