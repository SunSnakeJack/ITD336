import { useQuery } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'
import { hasPriorityRole, type AuthIdentity } from '../../auth/auth.types'
import type { PublicLayoutContext } from '../../public/components/PublicLayout'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import './MeetingRoomEntryPage.css'

export function MeetingRoomEntryPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const { openSignIn } = useOutletContext<PublicLayoutContext>()
  const rooms = useQuery(publicRoomsQuery())
  const meetingRooms = (rooms.data ?? []).filter(room => room.usageScope === 'MEETING')
  const roles = identity?.roles ?? (identity?.role ? [identity.role] : [])
  const canBook = roles.some(role => role === 'TEACHER' || role === 'ADMIN') || hasPriorityRole(identity)

  return <section className="key-account-page meeting-room-entry">
    <PublicPageHeading title="เลือกห้องที่ต้องการจอง" description="เลือกห้องเพื่อดูรายละเอียดและเลือกเวลาจอง" />
    {authLoading || rooms.isPending ? <LoadingSpinner label="กำลังโหลดข้อมูลห้องประชุม…" />
      : rooms.isError ? <p role="alert">ไม่สามารถโหลดข้อมูลห้องประชุมได้</p>
      : meetingRooms.length === 0 ? <p>ยังไม่มีห้องประชุมให้เลือก</p>
      : <ul className="meeting-room-picker">
        {meetingRooms.map(room => {
          const content = <>
            <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4m-4 0h8" /></svg>
            <strong>{room.code}</strong>
            <span>{!room.active ? 'ปิดให้บริการ' : !identity ? 'เข้าสู่ระบบ'
              : canBook ? 'ดูรายละเอียด' : 'เฉพาะอาจารย์เท่านั้น'}</span>
          </>
          return <li key={room.id}>
            {!room.active || (identity && !canBook) ? <div className="meeting-room-tile is-unavailable">{content}</div>
              : !identity ? <button type="button" className="meeting-room-tile is-unavailable" onClick={openSignIn}>{content}</button>
              : <Link className="meeting-room-tile" to={`/meeting-room/${room.id}`}>{content}</Link>}
          </li>
        })}
      </ul>}
  </section>
}
