import { useEffect, useState } from 'react'

const prefix = 'itkeyspace:tab:'

export function readTabState<T>(key: string): T | undefined {
  try {
    const value = sessionStorage.getItem(prefix + key)
    return value === null ? undefined : JSON.parse(value) as T
  } catch { return undefined }
}

export function writeTabState(key: string, value: unknown) {
  try { sessionStorage.setItem(prefix + key, JSON.stringify(value)) } catch { /* Storage may be disabled. */ }
}

export function removeTabState(key: string) {
  try { sessionStorage.removeItem(prefix + key) } catch { /* Storage may be disabled. */ }
}

export function clearTabState() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key)
  } catch { /* Storage may be disabled. */ }
}

export function useTabDraft<T extends object>(key: string, initial: T) {
  const [saved, setSaved] = useState(() => ({ key, value: readTabState<T>(key) ?? initial }))
  const current = saved.key === key ? saved : { key, value: readTabState<T>(key) ?? initial }
  if (current !== saved) setSaved(current)
  useEffect(() => { writeTabState(saved.key, saved.value) }, [saved])
  const update = (patch: Partial<T>) => setSaved(previous => ({
    key,
    value: { ...(previous.key === key ? previous.value : current.value), ...patch },
  }))
  return [current.value, update, () => removeTabState(key)] as const
}
