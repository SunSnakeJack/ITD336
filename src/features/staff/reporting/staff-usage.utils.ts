import type{StaffUsageRow,UsageCategory}from'./staff-usage.types'

export const usageStatusLabels = {
 PENDING_APPROVAL: 'รออนุมัติ',
 PENDING_STARTED: 'รออนุมัติ · เริ่มแล้ว',
 APPROVED: 'อนุมัติแล้ว',
 IN_USE: 'กำลังใช้งาน',
 CHECKED_OUT: 'กำลังถือกุญแจ',
 LATE: 'เกินกำหนด',
 RETURNED: 'คืนแล้ว',
 RETURNED_LATE: 'คืนล่าช้า',
 COMPLETED: 'เสร็จสิ้น',
 REJECTED: 'ไม่อนุมัติ',
 CANCELLED: 'ยกเลิก',
 EXPIRED: 'หมดอายุ',
 NO_SHOW: 'ไม่มาใช้งาน',
 SUPERSEDED: 'ถูกแทนที่',
 LOST: 'สูญหาย',
 DAMAGED: 'ชำรุด',
}

export function isOverdueKey(row: StaffUsageRow, now: number) {
 return (row.source === 'KEY_REQUEST' || row.source === 'KEY_LOAN') &&
  !row.returnedAt && Date.parse(row.endsAt) < now && staffUsageStatus(row, now) === 'LATE'
}

export function staffUsageStatus(row: Pick<StaffUsageRow, 'source' | 'status' | 'roomCategory' | 'startsAt' | 'endsAt' | 'returnedAt'>, now: number) {
 const {source, status, endsAt, returnedAt} = row
 if (status === 'RETURNED_VERIFIED') return 'RETURNED'
 if (source === 'KEY_LOAN' && status === 'LATE' && returnedAt) return 'RETURNED_LATE'
 if (source === 'KEY_REQUEST' && row.roomCategory === 'SPECIAL_LAB' &&
  (status === 'PENDING_APPROVAL' || status === 'PENDING_STARTED')) {
  if (now >= Date.parse(endsAt)) return 'EXPIRED'
  if (now >= Date.parse(row.startsAt)) return 'PENDING_STARTED'
 }
 const outstanding = source === 'KEY_REQUEST'
  ? status === 'APPROVED' || status === 'IN_USE'
  : source === 'KEY_LOAN' && (status === 'CHECKED_OUT' || status === 'LATE')
 const returned = (source === 'KEY_REQUEST' || source === 'KEY_LOAN') && status === 'RETURNED'
 if (!outstanding && !returned) return status

 const end = Date.parse(endsAt)
 const actualReturn = returnedAt ? Date.parse(returnedAt) : NaN
 if (!Number.isFinite(end)) return status
 if (Number.isFinite(actualReturn)) return actualReturn > end ? 'RETURNED_LATE' : 'RETURNED'
 return outstanding && now > end ? 'LATE' : status
}
export interface UsageFilters{category:''|UsageCategory;roomId:string;from:string;to:string;status?:string;now?:number}
export function applyRequestStatuses(rows: StaffUsageRow[], requests: ReadonlyMap<string, { status: string }>) {
 return rows.map(row => {
  const request = requests.get(row.transactionId)
  return request && !row.returnedAt ? { ...row, status: request.status } : row
 })
}
const bangkokDay=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Bangkok'})
export function filterUsageRows(rows:StaffUsageRow[],filters:UsageFilters){const now=filters.now??Date.now();return rows.filter(row=>{
 const day=bangkokDay.format(new Date(row.startsAt))
 const status = staffUsageStatus(row, now)
 return(!filters.category||row.roomCategory===filters.category)&&(!filters.roomId||row.roomId===filters.roomId)&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to)&&(!filters.status||(status==='PENDING'?'PENDING_APPROVAL':status)===filters.status)
})}
export function monthlyUsage(rows:StaffUsageRow[]){const values=new Map<string,number>();for(const row of rows){const key=row.startsAt.slice(0,7);values.set(key,(values.get(key)??0)+1)}return[...values].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,count])=>({month,count}))}
export function topUsers(rows:StaffUsageRow[],limit=5){const values=new Map<string,number>();for(const row of rows)values.set(row.userName,(values.get(row.userName)??0)+1);return[...values].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit)}
export function roomUsage(rows:StaffUsageRow[],limit=8){const values=new Map<string,{name:string;count:number}>();for(const row of rows){const current=values.get(row.roomId);if(current)current.count+=1;else values.set(row.roomId,{name:row.roomCode,count:1})}return[...values.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,limit)}

export function usageInsightFilters(params: URLSearchParams): UsageFilters {
  const category = params.get('category')
  return {
    category: category === 'MEETING' || category === 'GENERAL_LAB' || category === 'SPECIAL_LAB' ? category : '',
    roomId: params.get('roomId') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    status: params.get('status') ?? '',
  }
}
