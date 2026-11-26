import { Link } from 'react-router-dom'

export function KeyRoomNotFound() {
  return (
    <section className="key-request-entry key-auth-required">
      <h1>ไม่พบห้องนี้</h1>
      <p>ห้องนี้อาจไม่พร้อมให้เบิกกุญแจ หรือคุณอาจเปิดจากลิงก์เก่า</p>
      <Link className="primary-action" to="/keys">กลับไปเลือกห้อง</Link>
    </section>
  )
}
