import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { KeyRoomCatalogCard } from '../components/KeyRoomCatalogCard'
import { keyCatalogDisplayQuery } from '../key-catalog-display.queries'
import type { AuthIdentity } from '../../auth/auth.types'
import '../components/KeyRoomCatalog.css'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'
import { keyServiceDaysQuery } from '../key-service-days.queries'
import { MeetingRoomPicker } from '../../meeting-rooms/pages/MeetingRoomEntryPage'
import { useMergedRoomCatalog } from '../../public/useMergedRoomCatalog'

export function KeyRequestRoomsPage({ identity, authLoading = false }: { identity: AuthIdentity | null; authLoading?: boolean }) {
  const rooms = useQuery(publicRoomsQuery())
  const display = useQuery(keyCatalogDisplayQuery())
  const serviceDays = useQuery(keyServiceDaysQuery())
  const service = serviceDays.isPending ? 'loading' : serviceDays.isError ? 'error' : 'open'
  const keyTag = display.data === 'key-tags'
  const showHistory = display.data !== 'current-no-history'
  const laboratories = (rooms.data ?? []).filter((room) => room.usageScope === 'LABORATORY')
  const [params, setParams] = useSearchParams()
  const specialSection = useRef<HTMLElement>(null)
  const meetingSection = useRef<HTMLElement>(null)
  const mergedCatalog = useMergedRoomCatalog()
  const loading = rooms.isPending || display.isPending
  const returnToSpecial = params.get('tab') === 'special'
  const returnToMeeting = params.get('section') === 'meeting'

  useEffect(() => {
    if (returnToSpecial && !loading && window.matchMedia?.('(min-width: 720px)').matches) {
      specialSection.current?.scrollIntoView?.()
    }
  }, [returnToSpecial, loading])

  useEffect(() => {
    if (returnToMeeting && mergedCatalog && !loading) meetingSection.current?.scrollIntoView?.()
  }, [returnToMeeting, mergedCatalog, loading])

  const sections = [
    { id: 'laboratory-rooms', title: 'ห้องปฏิบัติการ', rooms: laboratories.filter((room) => !room.requiresSsoForKeyRequest) },
    { id: 'special-rooms', title: 'ห้องปฏิบัติการพิเศษ', rooms: laboratories.filter((room) => room.requiresSsoForKeyRequest) },
  ]
  const activeSection = returnToSpecial ? 'special-rooms' : 'laboratory-rooms'

  const selectSection = (id: string) => {
    const updated = new URLSearchParams(params)
    if (id === 'special-rooms') updated.set('tab', 'special')
    else updated.delete('tab')
    setParams(updated, { replace: true })
  }

  return <section className="key-request-entry key-room-catalog-page">
    <PublicPageHeading title="เลือกกุญแจที่ต้องการเบิก"
      description={keyTag ? 'แตะป้ายกุญแจเพื่อดูห้องและเลือกเวลาเบิก' : 'เลือกห้องที่ต้องการเบิกกุญแจ'} />
    <div className="key-room-tabs" role="tablist" aria-label="ประเภทห้อง" onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? sections[0] : event.key === 'End' ? sections[1]
        : sections.find((section) => section.id !== activeSection)
      if (!next) return
      selectSection(next.id)
      document.getElementById(`${next.id}-tab`)?.focus()
    }}>
      {sections.map(({ id, title }) => (
        <button key={id} id={`${id}-tab`} type="button" role="tab" aria-controls={`${id}-panel`}
          aria-selected={activeSection === id} tabIndex={activeSection === id ? 0 : -1}
          onClick={() => selectSection(id)}>{title}</button>
      ))}
    </div>
    {loading ? <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" /> : rooms.error ? <div className="key-request-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลห้องได้</strong><button onClick={() => void rooms.refetch()}>ลองใหม่</button></div> : sections.map((section) => (
      <section className="key-room-group" key={section.id} id={`${section.id}-panel`} aria-labelledby={section.id}
        data-active={activeSection === section.id}
        ref={section.id === 'special-rooms' ? specialSection : undefined}>
        <h2 id={section.id}>{section.title}</h2>
        <div className={keyTag ? 'key-tag-grid' : 'key-room-list'}>
          {section.rooms.map((room) => <KeyRoomCatalogCard key={room.id} room={room} identity={identity} keyTag={keyTag}
            showHistory={showHistory} service={serviceDays.data?.has(room.id) ? 'closed' : service} />)}
          {section.rooms.length === 0 && <p className="key-room-empty">ไม่พบห้องในหมวดนี้</p>}
        </div>
      </section>
    ))}
    {mergedCatalog && !loading && !rooms.error && (
      <section className="key-room-group key-room-meeting-group" aria-labelledby="meeting-rooms" ref={meetingSection}>
        <h2 id="meeting-rooms">การจองห้องประชุม</h2>
        <MeetingRoomPicker identity={identity} authLoading={authLoading} fromCatalog />
      </section>
    )}
  </section>
}
