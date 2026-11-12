import { queryOptions } from '@tanstack/react-query'
import { getStaffRoleOptions, getStaffUserDirectory } from './staff-user.service'
export const staffUserKeys={directory:['staff','users'] as const,roles:['staff','roles'] as const}
export const staffUserDirectoryQuery=()=>queryOptions({queryKey:staffUserKeys.directory,queryFn:getStaffUserDirectory})
export const staffRoleOptionsQuery=()=>queryOptions({queryKey:staffUserKeys.roles,queryFn:getStaffRoleOptions,staleTime:5*60_000})
