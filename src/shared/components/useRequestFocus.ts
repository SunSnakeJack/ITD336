import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

export function useRequestFocus(ready: boolean) {
  const [params, setParams] = useSearchParams()
  const { key } = useLocation()
  const itemId = params.get('item')

  useEffect(() => {
    if (!itemId || !ready) return
    const item = document.getElementById(`request-${itemId}`)
    item?.scrollIntoView?.({ block: 'center' })
    item?.focus({ preventScroll: true })
  }, [itemId, key, ready])

  useEffect(() => {
    if (!itemId) return
    const dismiss = (event: PointerEvent) => {
      const item = document.getElementById(`request-${itemId}`)
      if (!item || !(event.target instanceof Node) || item.contains(event.target)) return
      const next = new URLSearchParams(params)
      next.delete('item')
      setParams(next, { replace: true, preventScrollReset: true })
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [itemId, params, setParams])

  return (id: string) => ({
    id: `request-${id}`,
    tabIndex: itemId === id ? -1 : undefined,
    'data-request-highlight': itemId === id ? 'true' : undefined,
  })
}
