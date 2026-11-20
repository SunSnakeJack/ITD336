import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { executeKeyRequestEmailAction } from '../key-request-action.service'

const time = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })

export function KeyRequestActionPage() {
  const [params] = useSearchParams()
  const fragment = new URLSearchParams(useLocation().hash.slice(1))
  const action = (fragment.get('action') ?? params.get('action'))?.toUpperCase()
  const token = fragment.get('token') ?? params.get('token') ?? ''
  if ((action !== 'CANCEL' && action !== 'RETURN') || !/^[a-f0-9]{64}$/.test(token)) {
    return <section className="key-request-entry"><h1>ลิงก์ไม่ถูกต้อง</h1><Link to="/keys">กลับหน้าหลัก</Link></section>
  }
  return <ConfirmAction key={action + token} action={action} token={token} />
}

function ConfirmAction({ action, token }: { action: 'CANCEL' | 'RETURN'; token: string }) {
  const cancel = action === 'CANCEL'
  const preview = useQuery({
    queryKey: ['key-email-action-preview', action, token],
    queryFn: () => executeKeyRequestEmailAction(action, token, true),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const mutation = useMutation({ mutationFn: () => executeKeyRequestEmailAction(action, token) })
  if (mutation.data?.ok) {
    return <section className="key-request-entry"><h1>{cancel ? 'ยกเลิกคำขอสำเร็จ' : 'ยืนยันคืนกุญแจสำเร็จ'}</h1>
      <p>คำขอ {mutation.data.requestCode}</p><Link to="/keys">กลับหน้าหลัก</Link></section>
  }
  const error = mutation.error?.message || mutation.data?.message || preview.error?.message || preview.data?.message
  const item = preview.data
  return <section className="key-request-entry">
    <h1>{error ? 'ดำเนินการไม่สำเร็จ' : cancel ? 'ยืนยันการยกเลิกคำขอ' : 'ยืนยันการคืนกุญแจ'}</h1>
    {preview.isPending && <p role="status">กำลังตรวจสอบลิงก์</p>}
    {error && <p role="alert">{error}</p>}
    {item?.ok && <>
      <p>{item.room} · {item.requestCode}</p>
      {item.startsAt && item.endsAt && <p>{time.formatRange(new Date(item.startsAt), new Date(item.endsAt))} น.</p>}
      <button className="primary-action" type="button" disabled={mutation.isPending}
        onClick={() => mutation.mutate()}>{cancel ? 'ยืนยันการยกเลิก' : 'ยืนยันคืนกุญแจ'}</button>
    </>}
    <Link to="/keys">กลับหน้าหลัก</Link>
  </section>
}
