import { Navigate, useSearchParams } from 'react-router-dom'

export function AccountHistoryRedirect() {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set('tab', 'keys')
  return <Navigate to={`/account/requests?${next}`} replace />
}
