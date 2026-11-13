import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { cancelMyKeyRequest, returnMyKeyRequest } from '../key.service'
import { keyLoanKeys, myKeyRequestsQuery } from '../key.queries'
import type { MyKeyRequest } from '../key.types'
import { formatThaiDate } from '../utils/format-thai-date'
import { bangkokClock } from '../utils/key-catalog-time'

const labels: Record<string, string> = { PENDING_APPROVAL: 'รออนุมัติ', APPROVED: 'จองสำเร็จ', IN_USE: 'กำลังใช้งาน', RETURNED: 'คืนแล้ว', CANCELLED: 'ยกเลิกแล้ว', REJECTED: 'ไม่อนุมัติ' }
function displayStatus(item: MyKeyRequest) { if (item.status === 'APPROVED' && new Date(item.endsAt).getTime() <= Date.now()) return { label: 'สิ้นสุดแล้ว', className: 'muted' }; return { label: labels[item.status] ?? item.status, className: item.status === 'CANCELLED' ? 'cancelled muted' : item.status.toLowerCase() } }
function durationLabel(startsAt: string, endsAt: string) { const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000)); const hours = Math.floor(minutes / 60); const rest = minutes % 60; return `ระยะเวลา ${hours ? `${hours} ชั่วโมง${rest ? ' ' : ''}` : ''}${rest ? `${rest} นาที` : ''}` }

export function AccountKeyRequestHistoryPage() {
  const query = useQuery(myKeyRequestsQuery())
  const client = useQueryClient()
  const [action, setAction] = useState<{ type: 'return' | 'cancel'; id: string } | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: keyLoanKeys.mine })
  const close = () => setAction(null)
  const cancel = useMutation({ mutationFn: cancelMyKeyRequest, onSuccess: () => { refresh(); close() } })
  const returnRequest = useMutation({ mutationFn: returnMyKeyRequest, onSuccess: () => { refresh(); close() } })
  if (query.isPending) return <LoadingSpinner label="กำลังโหลดประวัติ…"/>
  return <section className="key-account-page key-history-page">
    <h1>ประวัติการทำรายการ</h1><p>ตรวจสอบรายละเอียดและจัดการรายการของคุณ</p><header><h2>รายการล่าสุด</h2><span>{query.data?.length ?? 0} รายการ</span></header>
    <div className="key-history-cards">{query.data?.map(item => {
      const status = displayStatus(item)
      const canCancel = Boolean(item.canCancel) && ['PENDING_APPROVAL', 'APPROVED'].includes(item.status)
      const canReturn = Boolean(item.canReturn) && ['APPROVED', 'IN_USE'].includes(item.status)
      const actionCount = Number(canCancel) + Number(canReturn)
      return <article key={item.id}><header><div><strong>{item.roomTypeName || item.roomName}</strong><small>{item.roomCode}{item.floor ? ` • ชั้น ${item.floor}` : ''}</small></div><i className={status.className}>{status.label}</i></header><div className="key-history-time"><b>{formatThaiDate(item.startsAt.slice(0, 10))}</b><strong>{bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</strong><small>{durationLabel(item.startsAt, item.endsAt)}</small></div><p className="key-history-purpose">{item.status === 'REJECTED' ? 'เหตุผลที่ไม่อนุมัติ' : 'วัตถุประสงค์'} <span>{item.status === 'REJECTED' ? (item.decisionReason || 'ไม่ระบุเหตุผล') : item.purpose}</span></p>{actionCount > 0 && <footer className={actionCount === 1 ? 'single-action' : 'equal-actions'}>{canReturn && <button className="return-action" disabled={returnRequest.isPending} onClick={() => setAction({ type: 'return', id: item.id })}>ยืนยันการคืนกุญแจ</button>}{canCancel && <button className="danger-action" disabled={cancel.isPending} onClick={() => setAction({ type: 'cancel', id: item.id })}>ยกเลิกรายการ</button>}</footer>}</article>
    })}</div>
    {query.error && <p className="panel-error">{query.error.message}</p>}{cancel.error && <p className="panel-error">{cancel.error.message}</p>}{returnRequest.error && <p className="panel-error">{returnRequest.error.message}</p>}
    {action && <ConfirmDialog title={action.type === 'return' ? 'ยืนยันการคืนกุญแจ' : 'ยืนยันการยกเลิกรายการ'} message={action.type === 'return' ? 'กรุณายืนยันว่าคุณได้คืนกุญแจให้เจ้าหน้าที่เรียบร้อยแล้ว' : 'รายการที่ยกเลิกแล้วไม่สามารถนำกลับมาใช้งานได้'} confirmLabel={action.type === 'return' ? 'ยืนยันการคืนกุญแจ' : 'ยกเลิกรายการ'} danger={action.type === 'cancel'} pending={cancel.isPending || returnRequest.isPending} onClose={close} onConfirm={() => action.type === 'return' ? returnRequest.mutate(action.id) : cancel.mutate(action.id)}/>}
  </section>
}
