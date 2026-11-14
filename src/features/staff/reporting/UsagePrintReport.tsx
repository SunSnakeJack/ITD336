import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import keySpaceLogo from '../../../assets/it-keyspace.ico'
import './usage-print-report.css'

export interface UsageReportSnapshot {
  filters: string[]
  issuedOn: string
  issuedBy: string
  rows: string[][]
}

const headings = ['ลำดับ', 'วันเดือนปี', 'เลขห้อง', 'ประเภท', 'วัตถุประสงค์', 'ผู้ใช้งาน', 'เวลาเบิก', 'เวลาคืน', 'สถานะ']
const widths = [5, 9, 13, 12, 17, 15, 7, 8, 14]

function ReportPage({ report, rows, page, total }: { report: UsageReportSnapshot; rows: string[][]; page: number; total: number }) {
  return <section className="usage-report-sheet">
    <header className="usage-report-heading">
      <img src={keySpaceLogo} alt="IT KeySpace" />
      <div className="usage-report-title">
        <h1>ระบบบันทึกข้อมูลการเบิกกุญแจห้องปฏิบัติการ และระบบจองห้องประชุมคณะ</h1>
        <h2>รายงานการใช้งานห้อง</h2>
        <p>{report.filters.join(' · ')}</p>
      </div>
      <div className="usage-report-meta">
        <div>วันที่ {report.issuedOn}</div>
        <div>ผู้ทำรายการ {report.issuedBy}</div>
        <div>หน้าที่ {page}/{total}</div>
      </div>
    </header>
    <table className="usage-report-table">
      <colgroup>{widths.map((width, index) => <col key={headings[index]} style={{ width: width + '%' }} />)}</colgroup>
      <thead><tr>{headings.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={headings[index]}>{cell}</td>)}</tr>) : <tr><td colSpan={9}>ไม่พบรายการตามตัวกรอง</td></tr>}</tbody>
    </table>
  </section>
}

export function UsagePrintReport({ report, onClose }: { report: UsageReportSnapshot; onClose: () => void }) {
  const probe = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][][] | null>(null)

  useEffect(() => {
    if (!pages) return
    let frame = 0
    let cancelled = false
    const logos = document.querySelectorAll<HTMLImageElement>('.usage-report-output[data-ready="true"] img')
    void Promise.allSettled(Array.from(logos, logo => logo.decode?.())).then(() => {
      if (!cancelled) frame = window.requestAnimationFrame(() => window.print())
    })
    window.addEventListener('afterprint', onClose, { once: true })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', onClose)
    }
  }, [pages, onClose])

  useEffect(() => {
    let cancelled = false
    async function measure() {
      await document.fonts?.ready
      if (cancelled || !probe.current) return
      const sheet = probe.current.querySelector<HTMLElement>('.usage-report-sheet')
      const header = sheet?.querySelector('header')
      const tableHeader = sheet?.querySelector('thead')
      if (!sheet || !header || !tableHeader) return
      const style = getComputedStyle(sheet)
      const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      const available = sheet.clientHeight - padding - header.getBoundingClientRect().height - tableHeader.getBoundingClientRect().height - 8
      const result: string[][][] = [[]]
      let used = 0
      sheet.querySelectorAll('tbody tr').forEach((row, index) => {
        if (!report.rows[index]) return
        const height = row.getBoundingClientRect().height
        if (used + height > available && result.at(-1)?.length) {
          result.push([])
          used = 0
        }
        result.at(-1)?.push(report.rows[index])
        used += height
      })
      setPages(result)
    }
    void measure()
    return () => { cancelled = true }
  }, [report])

  return createPortal(<div className="usage-report-output" data-ready={Boolean(pages)}>
    {!pages && <div className="usage-report-probe" ref={probe} aria-hidden="true"><ReportPage report={report} rows={report.rows} page={1} total={1} /></div>}
    <div className="usage-report-pages">{pages?.map((rows, index) => <ReportPage key={index} report={report} rows={rows} page={index + 1} total={pages.length} />)}</div>
  </div>, document.body)
}
