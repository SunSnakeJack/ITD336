import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { executeKeyRequestEmailAction, type KeyRequestEmailAction } from '../key-request-action.service'

const validActions:KeyRequestEmailAction[]=['TRACK','CANCEL','RETURN']

export function KeyRequestActionPage(){
  const[params]=useSearchParams();const action=(params.get('action')??'').toUpperCase() as KeyRequestEmailAction;const token=params.get('token')??''
  const valid=validActions.includes(action)&&token.length>=32
  const mutation=useMutation({mutationFn:()=>executeKeyRequestEmailAction(action,token)})
  useEffect(()=>{if(valid&&action==='TRACK'&&!mutation.isPending&&!mutation.data&&!mutation.error)mutation.mutate()},[action,valid,mutation])
  if(!valid)return <section className="key-request-entry"><h1>ลิงก์ไม่ถูกต้อง</h1><p role="alert">กรุณาตรวจสอบลิงก์จากอีเมลอีกครั้ง</p><Link to="/keys">กลับหน้าหลัก</Link></section>
  if(mutation.data?.ok){const title=action==='CANCEL'?'ยกเลิกคำขอสำเร็จ':action==='RETURN'?'ยืนยันคืนกุญแจสำเร็จ':'รายละเอียดคำขอ';return <section className="key-request-entry"><h1>{title}</h1><p>คำขอ {mutation.data.requestCode} อยู่ในสถานะ {mutation.data.status}</p><Link className="primary-action" to="/keys">กลับหน้าหลัก</Link></section>}
  const title=action==='CANCEL'?'ยืนยันการยกเลิกคำขอ':action==='RETURN'?'ยืนยันการคืนกุญแจ':'กำลังตรวจสอบคำขอ'
  return <section className="key-request-entry"><h1>{title}</h1>{mutation.data&&!mutation.data.ok&&<p className="panel-error" role="alert">{mutation.data.message}</p>}{mutation.error&&<p className="panel-error" role="alert">{mutation.error.message}</p>}{action!=='TRACK'&&<><p>การดำเนินการนี้ใช้ Secure Link และทำได้เพียงครั้งเดียว</p><button className="primary-action" disabled={mutation.isPending} onClick={()=>mutation.mutate()}>{action==='CANCEL'?'ยืนยันการยกเลิก':'ยืนยันการคืนกุญแจ'}</button></>}</section>
}
