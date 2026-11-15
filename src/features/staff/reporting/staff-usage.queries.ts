import{queryOptions}from'@tanstack/react-query'
import{getStaffUsageHistory}from'./staff-usage.service'
export const staffUsageQueryKey = ['staff', 'usage-history'] as const
export const staffUsageQuery = () => queryOptions({
  queryKey: staffUsageQueryKey,
  queryFn: getStaffUsageHistory,
  staleTime: 30_000,
})
