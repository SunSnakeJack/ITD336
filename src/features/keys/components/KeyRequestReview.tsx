interface KeyRequestReviewProps {
  roomCode: string
  requesterIdentifier: string
  requesterName: string
  requesterEmail: string
  date: string
  startTime: string
  endTime: string
  purpose: string
  courseCode?: string
  lecturerName?: string
  submitting: boolean
  error?: string
  onBack: () => void
  onConfirm: () => void
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

export function KeyRequestReview({
  roomCode,
  requesterIdentifier,
  requesterName,
  requesterEmail,
  date,
  startTime,
  endTime,
  purpose,
  courseCode,
  lecturerName,
  submitting,
  error,
  onBack,
  onConfirm,
}: KeyRequestReviewProps) {
  return (
    <section className="key-request-entry key-request-review">
      <header>
        <h1>ตรวจสอบข้อมูล</h1>
        <p>กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนกดยืนยัน</p>
      </header>
      <div className="key-stepper key-review-stepper" aria-label="ขั้นตอนการเบิกกุญแจ"><b>1</b><i /><b>2</b><i /><b>3</b></div>
      <section className="key-review-card">
        <h2><svg className="key-review-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7"/></svg>ข้อมูลผู้เบิกกุญแจ</h2>
        <dl>
          <ReviewRow label="รหัสนักศึกษา / บุคลากร" value={requesterIdentifier} />
          <ReviewRow label="ชื่อ – นามสกุล" value={requesterName} />
          <ReviewRow label="อีเมล" value={requesterEmail} />
        </dl>
      </section>
      <section className="key-review-card">
        <h2><svg className="key-review-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7V5h7l2 2"/></svg>ข้อมูลการเบิก</h2>
        <dl>
          <ReviewRow label="ห้องที่เบิก" value={roomCode} />
          <ReviewRow label="วันที่เบิก" value={formatThaiDate(date)} />
          <ReviewRow label="เวลาที่เบิกกุญแจ" value={startTime} />
          <ReviewRow label="เวลาที่คืนกุญแจ" value={endTime} />
          <ReviewRow label="วัตถุประสงค์" value={purpose} />
          {courseCode && <ReviewRow label="รหัสวิชา" value={courseCode} />}
          {lecturerName && <ReviewRow label="อาจารย์ผู้สอน" value={lecturerName} />}
        </dl>
      </section>
      <div className="key-review-actions">
        <button type="button" onClick={onBack}>ย้อนกลับ</button>
        <button className="primary-action" type="button" disabled={submitting} onClick={onConfirm}>
          {submitting ? 'กำลังส่งคำขอ…' : 'ยืนยันการเบิก'}
        </button>
      </div>
      {error && <p className="panel-error" role="alert">{error}</p>}
    </section>
  )
}
import { formatThaiDate } from '../utils/format-thai-date'

