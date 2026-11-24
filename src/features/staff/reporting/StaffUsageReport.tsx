import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import { ReportDailyChart } from './ReportDailyChart'
import { borrowerLabels, reportPresets, reportRange, shortReportDate, summarizeReport } from './staff-report-model'
import { staffUsageQuery, staffUsageReportDetailsQuery } from './staff-usage.queries'
import { filterUsageRows, usageInsightFilters } from './staff-usage.utils'
import './staff-usage-report.css'

const categories = { GENERAL_LAB: 'ห้องปฏิบัติการ', SPECIAL_LAB: 'ห้องปฏิบัติการพิเศษ' }
const views = { rooms: 'รายห้อง', types: 'ประเภทผู้เบิก', users: 'รายคน' }
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })

export function StaffUsageReport() {
  const [params, setParams] = useSearchParams()
  const usage = useQuery(staffUsageQuery())
  const metadata = useQuery(staffUsageReportDetailsQuery())
  const details = new Map(metadata.data?.map(row => [row.transaction_id.replace(/^key-request:/, ''), row]))
  const filters = usageInsightFilters(params)
  const meeting = params.get('report') === 'meetings' || (!params.has('report') && filters.category === 'MEETING')
  const selected = params.get('view')
  const view = selected === 'users' || (selected === 'types' && metadata.data) ? selected : 'rooms'
  const savedPreset = params.get('period')
  const preset = savedPreset === 'previous' || savedPreset === 'week' || savedPreset === 'rolling' ? savedPreset : 'month'
  const range = reportRange(preset, new Date())
  const from = filters.from || range.from
  const to = filters.to || range.to
  const invalidRange = from > to
  const update = (changes: Record<string, string>) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    return next
  })

  const source = (usage.data ?? []).filter(row => meeting ? row.source === 'BOOKING' : row.source !== 'BOOKING')
  const category = meeting ? 'MEETING' : filters.category === 'MEETING' ? '' : filters.category
  const rooms = [...new Map(source.filter(row => !category || row.roomCategory === category)
    .map(row => [row.roomId, row.roomCode]))].sort((a, b) => a[1].localeCompare(b[1], 'th'))
  const borrower = metadata.data ? params.get('borrower') || '' : ''
  const rows = invalidRange ? [] : filterUsageRows(source, { ...filters, category, from, to }).filter(row =>
    (filters.status || !['REJECTED', 'EXPIRED'].includes(row.status)) &&
    (!borrower || (details.get(row.transactionId)?.user_type ?? 'UNKNOWN') === borrower))
  const result = summarizeReport(rows, details, from, invalidRange ? '' : to)
  const ranks = result[view]
  const changeReport = (next: string) => update({ report: next, roomId: '', category: '', status: '', borrower: '' })

  return <StaffPage eyebrow="" title="รายงานสถิติ" description="" hideHeader>
    <div className="staff-usage-report">
      <nav className="report-switch" aria-label="ประเภทรายงาน">
        <button type="button" aria-pressed={!meeting} onClick={() => changeReport('keys')}>การเบิก–คืนกุญแจ</button>
        <button type="button" aria-pressed={meeting} onClick={() => changeReport('meetings')}>การจองห้องประชุม</button>
      </nav>
      <div className="report-filters" aria-label="ตัวกรองรายงาน" role="group">
        <div className="report-presets">
          {Object.entries(reportPresets).map(([key, label]) => <button type="button" key={key}
            aria-pressed={!filters.from && !filters.to && key === preset}
            onClick={() => update({ period: key, from: '', to: '' })}>{label}</button>)}
        </div>
        <label>ตั้งแต่<input type="date" name="from" value={from} onChange={event => update({ from: event.target.value })} /></label>
        <label>ถึง<input type="date" name="to" value={to} onChange={event => update({ to: event.target.value })} /></label>
        <label>ห้อง<select value={filters.roomId} onChange={event => update({ roomId: event.target.value })}>
          <option value="">ทั้งหมด</option>
          {rooms.map(([id, code]) => <option value={id} key={id}>{code}</option>)}
        </select></label>
        <label>ประเภทห้อง<select value={category} disabled={meeting} onChange={event => update({ category: event.target.value, roomId: '' })}>
          {meeting ? <option value="MEETING">ห้องประชุม</option> : <><option value="">ทั้งหมด</option>
            {Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</>}
        </select></label>
        <label>{meeting ? 'ประเภทผู้จอง' : 'ประเภทผู้เบิก'}<select value={borrower} disabled={!metadata.data}
          onChange={event => update({ borrower: event.target.value })}>
          <option value="">ทั้งหมด</option>
          {Object.entries(borrowerLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        {filters.status && <button type="button" onClick={() => update({ status: '' })}>ล้างตัวกรองสถานะ</button>}
      </div>
      {invalidRange && <p role="alert">วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด</p>}
      <StaffQueryState loading={usage.isPending || metadata.isPending} error={usage.error || metadata.error}>
        {metadata.data === null && <p className="report-note">ตัวกรองประเภทผู้ใช้งานและชั่วโมงเบิก–คืนจะพร้อมเมื่ออัปเดตฐานข้อมูลรายงาน</p>}
        {!invalidRange && <div className="report-columns">
          <div className="report-column">
            <dl className="report-panel report-metrics">
              <div><dt>{meeting ? 'จำนวนการจอง (รวม)' : 'จำนวนการเบิก–คืน (รวม)'}</dt><dd>{number.format(result.total)} ครั้ง</dd></div>
              <div><dt>ค่าเฉลี่ยต่อวัน</dt><dd>{number.format(result.average)} ครั้ง/วัน</dd></div>
              <div><dt>ระยะเวลาใช้งาน (รวม)</dt><dd>{result.hours === null ? '—' : `${number.format(result.hours)} ชั่วโมง`}</dd>
                <small>{meeting ? 'ตามช่วงเวลาที่จอง' : 'เฉพาะรายการที่มีเวลาเบิกและคืนจริง'}</small></div>
            </dl>
            <ReportDailyChart daily={result.daily} peak={result.peak} />
          </div>
          <div className="report-column">
            <dl className="report-panel report-highlights">
              <div><dt>ห้องใช้มากสุด</dt><dd>{result.most?.name ?? '—'}</dd></div>
              <div><dt>ห้องใช้น้อยสุด</dt><dd>{result.least?.name ?? '—'}</dd></div>
              <div><dt>วันที่ใช้มากสุด</dt><dd>{result.peak ? shortReportDate.format(new Date(result.peak.date)) : '—'}</dd></div>
            </dl>
            <section className="report-panel report-ranking">
              <h3>รายละเอียดการใช้งาน</h3>
              <div className="report-switch" role="group" aria-label="การจัดกลุ่มรายละเอียด">
                {Object.entries(views).map(([key, name]) => <button key={key} type="button" aria-pressed={view === key}
                  disabled={key === 'types' && !metadata.data} onClick={() => update({ view: key })}>
                  {key === 'types' && meeting ? 'ประเภทผู้จอง' : name}</button>)}
              </div>
              <h4>{view === 'rooms' ? 'จำนวนครั้งการใช้งานรายห้อง' : view === 'users' ? 'จำนวนครั้งการใช้งานรายคน' : 'แยกตามประเภทผู้ใช้งาน'}</h4>
              {ranks.length > 0 ? <div className="staff-table-wrap report-data-table"><table className="staff-table">
                <thead><tr><th scope="col">{meeting && view === 'types' ? 'ประเภทผู้จอง' : views[view]}</th><th scope="col" aria-sort="descending">จำนวน (ครั้ง)</th></tr></thead>
                <tbody>{ranks.map(row => <tr key={row.id}><td>{row.name}</td><td><div className="report-rank-value">
                  <span aria-hidden="true" className="report-rank-track"><span style={{ width: `${row.count / ranks[0].count * 100}%` }} /></span>
                  <strong>{number.format(row.count)}</strong>
                </div></td></tr>)}</tbody>
              </table></div> : <p className="report-note">ไม่มีข้อมูลในช่วงที่เลือก</p>}
            </section>
          </div>
        </div>}
      </StaffQueryState>
    </div>
  </StaffPage>
}
