import type { ComponentProps, ReactNode } from 'react'
import type { AccountRequestStatus } from '../account-request-status'
import './AccountRequestCard.css'

const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })
const thaiClock = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok' })

function formatRange(start: string, end: string) {
  const first = new Date(start)
  const last = new Date(end)
  const day = thaiDate.format(first)
  const lastDay = thaiDate.format(last)
  return `${day} · ${thaiClock.format(first)}–${day === lastDay ? '' : `${lastDay} · `}${thaiClock.format(last)} น.`
}

interface CardProps {
  title: string
  status: AccountRequestStatus
  edit?: ReactNode
  editing?: boolean
  time: ReactNode
  purpose: ReactNode
  purposeLabel?: string
  actions?: ReactNode
  articleProps?: ComponentProps<'article'>
}

export function AccountRequestTime({ start, end }: { start: string; end: string }) {
  return <time dateTime={start}>{formatRange(start, end)}</time>
}

export function AccountRequestCard({
  title, status, edit, editing, time, purpose, purposeLabel, actions, articleProps,
}: CardProps) {
  return <article {...articleProps} className={editing ? 'account-request-card is-editing' : 'account-request-card'}>
    <header className="account-request-card-header">
      <div className="account-request-card-room">
        <RequestIcon name="door"/>
        <h3>{title}</h3>
      </div>
      <div className="account-request-card-status"><span data-tone={status.tone}>{status.label}</span>{edit}</div>
    </header>
    <div className="account-request-card-field">
      {editing && <span className="account-request-card-label"><RequestIcon name="calendar"/>วัน–เวลา</span>}
      <div>{time}</div>
    </div>
    <footer className="account-request-card-footer">
      <div className="account-request-card-field">
        {editing && <span className="account-request-card-label"><RequestIcon name="target"/>วัตถุประสงค์</span>}
        <div>{purposeLabel && !editing && <small>{purposeLabel}</small>}{purpose}</div>
      </div>
      {actions && <div className="account-request-card-actions">{actions}</div>}
    </footer>
  </article>
}

function RequestIcon({ name }: { name: 'door' | 'calendar' | 'target' }) {
  return <span className="account-request-card-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {name === 'door' && <path d="M5 3l13 2v14L5 21V3Zm9 9h.1"/>}
      {name === 'calendar' && <path d="M4 6h16v14H4zM8 4v4m8-4v4M4 10h16"/>}
      {name === 'target' && <><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 9-9m-4 0h4v4"/></>}
    </svg>
  </span>
}

export function AccountRequestAction({ variant, children, ...props }: ComponentProps<'button'> & {
  variant: 'return' | 'cancel' | 'neutral'
}) {
  return <button {...props} type="button" className={`account-request-action account-request-action-${variant}`}>
    {variant !== 'neutral' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      {variant === 'return'
        ? <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>
        : <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/>}
    </svg>}
    {children}
  </button>
}
