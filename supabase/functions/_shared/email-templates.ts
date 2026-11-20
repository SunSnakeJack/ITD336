export interface KeyRequestEmailData{requestCode:string;roomName:string;startsAt:string;endsAt:string;purpose:string;status:string;reason?:string|null;links:{track:string;cancel:string;returnKey:string;edit?:string};showWebActions?:boolean;logoUrl?:string;gmailAction?:{name:string;url:string}|null}
export interface RenderedEmail{subject:string;html:string}
const escapeHtml=(value:string)=>value.replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]??char))
const bangkokDate = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' })
const bangkokTime = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', timeStyle: 'short', hourCycle: 'h23' })

function formatBangkokRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const firstDay = bangkokDate.format(start)
  const lastDay = bangkokDate.format(end)
  const startLabel = `${firstDay} เวลา ${bangkokTime.format(start)}`
  const endLabel = bangkokTime.format(end)
  const range = firstDay === lastDay ? `${startLabel}–${endLabel}` : `${startLabel} – ${lastDay} เวลา ${endLabel}`
  return `${range} น. (เวลาประเทศไทย)`
}
export function renderKeyRequestEmail(templateKey:string,data:KeyRequestEmailData):RenderedEmail{
 const pending=data.status==='PENDING_APPROVAL';const subjects:Record<string,string>={'key-request-submitted':pending?'รับคำขอเบิกกุญแจแล้ว — รออนุมัติ':'ยืนยันคำขอเบิกกุญแจสำเร็จ','key-request-approved':'คำขอเบิกกุญแจได้รับการอนุมัติ','key-request-rejected':'คำขอเบิกกุญแจไม่อนุมัติ','key-request-cancelled':'คำขอเบิกกุญแจถูกยกเลิกแล้ว','key-request-returned':'ยืนยันการคืนกุญแจเรียบร้อยแล้ว','key-request-ending-soon':'เหลือเวลาใช้งานกุญแจ 30 นาที','key-request-ended':'ระยะเวลาการใช้กุญแจสิ้นสุดแล้ว','key-request-lecturer-notice':'มีคำขอเปิดห้องสำหรับรายวิชาของคุณ'};Object.assign(subjects,{'key-request-starting-soon':'อีก 30 นาทีถึงเวลาเริ่มใช้ห้อง','key-request-admin-notice':'มีคำขอใช้ห้องรออนุมัติ','key-request-overdue':'เกินกำหนดคืนกุญแจแล้ว','booking-submitted':data.status==='APPROVED'?'ยืนยันการจองห้องสำเร็จ':'รับคำขอจองห้องแล้ว','booking-approved':'การจองห้องได้รับอนุมัติ','booking-rejected':'การจองห้องไม่อนุมัติ','booking-cancelled':'การจองห้องถูกยกเลิก','booking-starting-soon':'อีก 30 นาทีถึงเวลาเริ่มใช้ห้อง'});const subject=subjects[templateKey]??'แจ้งเตือนคำขอเบิกกุญแจ ITD336'
 const detail=`<p><b>รหัสคำขอ:</b> ${escapeHtml(data.requestCode)}</p><p><b>ห้อง:</b> ${escapeHtml(data.roomName)}</p><p><b>วันและเวลา:</b> ${escapeHtml(formatBangkokRange(data.startsAt, data.endsAt))}</p><p><b>วัตถุประสงค์:</b> ${escapeHtml(data.purpose)}</p>`;const reason=data.reason?`<p><b>เหตุผล:</b> ${escapeHtml(data.reason)}</p>`:''
 const changeSubjects: Record<string, string> = {
   'booking-updated': 'แก้ไขรายการจองห้องแล้ว',
   'booking-superseded': 'การจองห้องถูกแทนที่ด้วยรายการสิทธิ์พิเศษ',
   'key-request-updated': 'แก้ไขคำขอเบิกกุญแจแล้ว',
   'key-request-expired': 'คำขอเบิกกุญแจห้องพิเศษหมดอายุ',
 }
 const heading = changeSubjects[templateKey] ?? subject
 const actions = data.showWebActions ? [
   [data.links.track, 'ดูรายการ'],
   [data.links.edit, 'แก้ไขรายการ'],
   [data.links.cancel, 'ไปยืนยันการยกเลิกคำขอ'],
   [data.links.returnKey, 'ไปยืนยันคืนกุญแจ'],
 ].filter(([url]) => url?.startsWith('https://')).map(([url, label]) =>
   `<p><a href="${escapeHtml(url!)}">${label}</a></p>`).join('') : ''
 const logo = data.logoUrl?.startsWith('https://')
   ? `<img src="${escapeHtml(data.logoUrl)}" width="72" alt="IT KeySpace" style="display:block;height:auto;border:0">`
   : ''
 const brand = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#fff3bd" style="padding:4px 8px;border-radius:8px">${logo}</td><td style="padding-left:10px;font-weight:bold">IT KeySpace</td></tr></table>`
 return{subject:heading,html:`<!doctype html><html lang="th"><head></head><body style="font-family:Arial,sans-serif;color:#111">${brand}<h2>${escapeHtml(heading)}</h2>${detail}${reason}${actions}<p style="color:#64748b;font-size:12px">อีเมลอัตโนมัติจาก IT KeySpace</p></body></html>`}
}
