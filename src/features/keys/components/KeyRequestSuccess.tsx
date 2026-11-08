import { Link } from 'react-router-dom'
import { formatThaiDate } from '../utils/format-thai-date'

interface KeyRequestSuccessProps {
  roomCode: string
  date: string
  startTime: string
  endTime: string
  purpose: string
}

export function KeyRequestSuccess({ roomCode, date, startTime, endTime, purpose }: KeyRequestSuccessProps) {
  return <section className="key-request-entry key-request-success">
    <div className="key-stepper key-success-stepper" aria-label="ขั้นตอนการเบิกกุญแจ"><b>1</b><i/><b>2</b><i/><b>3</b></div>
    <div className="key-success-card">
      <span className="key-success-check" aria-hidden="true">✓</span>
      <h1>ส่งคำขอเบิกกุญแจสำเร็จ</h1>
      <p>ระบบได้รับข้อมูลการเบิกกุญแจของคุณเรียบร้อยแล้ว</p>
      <h2>รายละเอียดการเบิกกุญแจ</h2>
      <dl>
        <div><dt>ห้องที่เบิก</dt><dd>{roomCode}</dd></div>
        <div><dt>วันที่เบิก</dt><dd>{formatThaiDate(date)}</dd></div>
        <div><dt>เวลาที่เบิกกุญแจ</dt><dd>{startTime} น.</dd></div>
        <div><dt>เวลาที่คืนกุญแจ</dt><dd>{endTime} น.</dd></div>
        <div><dt>วัตถุประสงค์</dt><dd>{purpose}</dd></div>
      </dl>
    </div>
    <div className="key-success-next"><b>ⓘ ขั้นตอนถัดไป</b><small>กรุณาติดต่อรับกุญแจจากเจ้าหน้าที่ ณ ห้องสำนักงานคณะเทคโนโลยีสารสนเทศ ชั้น 4 ตามวันและเวลาที่กำหนด และส่งคืนกุญแจภายในระยะเวลาที่กำหนด ระบบจะส่งรายละเอียดและสถานะไปยังอีเมลมหาวิทยาลัย</small></div>
    <Link className="primary-action" to="/keys">กลับสู่หน้าหลัก</Link>
  </section>
}
