import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StaffKeyRequestDecisionDialog } from '../components/StaffKeyRequestDecisionDialog'
import { StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { decideStaffKeyRequest, getStaffKeyRequests, staffKeyRequestQueryKey, type StaffKeyRequest } from '../staff-key-request.service'

const clock = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })

export function StaffKeyRequestsPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: staffKeyRequestQueryKey, queryFn: getStaffKeyRequests })
  const [action, setAction] = useState<{ item: StaffKeyRequest; decision: 'APPROVED' | 'REJECTED' } | null>(null)
  const [notice, setNotice] = useState('')
  const decide = useMutation({ mutationFn: decideStaffKeyRequest, onSuccess: async (_, input) => {
    await client.invalidateQueries({ queryKey: staffKeyRequestQueryKey })
    setNotice(input.decision === 'APPROVED' ? 'อนุมัติคำขอเรียบร้อยแล้ว' : 'ไม่อนุมัติคำขอเรียบร้อยแล้ว')
    setAction(null)
  } })
  return <StaffPage eyebrow="คำขอเบิกกุญแจ" title="อนุมัติการเบิกกุญแจ" description="รองรับห้องทั่วไป ห้องอีเลิร์นนิง ห้องอีสปอร์ต และสตูดิโอ">
    {notice && <p className="staff-success-notice" role="status">{notice}</p>}
    <StaffQueryState loading={query.isPending} error={query.error} empty={!query.data?.length} emptyText="ยังไม่มีคำขอในระบบ">
      <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>คำขอ</th><th>ห้อง</th><th>ผู้ขอ</th><th>ช่วงเวลา</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody>{query.data?.map(item => <tr key={item.id}><td><strong>{item.requestCode}</strong><small>{item.status === 'REJECTED' ? item.decisionReason : item.purpose}</small></td><td><strong>{item.roomCode}</strong><small>{item.roomName}</small></td><td>{item.requesterName}<small>{item.requesterEmail}</small></td><td>{clock.format(new Date(item.startsAt))}<small>ถึง {clock.format(new Date(item.endsAt))}</small></td><td><StatusBadge status={item.status}/></td><td>{item.status === 'PENDING_APPROVAL' ? <DecisionButtons item={item} onSelect={decision => setAction({ item, decision })}/> : '—'}</td></tr>)}</tbody></table></div>
    </StaffQueryState>
    {action && <StaffKeyRequestDecisionDialog requestCode={action.item.requestCode} roomCode={action.item.roomCode} decision={action.decision} pending={decide.isPending} error={decide.error?.message} onClose={() => setAction(null)} onConfirm={reason => decide.mutate({ id: action.item.id, decision: action.decision, reason })}/>} 
  </StaffPage>
}

export function DecisionButtons({ item, onSelect }: { item: StaffKeyRequest; onSelect: (decision: 'APPROVED' | 'REJECTED') => void }) {
  return <div className="staff-decision-actions"><button type="button" aria-label={`อนุมัติ ${item.requestCode}`} onClick={() => onSelect('APPROVED')}>อนุมัติ</button><button type="button" className="danger" aria-label={`ไม่อนุมัติ ${item.requestCode}`} onClick={() => onSelect('REJECTED')}>ไม่อนุมัติ</button></div>
}
