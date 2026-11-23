import { bangkokDateKey } from '../saturday-policy'
import './RoomUsageHistory.css'
import { readTabState, writeTabState } from '../../../shared/components/useTabDraft'

type RoomUsageItem = { id: string; title: string; startsAt: string; endsAt: string }

const dateLabel = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
})

const timeLabel = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok',
})

export function RoomUsageHistory({ items, label, heading, compact = false, order = 'latest', scrollKey }: {
  items: RoomUsageItem[]; label: string; heading: string; compact?: boolean; order?: 'latest' | 'earliest'; scrollKey?: string
}) {
  const direction = order === 'earliest' ? 1 : -1
  const ordered = [...items].sort((a, b) => direction * (Date.parse(a.startsAt) - Date.parse(b.startsAt))).slice(0, 10)
  const byDate = new Map<string, RoomUsageItem[]>()
  for (const item of ordered) {
    const date = bangkokDateKey(new Date(item.startsAt))
    const group = byDate.get(date) ?? []
    group.push(item)
    byDate.set(date, group)
  }

  return <div className={`key-catalog-history-scroll${compact ? ' is-compact' : ''}`} role="region" aria-label={label} tabIndex={0}
    ref={node => { if (node && scrollKey) node.scrollTop = readTabState<number>(scrollKey) ?? 0 }}
    onScroll={event => { if (scrollKey) writeTabState(scrollKey, event.currentTarget.scrollTop) }}>
    {Array.from(byDate, ([date, entries]) => (
      <section className="key-booking-day" key={date}>
        <h3>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4m10-4v4M3 10h18" />
          </svg>
          {heading} · <time dateTime={date}>{dateLabel.format(new Date(entries[0].startsAt))}</time>
        </h3>
        {entries.map(item => (
          <p key={item.id}>
            <span title={item.title}>{item.title}</span>
            <time dateTime={item.startsAt}>{timeLabel.format(new Date(item.startsAt))}–{timeLabel.format(new Date(item.endsAt))} น.</time>
          </p>
        ))}
      </section>
    ))}
  </div>
}
