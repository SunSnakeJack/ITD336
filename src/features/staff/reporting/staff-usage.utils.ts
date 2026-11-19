import type{StaffUsageRow,UsageCategory}from'./staff-usage.types'

export function staffUsageStatus(row: Pick<StaffUsageRow, 'source' | 'status' | 'endsAt' | 'returnedAt'>, now: number) {
 const {source, status, endsAt, returnedAt} = row
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
export interface UsageFilters{category:''|UsageCategory;roomId:string;from:string;to:string}
const bangkokDay=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Bangkok'})
export function filterUsageRows(rows:StaffUsageRow[],filters:UsageFilters){return rows.filter(row=>{
 const day=bangkokDay.format(new Date(row.startsAt))
 return(!filters.category||row.roomCategory===filters.category)&&(!filters.roomId||row.roomId===filters.roomId)&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to)
})}
export function monthlyUsage(rows:StaffUsageRow[]){const values=new Map<string,number>();for(const row of rows){const key=row.startsAt.slice(0,7);values.set(key,(values.get(key)??0)+1)}return[...values].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,count])=>({month,count}))}
export function topUsers(rows:StaffUsageRow[],limit=5){const values=new Map<string,number>();for(const row of rows)values.set(row.userName,(values.get(row.userName)??0)+1);return[...values].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit)}
export function roomUsage(rows:StaffUsageRow[],limit=8){const values=new Map<string,{name:string;count:number}>();for(const row of rows){const current=values.get(row.roomId);if(current)current.count+=1;else values.set(row.roomId,{name:row.roomCode,count:1})}return[...values.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,limit)}
