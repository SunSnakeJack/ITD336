export function LoadingSpinner({ label = 'กำลังโหลด…', compact = false }: { label?: string; compact?: boolean }) {
  return <div className={compact ? 'loading-spinner compact' : 'loading-spinner'} role="status" aria-live="polite"><span aria-hidden="true" /><strong>{label}</strong></div>
}
