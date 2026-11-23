import defaultRoomImage from '../../../assets/default-room.jpg'
import type { AdminRoomDetail } from '../room.types'
import { roomFormatGroup, roomGroupLabels, thaiRoomType } from '../utils/room-type-label'
import './RoomEditorForm.css'

export function RoomReadOnlyDetails({ room }: { room: AdminRoomDetail }) {
  const group = roomFormatGroup(room.room_type_name)
  return <div className="room-editor-form room-read-only">
    <section className="room-editor-switches">
      <span>แสดงบนหน้าเว็บ: {room.visible_on_web === false ? 'ซ่อน' : 'แสดง'}</span>
      <span>สถานะห้อง: {room.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
    </section>
    <div className="room-editor-column">
      <section>
        <h3>ข้อมูลห้อง</h3>
        <dl className="room-editor-grid">
          <div><dt>รหัสห้อง</dt><dd>{room.code}</dd></div>
          <div><dt>ชื่อสำหรับหน้าจัดการ</dt><dd>{room.name}</dd></div>
          <div><dt>กลุ่มห้อง</dt><dd>{group ? roomGroupLabels[group] : '—'}</dd></div>
          <div><dt>รูปแบบห้อง</dt><dd>{thaiRoomType(room.room_type_name)}</dd></div>
          <div><dt>ความจุ</dt><dd>{room.capacity} คน</dd></div>
          <div className="wide"><dt>คำอธิบายใต้ชื่อห้อง</dt><dd>{room.description || '—'}</dd></div>
        </dl>
      </section>
    </div>
    <div className="room-editor-column">
      <section>
        <h3>อุปกรณ์เพิ่มเติม</h3>
        {room.equipment.length
          ? <ul className="room-editor-equipment">{room.equipment.map(item => <li key={item.equipmentId}>{item.name || 'ไม่ระบุชื่ออุปกรณ์'}</li>)}</ul>
          : <p className="room-editor-image">ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม</p>}
      </section>
      <section>
        <h3>รูปภาพห้อง</h3>
        <div className="room-editor-image"><img className="room-editor-preview" src={room.image_url || defaultRoomImage} alt={room.image_url ? `รูปภาพ ${room.name}` : 'รูปตัวอย่างห้อง'} /></div>
      </section>
    </div>
  </div>
}
