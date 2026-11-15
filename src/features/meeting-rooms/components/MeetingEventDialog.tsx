import { useEffect, useId, useRef } from 'react'
import { bangkokClock } from '../../keys/utils/key-catalog-time'
import { meetingEventCategories, type MeetingWeekEvent } from '../utils/meeting-week'

const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })

export function MeetingEventDialog({ event, roomName, onClose }: {
  event: MeetingWeekEvent; roomName: string; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  return <dialog className="meeting-event-dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose}
    onCancel={cancel => { cancel.preventDefault(); dialog.current?.close() }}
    onClick={click => { if (click.target === click.currentTarget) dialog.current?.close() }}>
    <div className="meeting-event-dialog-body">
      <h3 id={titleId}>{event.category === 'BLOCK' ? 'รายละเอียดช่วงปิดให้บริการ' : 'รายละเอียดการจอง'}</h3>
      <button type="button" className="meeting-event-close" aria-label="ปิดรายละเอียด"
        onClick={() => dialog.current?.close()}>×</button>
      <dl>
        <div><dt>ห้อง</dt><dd>{roomName}</dd></div>
        <div><dt>วันที่</dt><dd>{thaiDate.formatRange(new Date(event.starts_at), new Date(event.ends_at))}</dd></div>
        <div><dt>เวลา</dt><dd>{bangkokClock(event.starts_at)}–{bangkokClock(event.ends_at)} น.</dd></div>
        <div><dt>ประเภท</dt><dd>{meetingEventCategories[event.category]}</dd></div>
        {event.requester_name && <div><dt>ชื่อผู้จอง</dt><dd>{event.requester_name}</dd></div>}
        {event.purpose && <div><dt>เหตุผลการจอง</dt><dd>{event.purpose}</dd></div>}
      </dl>
    </div>
  </dialog>
}
