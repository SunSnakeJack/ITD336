import { UsageInsights } from '../reporting/UsageInsights'
import { useStaffViewState } from '../useStaffViewState'
import{useCallback,useEffect,useMemo,useState}from'react'
import { useOutletContext } from 'react-router-dom'
import { UsagePrintReport, type UsageReportSnapshot } from '../reporting/UsagePrintReport'
import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query'
import{SelectField}from'../../../shared/components/SelectField'
import{StaffPage,StaffQueryState}from'../components/StaffPage'
import{staffUsageQuery,staffUsageQueryKey}from'../reporting/staff-usage.queries'
import{applyRequestStatuses,filterUsageRows,isOverdueKey,staffUsageStatus,topUsers,usageStatusLabels}from'../reporting/staff-usage.utils'
import type{StaffUsageRow,UsageCategory}from'../reporting/staff-usage.types'
import{StaffRoomDecisionDialog}from'../components/StaffKeyRequestDecisionDialog'
import{DecisionButtons}from'./StaffKeyRequestsPage'
import{decideStaffKeyRequest,getStaffKeyRequests,staffKeyRequestQueryKey,type StaffKeyRequest}from'../staff-key-request.service'
import { StaffMeetingDecisionButtons } from '../components/StaffMeetingDecisionButtons'
import{StatusBadge}from'../components/StaffPage'

import { confirmOverdueRoomKeyReturns } from '../reporting/staff-usage.service'
import { StaffRoomReturnDialog } from '../components/StaffRoomReturnDialog'
import { keyLoanKeys } from '../../keys/key.queries'

const statusLabels: Record<string, string> = { ...usageStatusLabels, PENDING: usageStatusLabels.PENDING_APPROVAL }
const dateFormat=new Intl.DateTimeFormat('th-TH-u-nu-latn',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'Asia/Bangkok'})
const timeFormat=new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})
const categoryLabels:Record<UsageCategory,string>={MEETING:'ห้องประชุม',GENERAL_LAB:'ห้องปฏิบัติการทั่วไป',SPECIAL_LAB:'ห้องปฏิบัติการพิเศษ'}
const emptyRows:StaffUsageRow[]=[]

export function StaffUsageDashboardPage(){
 const issuedBy = useOutletContext<{ fullName: string } | undefined>()?.fullName
 const [report, setReport] = useState<UsageReportSnapshot | null>(null)
 const closeReport = useCallback(() => setReport(null), [])
 const [{ category, roomId, from, to, pageSize, page, status }, updateView] = useStaffViewState('dashboard', { category: '' as '' | UsageCategory, roomId: '', from: '', to: '', pageSize: 10, page: 1, status: '' })
 const client=useQueryClient(),query=useQuery(staffUsageQuery()),requests=useQuery({queryKey:staffKeyRequestQueryKey,queryFn:getStaffKeyRequests}),[action,setAction]=useState<{item:StaffKeyRequest;decision:'APPROVED'|'REJECTED'}|null>(null)
 const decide=useMutation({mutationFn:decideStaffKeyRequest,onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:staffKeyRequestQueryKey}),client.invalidateQueries({queryKey:staffUsageQueryKey})]);setAction(null)}})
 const rows=query.data??emptyRows,rooms=useMemo(()=>[...new Map(rows.filter(row=>!category||row.roomCategory===category).map(row=>[row.roomId,{id:row.roomId,code:row.roomCode,name:row.roomName}])).values()].sort((a,b)=>a.code.localeCompare(b.code)),[rows,category])

 const [returnRoom, setReturnRoom] = useState<{ id: string; code: string } | null>(null)
 const [returnMessage, setReturnMessage] = useState('')
 const [now, setNow] = useState(Date.now)
 useEffect(() => {
  const timer = window.setInterval(() => setNow(Date.now()), 1000)
  return () => window.clearInterval(timer)
 }, [])
 const returnPreview = useQuery({
  queryKey: [...staffUsageQueryKey, 'overdue-return-preview', returnRoom?.id],
  queryFn: () => confirmOverdueRoomKeyReturns({ roomId: returnRoom?.id ?? '', count: null }),
  enabled: returnRoom !== null,
  refetchOnWindowFocus: false,
  retry: false,
 })
 const returns = useMutation({
  mutationFn: confirmOverdueRoomKeyReturns,
  onSuccess: async count => {
   await Promise.all([staffUsageQueryKey, staffKeyRequestQueryKey, keyLoanKeys.all].map(queryKey => client.invalidateQueries({ queryKey })))
   setReturnRoom(null)
   setReturnMessage(count ? `บันทึกคืนกุญแจแล้ว ${count} รายการ` : 'ไม่มีรายการเกินกำหนดที่ต้องอัปเดตแล้ว')
  },
  onError: () => client.invalidateQueries({ queryKey: staffUsageQueryKey }),
 })
 const requestById = useMemo(() => new Map(requests.data?.map(request => [request.id, request])), [requests.data])
 const effectiveRows = useMemo(() => applyRequestStatuses(rows, requestById), [rows, requestById])
 const filtered = useMemo(() => filterUsageRows(effectiveRows, { category, roomId, from, to, status, now }), [effectiveRows, category, roomId, from, to, status, now])
 const users = useMemo(() => topUsers(filtered), [filtered])
 const openReturn = (row: StaffUsageRow) => {
  returns.reset()
  setReturnMessage('')
  client.removeQueries({ queryKey: [...staffUsageQueryKey, 'overdue-return-preview', row.roomId] })
  setReturnRoom({ id: row.roomId, code: row.roomCode })
 }
 const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pageCount),visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 const reportDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })
 const formatFilterDate = (value: string) => reportDate.format(new Date(value + 'T00:00:00+07:00'))
 const exportReport = () => {
  if (!query.isSuccess || report) return
  const room = rooms.find(item => item.id === roomId)
  const dates = [from && `ตั้งแต่ ${formatFilterDate(from)}`, to && `ถึง ${formatFilterDate(to)}`].filter(Boolean)
  setReport({
   issuedBy: issuedBy || '—',
   issuedOn: reportDate.format(new Date()),
   filters: [category ? categoryLabels[category] : 'ทุกประเภท', room?.code ?? 'ทุกห้อง', statusLabels[status] ?? 'ทุกสถานะ', dates.join(' ') || 'ไม่จำกัดวันที่'],
   rows: filtered.map((row, index) => {
    const request = requestById.get(row.transactionId)
    const status = staffUsageStatus(row, now)
    return [String(index + 1), dateFormat.format(new Date(row.startsAt)), row.roomCode, categoryLabels[row.roomCategory],
     request?.status === 'REJECTED' ? request.decisionReason || 'ไม่ระบุเหตุผล' : row.purpose, row.userName,
     timeFormat.format(new Date(row.startsAt)),
     row.returnedAt ? timeFormat.format(new Date(row.returnedAt)) : row.source === 'BOOKING' ? timeFormat.format(new Date(row.endsAt)) : 'ยังไม่คืน',
     statusLabels[status] ?? status]
   }),
  })
 }

 return <StaffPage eyebrow="Usage Dashboard" title="ภาพรวมและประวัติการใช้งาน" description="สถิติและรายการจากข้อมูลการจองและการเบิกกุญแจจริง" hideHeader>
  <form id="usage-report-export" onSubmit={event => { event.preventDefault(); exportReport() }} />
  {report && <UsagePrintReport report={report} onClose={closeReport} />}
  <StaffQueryState loading={query.isPending} error={query.error} empty={!rows.length} emptyText="ยังไม่มีรายการใช้งานจริงในระบบ"><>
   <div className="staff-grid staff-grid-3"><article className="staff-card staff-stat usage-summary-card usage-summary-blue"><small>รายการตามตัวกรอง</small><strong>{filtered.length.toLocaleString('th-TH')}</strong><span>ครั้ง</span></article><article className="staff-card staff-stat usage-summary-card usage-summary-teal"><small>ห้องที่ถูกใช้งาน</small><strong>{new Set(filtered.map(row=>row.roomId)).size}</strong><span>ห้อง</span></article><article className="staff-card staff-stat usage-summary-card usage-summary-amber"><small>ผู้ใช้สูงสุด</small><strong className="usage-top-name">{users[0]?.[0]??'—'}</strong><span>{users[0]?.[1]??0} ครั้ง</span></article></div>
   <div className="usage-dashboard-body"><UsageInsights rows={filtered} filters={{ category, roomId, from, to, status }} />
    <div className="usage-filterbar usage-filterbar-compact usage-no-print"><div className="usage-filter-control"><SelectField<''|UsageCategory> label="ประเภทห้อง" value={category} placeholder="ทุกประเภท" options={[{value:'',label:'ทุกประเภท'},...Object.entries(categoryLabels).map(([value,label])=>({value:value as UsageCategory,label}))]} onChange={category=>updateView({ category, roomId: '', page: 1 })}/></div><div className="usage-filter-control"><SelectField<string> label="ห้อง" value={roomId} placeholder="ทุกห้อง" options={[{value:'',label:'ทุกห้อง'},...rooms.map(room=>({value:room.id,label:room.code}))]} onChange={roomId=>updateView({ roomId, page: 1 })}/></div><div className="usage-filter-control"><SelectField<string> label="สถานะห้อง" value={status} placeholder="ทุกสถานะ" options={[{value:'',label:'ทุกสถานะ'},...Object.entries(usageStatusLabels).map(([value,label])=>({value,label}))]} onChange={status=>updateView({ status, page: 1 })}/></div><div className="staff-field usage-filter-control"><label htmlFor="usage-from">ตั้งแต่วันที่</label><input id="usage-from" type="date" value={from} onChange={event=>updateView({ from: event.target.value, page: 1 })}/></div><div className="staff-field usage-filter-control"><label htmlFor="usage-to">ถึงวันที่</label><input id="usage-to" type="date" value={to} onChange={event=>updateView({ to: event.target.value, page: 1 })}/></div></div>
    <section className="staff-section usage-records-panel usage-records-card"><div className="staff-section-head"><div><h3>รายการบันทึก</h3><small>หน้า {safePage} / {pageCount} · แสดง {pageSize} รายการ</small></div><div className="usage-page-size usage-no-print"><SelectField<'10'|'20'> label="แสดง" value={String(pageSize) as '10'|'20'} placeholder="จำนวนรายการ" options={[{value:'10',label:'10 รายการ'},{value:'20',label:'20 รายการ'}]} onChange={value=>updateView({ pageSize: Number(value), page: 1 })}/></div></div>{returnMessage && <p role="status" className="usage-return-message">{returnMessage}</p>}<UsageTable rows={visible} now={now} onReturn={openReturn} offset={(safePage-1)*pageSize} requests={requestById} onSelect={(item,decision)=>setAction({item,decision})}/><footer className="usage-records-footer usage-no-print"><span>แสดง {visible.length?(safePage-1)*pageSize+1:0}–{(safePage-1)*pageSize+visible.length} จาก {filtered.length} รายการ</span><nav className="usage-pagination" aria-label="หน้ารายการ"><button aria-label="หน้าก่อนหน้า" disabled={safePage===1} onClick={()=>updateView({ page: safePage - 1 })}>←</button>{Array.from({length:pageCount},(_,index)=>index+1).map(number=><button key={number} aria-label={`หน้า ${number}`} aria-current={number===safePage?'page':undefined} className={number===safePage?'active':''} onClick={()=>updateView({ page: number })}>{number}</button>)}<button aria-label="หน้าถัดไป" disabled={safePage===pageCount} onClick={()=>updateView({ page: safePage + 1 })}>→</button></nav></footer></section></div>
  </></StaffQueryState>
  {action&&<StaffRoomDecisionDialog requestCode={action.item.requestCode} roomCode={action.item.roomCode} decision={action.decision} pending={decide.isPending} error={decide.error?.message} onClose={()=>setAction(null)} onConfirm={reason=>decide.mutate({id:action.item.id,decision:action.decision,reason})}/>}
  {returnRoom && <StaffRoomReturnDialog roomCode={returnRoom.code} count={returnPreview.data} loading={returnPreview.isFetching} pending={returns.isPending}
   error={returns.error?.message ?? returnPreview.error?.message} onClose={() => setReturnRoom(null)}
   onConfirm={() => { if (returnPreview.data) returns.mutate({ roomId: returnRoom.id, count: returnPreview.data }) }} />}
 </StaffPage>
}

function UsageTable({ rows, offset, requests, now, onSelect, onReturn }: {
 rows: StaffUsageRow[]
 offset: number
 requests: Map<string, StaffKeyRequest>
 now: number
 onSelect: (item: StaffKeyRequest, decision: 'APPROVED' | 'REJECTED') => void
 onReturn: (row: StaffUsageRow) => void
}) {
 return <div className="staff-table-wrap usage-screen-table usage-table-scroll"><table className="staff-table"><thead><tr><th>ลำดับ</th><th>วันเดือนปี</th><th>เลขห้อง</th><th>วัตถุประสงค์</th><th>ผู้ใช้งาน</th><th>เวลาเบิก</th><th>เวลาคืน</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody>{rows.map((row,index)=>{const request=requests.get(row.transactionId);const displayStatus=staffUsageStatus(row,now);const purpose=request?.status==='REJECTED'?(request.decisionReason||'ไม่ระบุเหตุผล'):row.purpose;return <tr key={row.transactionId}><td>{offset+index+1}</td><td>{dateFormat.format(new Date(row.startsAt))}</td><td>{row.roomCode}</td><td><span className="usage-purpose" tabIndex={0}><span className="usage-purpose-preview">{purpose}</span><span className="usage-purpose-tooltip" aria-hidden="true">{purpose}</span></span></td><td>{row.userName}</td><td>{timeFormat.format(new Date(row.startsAt))}</td><td>{row.returnedAt?timeFormat.format(new Date(row.returnedAt)):row.source==='BOOKING'?timeFormat.format(new Date(row.endsAt)):'ยังไม่คืน'}</td><td><StatusBadge status={displayStatus}/></td><td>{isOverdueKey(row, now) ? <button type="button" className="usage-key-return" onClick={() => onReturn(row)}>ยืนยันรับกุญแจ</button> : row.source==='BOOKING'&&row.roomCategory==='MEETING'&&['PENDING','PENDING_STARTED'].includes(displayStatus)?<StaffMeetingDecisionButtons row={row}/>:request&&['PENDING_APPROVAL','PENDING_STARTED'].includes(displayStatus)?<DecisionButtons item={request} onSelect={decision=>onSelect(request,decision)}/>:<div className="usage-no-action">—</div>}</td></tr>})}</tbody></table></div>}
