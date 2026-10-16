import { queryOptions } from '@tanstack/react-query'
import { getRoomUsagePolicy } from './policy.service'
export const policyKeys={all:['policies'] as const,room:(roomId:string)=>['policies','room',roomId] as const}
export const roomUsagePolicyQuery=(roomId:string)=>queryOptions({queryKey:policyKeys.room(roomId),queryFn:()=>getRoomUsagePolicy(roomId),enabled:Boolean(roomId)})
