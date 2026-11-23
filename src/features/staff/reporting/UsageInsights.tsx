import { Link } from 'react-router-dom'
import type { StaffUsageRow } from './staff-usage.types'
import { roomUsage, topUsers, type UsageFilters } from './staff-usage.utils'

type Insight = 'rooms' | 'users'

function usageInsightPath(insight: Insight, filters: UsageFilters) {
  const params = new URLSearchParams({ view: insight })
  for (const key of ['category', 'roomId', 'from', 'to', 'status'] as const) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  return `/staff/reports?${params}`
}

export function UsageInsights({ rows, view, filters }: { rows: StaffUsageRow[]; view?: Insight; filters?: UsageFilters }) {
  const counts = roomUsage(rows)
  const max = Math.max(1, ...counts.map(item => item.count))
  const users = topUsers(rows)
  const heading = (insight: Insight, title: string) =>
    <h3>{filters ? <Link className="usage-insight-link" to={usageInsightPath(insight, filters)}>{title}</Link> : title}</h3>

  return <div className="usage-dashboard-insights">
    {view !== 'users' && <section className="staff-card usage-insight-card usage-rooms">
      <header className="usage-card-header">{heading('rooms', 'จำนวนครั้งการใช้งานรายห้อง')}<small>รวม {rows.length} ครั้ง</small></header>
      {counts.length ? <div>{counts.map(item => <p key={item.name}>
        <b>{item.name}</b><i aria-hidden="true"><span style={{ width: `${item.count / max * 100}%` }} /></i><strong>{item.count}</strong>
      </p>)}</div> : <p className="usage-muted">ไม่มีข้อมูลในช่วงที่เลือก</p>}
    </section>}
    {view !== 'rooms' && <section className="staff-card usage-insight-card usage-ranking">
      <header className="usage-card-header">{heading('users', 'สถิติผู้ใช้สูงสุด')}<small>Top 5</small></header>
      {users.length ? <ol>{users.map(([name, count], index) => <li key={name}>
        <b>{index + 1}</b><i className="usage-ranking-avatar" aria-hidden="true">{name.trim().slice(0, 2)}</i><span>{name}</span><strong>{count} ครั้ง</strong>
      </li>)}</ol> : <p className="usage-muted">ไม่มีข้อมูลในช่วงที่เลือก</p>}
    </section>}
  </div>
}
