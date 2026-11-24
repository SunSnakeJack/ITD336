import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { KeyRoomCatalogCard } from '../components/KeyRoomCatalogCard'
import { keyCatalogDisplayQuery } from '../key-catalog-display.queries'
import type { AuthIdentity } from '../../auth/auth.types'
import '../components/KeyRoomCatalog.css'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'
import { keyServiceDaysQuery } from '../key-service-days.queries'

export function KeyRequestRoomsPage({identity}:{identity:AuthIdentity|null}) {
  const rooms = useQuery(publicRoomsQuery())
  const display = useQuery(keyCatalogDisplayQuery())
  const serviceDays = useQuery(keyServiceDaysQuery())
  const service = serviceDays.isPending ? 'loading' : serviceDays.isError ? 'error' : 'open'
  const keyTag = display.data === 'key-tags'
  const showHistory = display.data !== 'current-no-history'
  const laboratories = (rooms.data ?? []).filter((room) => room.usageScope === 'LABORATORY')
  const [params, setParams] = useSearchParams()
  const special = params.get('tab') === 'special'
  const setSpecial = (next: boolean) => {
    const updated = new URLSearchParams(params)
    if (next) updated.set('tab', 'special')
    else updated.delete('tab')
    setParams(updated, { replace: true })
  }
  const visibleRooms = laboratories.filter((room) => Boolean(room.requiresSsoForKeyRequest) === special)

  return <section className="key-request-entry key-room-catalog-page">
    <PublicPageHeading title="เลือกกุญแจที่ต้องการเบิก"
      description={keyTag ? 'แตะป้ายกุญแจเพื่อดูห้องและเลือกเวลาเบิก' : 'เลือกห้องที่ต้องการเบิกกุญแจ'} />
    <div className="key-room-tabs" role="tablist"><button role="tab" aria-selected={!special} onClick={() => setSpecial(false)}>ห้องปฏิบัติการ</button><button role="tab" aria-selected={special} onClick={() => setSpecial(true)}>ห้องปฏิบัติการพิเศษ</button></div>
    {rooms.isPending || display.isPending ? <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" /> : rooms.error ? <div className="key-request-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลห้องได้</strong><button onClick={() => void rooms.refetch()}>ลองใหม่</button></div> : <div className={keyTag ? 'key-tag-grid' : 'key-room-list'}>
      {visibleRooms.map((room) => <KeyRoomCatalogCard key={room.id} room={room} identity={identity} keyTag={keyTag}
        showHistory={showHistory} service={serviceDays.data?.has(room.id) ? 'closed' : service}/>)}
      {visibleRooms.length === 0 && <p className="key-room-empty">ไม่พบห้องในหมวดนี้</p>}
    </div>}
  </section>
}
