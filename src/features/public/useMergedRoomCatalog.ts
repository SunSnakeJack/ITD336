import { useSyncExternalStore } from 'react'

const query = '(1024px <= width < 1280px)'

function subscribe(callback: () => void) {
  const media = window.matchMedia?.(query)
  media?.addEventListener?.('change', callback)
  return () => media?.removeEventListener?.('change', callback)
}

export function useMergedRoomCatalog() {
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false, () => false)
}
