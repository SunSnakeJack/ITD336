import{queryOptions}from'@tanstack/react-query'
import { getKeyRequestTimingSetting, getMeetingAdvanceBookingDays } from './staff-settings.service'

export const meetingAdvanceBookingDaysQuery = () => queryOptions({
  queryKey: ['staff', 'settings', 'meeting-advance-booking-days'],
  queryFn: getMeetingAdvanceBookingDays,
})
export const staffSettingsKeys={timing:['staff','settings','key-request-timing']as const}
export const keyRequestTimingSettingQuery=()=>queryOptions({queryKey:staffSettingsKeys.timing,queryFn:getKeyRequestTimingSetting})
