import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'

export function KeyRequestRoomsPage() {
  const rooms = useQuery(publicRoomsQuery())
  const laboratories = (rooms.data ?? []).filter((room) => room.usageScope === 'LABORATORY')

  return <section className="key-request-entry">
    <header>
      <span className="key-request-kicker">ระบบเบิกกุญแจ</span>
      <h1>เบิกกุญแจห้องปฏิบัติการ</h1>
      <p>เลือกห้องที่ต้องการเบิกกุญแจ</p>
      <small>ทำรายการได้วันอาทิตย์–ศุกร์ เวลา 08:00–18:00 น. วันเสาร์ดูข้อมูลได้แต่ไม่สามารถทำรายการ</small>
    </header>
    {rooms.isPending ? <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" /> : rooms.error ? <div className="key-request-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลห้องได้</strong><button onClick={() => void rooms.refetch()}>ลองใหม่</button></div> : <div className="key-room-list">
      {laboratories.map((room) => <Link key={room.id} to={`/keys/rooms/${room.id}`} className="key-room-card">
        <div><strong>{room.code}</strong><span>{room.name}</span><small>{[room.building, room.floor].filter(Boolean).join(' · ')}</small></div>
        <div><span className={room.requiresSsoForKeyRequest ? 'key-room-badge special' : 'key-room-badge'}>{room.requiresSsoForKeyRequest ? 'ห้องพิเศษ · ต้องเข้าสู่ระบบ' : 'อนุมัติอัตโนมัติ'}</span><b aria-hidden="true">›</b></div>
      </Link>)}
      {laboratories.length === 0 && <p className="key-room-empty">ยังไม่มีห้องปฏิบัติการที่เปิดให้ใช้งาน</p>}
    </div>}
  </section>
}
