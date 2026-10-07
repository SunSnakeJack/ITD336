import { queryOptions } from '@tanstack/react-query'
import { getActiveKeyLoans, getMyKeyLoans } from './key.service'
export const keyLoanKeys={mine:['key-loans','mine'] as const,active:['key-loans','active'] as const}
export const myKeyLoansQuery=()=>queryOptions({queryKey:keyLoanKeys.mine,queryFn:getMyKeyLoans})
export const activeKeyLoansQuery=()=>queryOptions({queryKey:keyLoanKeys.active,queryFn:getActiveKeyLoans})
