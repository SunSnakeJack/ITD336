import{queryOptions}from'@tanstack/react-query'
import{getStaffUsageHistory,getStaffUsageReportDetails}from'./staff-usage.service'
export const staffUsageQueryKey = ['staff', 'usage-history'] as const
export const staffUsageQuery = () => queryOptions({
  queryKey: staffUsageQueryKey,
  queryFn: getStaffUsageHistory,
  staleTime: 30_000,
  refetchInterval: 30_000,
})

export const staffUsageReportDetailsQuery = () => queryOptions({
  queryKey: [...staffUsageQueryKey, 'report-details'],
  queryFn: getStaffUsageReportDetails,
  staleTime: 30_000,
  refetchInterval: 30_000,
})
