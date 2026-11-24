import { AccountRequestAction, AccountRequestTime } from '../../bookings/components/AccountRequestCard'
import { EditableRequestCard } from '../../bookings/components/EditableRequestCard'
import { accountKeyRequestStatus } from '../../bookings/account-request-status'
import { useRequestFocus } from '../../../shared/components/useRequestFocus'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { cancelMyKeyRequest, returnMyKeyRequest } from '../key.service'
import { keyLoanKeys, myKeyRequestsQuery } from '../key.queries'
import { RecentRequestsHeading } from '../../bookings/components/RecentRequestsHeading'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'

export function AccountKeyRequestHistoryPage({ embedded = false, loanCount = 0 }: { embedded?: boolean; loanCount?: number } = {}) {
  const query = useQuery({ ...myKeyRequestsQuery(), refetchInterval: 15_000 })
  const requestFocus = useRequestFocus(query.isSuccess)
  const client = useQueryClient()
  const [action, setAction] = useState<{ type: 'return' | 'cancel'; id: string } | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: keyLoanKeys.mine })
  const close = () => setAction(null)
  const cancel = useMutation({ mutationFn: cancelMyKeyRequest, onSuccess: () => { refresh(); close() } })
  const returnRequest = useMutation({ mutationFn: returnMyKeyRequest, onSuccess: () => { refresh(); close() } })
  if (query.isPending) return <LoadingSpinner label="กำลังโหลดประวัติ…"/>
  return <section className={embedded ? "key-history-page embedded-key-history" : "key-account-page key-history-page"}>
    {!embedded && <PublicPageHeading title="การจองและกุญแจของฉัน" />}
    <RecentRequestsHeading count={(query.data?.length ?? 0) + loanCount} />
    <div className="account-request-card-list">{query.data?.map(item => {
      const now = Date.now()
      const canCancel = Boolean(item.canCancel) && Date.parse(item.endsAt) > now && ['PENDING_APPROVAL', 'PENDING_STARTED', 'APPROVED'].includes(item.status)
      const canReturn = Boolean(item.canReturn) && ['APPROVED', 'IN_USE'].includes(item.status)
      const editable = ['PENDING_APPROVAL', 'PENDING_STARTED', 'APPROVED'].includes(item.status)
        && Date.parse(item.startsAt) > now
      const rejected = item.status === 'REJECTED'
      return <EditableRequestCard key={item.id} id={item.id} type="key_request" start={item.startsAt} end={item.endsAt} editable={editable} purposeEditable={item.purposeType === 'OTHER'} articleProps={requestFocus(item.id)}
        title={`ห้อง ${item.roomCode}`}
        status={accountKeyRequestStatus(item.status, item.endsAt, now, canReturn)}
        time={<AccountRequestTime start={item.startsAt} end={item.endsAt}/>}
        purposeLabel={rejected ? 'เหตุผลที่ไม่อนุมัติ' : undefined}
        purpose={rejected ? item.decisionReason || 'ไม่ระบุเหตุผล' : item.purpose}
        actions={(canReturn || canCancel) && <>
          {canReturn && <AccountRequestAction variant="return" disabled={returnRequest.isPending}
            onClick={() => setAction({ type: 'return', id: item.id })}>คืนกุญแจ</AccountRequestAction>}
          {canCancel && <AccountRequestAction variant="cancel" disabled={cancel.isPending}
            onClick={() => setAction({ type: 'cancel', id: item.id })}>ยกเลิก</AccountRequestAction>}
        </>}/>
    })}</div>
    {query.error && <p className="panel-error">{query.error.message}</p>}{cancel.error && <p className="panel-error">{cancel.error.message}</p>}{returnRequest.error && <p className="panel-error">{returnRequest.error.message}</p>}
    {action && <ConfirmDialog title={action.type === 'return' ? 'ยืนยันการคืนกุญแจ' : 'ยืนยันการยกเลิกรายการ'} message={action.type === 'return' ? 'กรุณายืนยันว่าคุณได้คืนกุญแจให้เจ้าหน้าที่เรียบร้อยแล้ว' : 'รายการที่ยกเลิกแล้วไม่สามารถนำกลับมาใช้งานได้'} confirmLabel={action.type === 'return' ? 'ยืนยันการคืนกุญแจ' : 'ยกเลิกรายการ'} danger={action.type === 'cancel'} pending={cancel.isPending || returnRequest.isPending} onClose={close} onConfirm={() => action.type === 'return' ? returnRequest.mutate(action.id) : cancel.mutate(action.id)}/>}
  </section>
}
