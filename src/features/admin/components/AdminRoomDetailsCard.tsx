import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { updateRoomDetails } from '../../schedules/schedule.service'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import { RoomDetailContent } from '../../rooms/components/RoomDetailContent'

export function AdminRoomDetailsCard({ room }: { room: ScheduleRoom }) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(room.name)
  const [capacity, setCapacity] = useState(String(room.capacity))
  const [active, setActive] = useState(room.active)
  const save = useMutation({ mutationFn: updateRoomDetails, onSuccess: async () => { await client.invalidateQueries({ queryKey: scheduleKeys.rooms() }); setEditing(false) } })
  const cancel = () => { setName(room.name); setCapacity(String(room.capacity)); setActive(room.active); setEditing(false); save.reset() }
  if (!editing) return <RoomDetailContent room={room} action={<button className="room-settings-action" aria-label="แก้ไขข้อมูลห้อง" onClick={() => setEditing(true)}>⚙</button>} />
  return <form className="room-detail-heading room-details-editor" aria-label="แก้ไขข้อมูลห้อง" onSubmit={(event) => { event.preventDefault(); save.mutate({ roomId: room.id, name, capacity: Number(capacity), active }) }}>
    <div><span>{room.roomTypeName}</span><h1>{room.code}</h1><label>ชื่อห้อง<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label></div>
    <div className="room-edit-fields"><label>ความจุ<input required min="1" max="1000" type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label><label className="room-active-field"><input checked={active} type="checkbox" onChange={(event) => setActive(event.target.checked)} /> เปิดใช้งานห้อง</label><div className="form-actions"><button type="button" onClick={cancel}>ยกเลิก</button><button className="primary-action" disabled={save.isPending}>{save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>{save.error && <p className="panel-error">{save.error.message}</p>}</div>
  </form>
}
