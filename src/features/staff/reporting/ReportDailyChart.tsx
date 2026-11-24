import { useState } from 'react'
import { shortReportDate, type summarizeReport } from './staff-report-model'

export function ReportDailyChart({ daily, peak }: Pick<ReturnType<typeof summarizeReport>, 'daily' | 'peak'>) {
  const [table, setTable] = useState(false)
  const max = peak?.count ?? 1
  const step = Math.max(1, Math.ceil(max / 5))
  const ceiling = step * 5
  const x = (index: number) => 52 + 620 * index / Math.max(1, daily.length - 1)
  const y = (count: number) => 204 - 174 * count / ceiling
  const label = (date: string) => shortReportDate.format(new Date(date))
  const stride = Math.max(1, Math.ceil(daily.length / 7))
  return <section className="report-panel report-chart">
    <h3>จำนวนรายวัน</h3>
    {!peak && <p className="report-note">ไม่มีรายการในช่วงที่เลือก</p>}
    {peak && <p className="report-note">สูงสุด {peak.count} ครั้ง · {label(peak.date)}</p>}
    {peak && !table && <svg viewBox="0 0 710 240" role="img" aria-label={`กราฟจำนวนรายวัน สูงสุด ${peak.count} ครั้ง ในวันที่ ${label(peak.date)}`}>
      {Array.from({ length: 6 }, (_, index) => index * step).map(tick => <g key={tick}>
        <line x1="52" x2="672" y1={y(tick)} y2={y(tick)} className="report-gridline" />
        <text x="42" y={y(tick) + 5} textAnchor="end">{tick}</text>
      </g>)}
      <polyline points={daily.map((day, index) => `${x(index)},${y(day.count)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" />
      {daily.map((day, index) => <g key={day.date}>
        {(daily.length <= 31 || day.date === peak.date) && <circle cx={x(index)} cy={y(day.count)} r={day.date === peak.date ? 6 : 4} className={day.date === peak.date ? 'report-peak' : 'report-point'} />}
        {(daily.length <= 7 || day.date === peak.date) && <text x={x(index)} y={y(day.count) - 12} textAnchor="middle">{day.count}</text>}
        {index % stride === 0 && <text x={x(index)} y="228" textAnchor="middle">{label(day.date)}</text>}
      </g>)}
    </svg>}
    {table && <div className="staff-table-wrap report-data-table"><table className="staff-table">
      <thead><tr><th scope="col">วันที่</th><th scope="col">จำนวน (ครั้ง)</th></tr></thead>
      <tbody>{daily.map(day => <tr key={day.date}><td>{label(day.date)}</td><td>{day.count}</td></tr>)}</tbody>
    </table></div>}
    <button type="button" className="report-chart-toggle" aria-expanded={table} onClick={() => setTable(!table)}>
      {table ? 'ซ่อนตารางรายวัน' : 'ดูตารางรายวัน'}
    </button>
  </section>
}
