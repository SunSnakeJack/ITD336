import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { KeyRoomCatalogCard } from '../components/KeyRoomCatalogCard'
import type { AuthIdentity } from '../../auth/auth.types'

export function KeyRequestRoomsPage({identity}:{identity:AuthIdentity|null}) {
  const rooms = useQuery(publicRoomsQuery())
  const laboratories = (rooms.data ?? []).filter((room) => room.usageScope === 'LABORATORY')
  const [special, setSpecial] = useState(false)
  const visibleRooms = laboratories.filter((room) => Boolean(room.requiresSsoForKeyRequest) === special)

  return <section className="key-request-entry">
    <header>
      <h1>เลือกกุญแจที่ต้องการเบิก</h1>
      <p>แตะห้องเพื่อดูรายละเอียดและเลือกช่วงเวลา</p>
    </header>
    <div className="key-room-tabs" role="tablist"><button role="tab" aria-selected={!special} onClick={() => setSpecial(false)}>ห้องปฏิบัติการ</button><button role="tab" aria-selected={special} onClick={() => setSpecial(true)}>ห้องปฏิบัติการพิเศษ</button></div>
    {rooms.isPending ? <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" /> : rooms.error ? <div className="key-request-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลห้องได้</strong><button onClick={() => void rooms.refetch()}>ลองใหม่</button></div> : <div className="key-room-list">
      {visibleRooms.map((room) => <KeyRoomCatalogCard key={room.id} room={room} identity={identity}/>)}
      {visibleRooms.length === 0 && <p className="key-room-empty">ไม่พบห้องในหมวดนี้</p>}
    </div>}
  </section>
}
