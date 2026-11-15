import type { PublicKeyRequestHistoryItem } from '../key.types'
import { bangkokDateKey } from '../../schedules/saturday-policy'
import { bangkokClock } from '../utils/key-catalog-time'
import './KeyCatalogBookingHistory.css'

const dateLabel = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
})

export function KeyCatalogBookingHistory({ items }: { items: PublicKeyRequestHistoryItem[] }) {
  const latest = [...items].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)).slice(0, 10)
  const byDate = new Map<string, PublicKeyRequestHistoryItem[]>()
  for (const item of latest) {
    const date = bangkokDateKey(new Date(item.startsAt))
    const group = byDate.get(date) ?? []
    group.push(item)
    byDate.set(date, group)
  }

  return <div className="key-catalog-history-scroll" role="region" aria-label="รายการเบิกล่าสุด" tabIndex={0}>
    {Array.from(byDate, ([date, entries]) => (
      <section className="key-booking-day" key={date}>
        <h3>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4m10-4v4M3 10h18" />
          </svg>
          รายการเบิก · <time dateTime={date}>{dateLabel.format(new Date(entries[0].startsAt))}</time>
        </h3>
        {entries.map(item => (
          <p key={item.id}>
            <span title={item.requesterName}>{item.requesterName}</span>
            <time dateTime={item.startsAt}>{bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</time>
          </p>
        ))}
      </section>
    ))}
  </div>
}
