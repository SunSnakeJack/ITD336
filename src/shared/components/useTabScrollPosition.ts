import { useLayoutEffect, type RefObject } from 'react'
import { readTabState, writeTabState } from './useTabDraft'

export function useTabScrollPosition(key: string | undefined, content: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (!key) return
    const target = readTabState<number>(key)
    let restoring = typeof target === 'number' && target > 0
    let observer: ResizeObserver | undefined
    const stop = () => { restoring = false; observer?.disconnect() }
    const restore = () => {
      if (!restoring || typeof target !== 'number') return
      window.scrollTo({ top: target, behavior: 'instant' })
      if (Math.abs(window.scrollY - target) < 2) stop()
    }
    const record = () => { if (!restoring) writeTabState(key, window.scrollY) }
    if (restoring && typeof ResizeObserver !== 'undefined' && content.current) {
      observer = new ResizeObserver(restore)
      observer.observe(content.current)
    }
    restore()
    if (!target && window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' })
    const timeout = restoring ? window.setTimeout(stop, 3000) : undefined
    window.addEventListener('scroll', record, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', stop)
    return () => {
      stop()
      window.clearTimeout(timeout)
      window.removeEventListener('scroll', record)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [key, content])
}
