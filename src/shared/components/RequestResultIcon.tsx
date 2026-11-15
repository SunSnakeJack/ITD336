import './RequestResultIcon.css'

export function RequestResultIcon({ pending = false }: { pending?: boolean }) {
  return <svg className={`request-result-icon ${pending ? 'is-pending' : 'is-confirmed'}`}
    aria-hidden="true" viewBox="0 0 64 64">
    {pending ? <path d="M17 7h30v6c0 8-5 13-12 19 7 6 12 11 12 19v6H17v-6c0-8 5-13 12-19-7-6-12-11-12-19z" />
      : <><circle cx="32" cy="32" r="27" /><path d="m21 32 8 8 14-17" /></>}
  </svg>
}
