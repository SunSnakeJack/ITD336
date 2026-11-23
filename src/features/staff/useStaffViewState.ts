import { useOutletContext } from 'react-router-dom'
import { useTabDraft } from '../../shared/components/useTabDraft'
import type { StaffOutletContext } from './components/StaffLayout'

export function useStaffViewState<T extends object>(view: string, initial: T) {
  const account = useOutletContext<StaffOutletContext | null>()
  return useTabDraft(`staff-${view}:${account?.userId ?? ''}`, initial)
}
