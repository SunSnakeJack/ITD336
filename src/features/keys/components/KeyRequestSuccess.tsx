import { RequestStepper } from '../../../shared/components/RequestStepper'
import { RequestResultIcon } from '../../../shared/components/RequestResultIcon'
import { Link } from 'react-router-dom'
import { formatThaiDate } from '../utils/format-thai-date'

interface KeyRequestSuccessProps {
  catalogPath: string
  status: 'APPROVED' | 'PENDING_APPROVAL'
  roomCode: string
  date: string
  startTime: string
  endTime: string
  purpose: string
}

export function KeyRequestSuccess({ catalogPath, status, roomCode, date, startTime, endTime, purpose }: KeyRequestSuccessProps) {
  const pending = status === 'PENDING_APPROVAL'

  return <section className={`key-request-entry key-request-success ${pending ? 'pending' : 'approved'}`}>
    <RequestStepper step={3} label="ขั้นตอนการเบิกกุญแจ" />
    <div className="key-success-card">
      <RequestResultIcon pending={pending} />
      <h1>{pending ? 'ส่งคำขอเบิกกุญแจเรียบร้อยแล้ว' : 'ส่งคำขอเบิกกุญแจสำเร็จ'}</h1>
      <p>{pending ? <>ระบบได้รับคำขอของคุณแล้ว<br />กรุณารอเจ้าหน้าที่ตรวจสอบและอนุมัติคำขอ</> : 'ระบบได้รับข้อมูลการเบิกกุญแจของคุณเรียบร้อยแล้ว'}</p>
      <h2>รายละเอียดการเบิกกุญแจ</h2>
      <dl>
        <div><dt>ห้องที่เบิก</dt><dd>{roomCode}</dd></div>
        <div><dt>วันที่เบิก</dt><dd>{formatThaiDate(date)}</dd></div>
        <div><dt>เวลาที่เบิกกุญแจ</dt><dd>{startTime} น.</dd></div>
        <div><dt>เวลาที่คืนกุญแจ</dt><dd>{endTime} น.</dd></div>
        <div><dt>วัตถุประสงค์</dt><dd>{purpose}</dd></div>
      </dl>
    </div>
    <div className="key-success-next"><b>ⓘ ขั้นตอนถัดไป</b><small>{pending ? 'กรุณารอผลการอนุมัติจากเจ้าหน้าที่ ระบบจะแจ้งสถานะคำขอผ่านอีเมลมหาวิทยาลัย เมื่อได้รับอนุมัติแล้วจึงติดต่อรับกุญแจตามวันและเวลาที่กำหนด' : 'กรุณาติดต่อรับกุญแจจากเจ้าหน้าที่ ณ ห้องสำนักงานคณะเทคโนโลยีสารสนเทศ ชั้น 4 ตามวันและเวลาที่กำหนด และส่งคืนกุญแจภายในระยะเวลาที่กำหนด ระบบจะส่งรายละเอียดและสถานะไปยังอีเมลมหาวิทยาลัย'}</small></div>
    <Link className="primary-action" to={catalogPath}>กลับสู่หน้าหลัก</Link>
  </section>
}
