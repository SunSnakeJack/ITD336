import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { executeKeyRequestEmailAction, type KeyRequestEmailAction } from '../key-request-action.service'

const validActions:KeyRequestEmailAction[]=['CANCEL','RETURN']

export function KeyRequestActionPage(){
  const[params]=useSearchParams();const action=(params.get('action')??'').toUpperCase() as KeyRequestEmailAction;const token=params.get('token')??''
  const valid=validActions.includes(action)&&token.length>=32
  const mutation=useMutation({mutationFn:()=>executeKeyRequestEmailAction(action,token)})
  const started=useRef(false)
  useEffect(()=>{if(valid&&!started.current){started.current=true;mutation.mutate()}},[valid,mutation])
  if(!valid)return <section className="key-request-entry"><h1>ลิงก์ไม่ถูกต้อง</h1><p role="alert">กรุณาตรวจสอบลิงก์จากอีเมลอีกครั้ง</p><Link to="/keys">กลับหน้าหลัก</Link></section>
  if(mutation.data?.ok){const title=action==='CANCEL'?'ยกเลิกคำขอสำเร็จ':action==='RETURN'?'ยืนยันคืนกุญแจสำเร็จ':'รายละเอียดคำขอ';return <section className="key-request-entry"><h1>{title}</h1><p>คำขอ {mutation.data.requestCode} อยู่ในสถานะ {mutation.data.status}</p><Link className="primary-action" to="/keys">กลับหน้าหลัก</Link></section>}
  const failure=mutation.data&&!mutation.data.ok?mutation.data.message:mutation.error?.message
  return <section className="key-request-entry"><h1>{failure?'ดำเนินการไม่สำเร็จ':'กำลังดำเนินการ'}</h1>{failure?<p className="panel-error" role="alert">{failure}</p>:<p role="status">กรุณารอสักครู่ ระบบกำลังตรวจสอบลิงก์ที่ปลอดภัย</p>}</section>
}
