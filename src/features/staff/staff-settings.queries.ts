import{queryOptions}from'@tanstack/react-query'
import{getKeyRequestTimingSetting}from'./staff-settings.service'
export const staffSettingsKeys={timing:['staff','settings','key-request-timing']as const}
export const keyRequestTimingSettingQuery=()=>queryOptions({queryKey:staffSettingsKeys.timing,queryFn:getKeyRequestTimingSetting})
