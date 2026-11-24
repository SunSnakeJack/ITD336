import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { StaffUsageReport } from './StaffUsageReport'
import { reportRange, summarizeReport } from './staff-report-model'
import { staffUsageQuery, staffUsageReportDetailsQuery } from './staff-usage.queries'
import type { StaffUsageRow } from './staff-usage.types'

const key: StaffUsageRow = {
  transactionId: 'key-loan:one', source: 'KEY_LOAN', roomId: 'lab', roomCode: 'S2407',
  roomName: 'Lab', roomCategory: 'GENERAL_LAB', purpose: 'ทดสอบ', userName: 'ผู้เบิก',
  startsAt: '2026-11-18T18:00:00Z', endsAt: '2026-11-18T20:00:00Z',
  returnedAt: '2026-11-18T19:30:00Z', status: 'RETURNED',
}
const booking: StaffUsageRow = {
  ...key, transactionId: 'booking:one', source: 'BOOKING', roomId: 'meeting', roomCode: 'M01',
  roomCategory: 'MEETING', userName: 'ผู้จอง', returnedAt: null, status: 'APPROVED',
}
const details = {
  transaction_id: key.transactionId, user_key: 'person-one', user_type: 'TEACHER',
  checked_out_at: key.startsAt,
}

it('uses Bangkok calendar days and only actual checkout and return for key hours', () => {
  expect(reportRange('week', new Date('2026-11-18T18:00:00Z'))).toEqual({ from: '2026-11-13', to: '2026-11-19' })
  expect(reportRange('previous', new Date('2026-01-01T00:00:00Z'))).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  const summary = summarizeReport([key], new Map([[key.transactionId, details]]), '2026-11-18', '2026-11-19')
  expect(summary.daily).toEqual([{ date: '2026-11-18', count: 0 }, { date: '2026-11-19', count: 1 }])
  expect(summary.hours).toBe(1.5)
  expect(summary.average).toBe(0.5)
  expect(summarizeReport([key], new Map(), '2026-11-19', '2026-11-19').hours).toBeNull()
})

it('filters by borrower, opens the daily table, and switches report sources', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(staffUsageQuery().queryKey, [key, booking])
  client.setQueryData(staffUsageReportDetailsQuery().queryKey, [details])
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/staff/reports?from=2026-11-18&to=2026-11-19']}>
      <StaffUsageReport />
    </MemoryRouter>
  </QueryClientProvider>)
  expect(screen.getByText('1.5 ชั่วโมง')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('ประเภทผู้เบิก'), { target: { value: 'STUDENT' } })
  expect(screen.getByText('0 ครั้ง')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('ประเภทผู้เบิก'), { target: { value: 'TEACHER' } })
  fireEvent.click(screen.getByRole('button', { name: 'ดูตารางรายวัน' }))
  expect(within(screen.getAllByRole('table')[0]).getByText('19 พ.ย.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'การจองห้องประชุม' }))
  expect(screen.getByText('2 ชั่วโมง')).toBeInTheDocument()
  expect(screen.getAllByText('M01').length).toBeGreaterThan(0)
})
