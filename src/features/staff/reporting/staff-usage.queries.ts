import{queryOptions}from'@tanstack/react-query'
import{getStaffUsageHistory}from'./staff-usage.service'
export const staffUsageQuery=()=>queryOptions({queryKey:['staff','usage-history'],queryFn:getStaffUsageHistory,staleTime:30_000})
