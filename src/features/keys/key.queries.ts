import { queryOptions } from '@tanstack/react-query'
import { getActiveKeyLoans, getAvailableRoomKeys, getKeyCabinetRooms, getMyKeyLoanDetails, getMyKeyLoans } from './key.service'
export const keyLoanKeys={all:['key-loans'] as const,mine:['key-loans','mine'] as const,active:['key-loans','active'] as const}
export const myKeyLoansQuery=()=>queryOptions({queryKey:keyLoanKeys.mine,queryFn:getMyKeyLoans})
export const myKeyLoanDetailsQuery=()=>queryOptions({queryKey:[...keyLoanKeys.mine,'details'],queryFn:getMyKeyLoanDetails})
export const activeKeyLoansQuery=()=>queryOptions({queryKey:keyLoanKeys.active,queryFn:getActiveKeyLoans})
export const availableRoomKeysQuery=()=>queryOptions({queryKey:[...keyLoanKeys.all,'available-keys'],queryFn:getAvailableRoomKeys})
export const keyCabinetRoomsQuery=()=>queryOptions({queryKey:[...keyLoanKeys.all,'cabinet'],queryFn:getKeyCabinetRooms})
