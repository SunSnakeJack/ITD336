import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import fs from 'node:fs'
import path from 'node:path'
import { PublicLayout } from './public/components/PublicLayout'
import { WeeklySchedule } from './schedules/components/WeeklySchedule'

describe('Responsive Layout Contracts', () => {
  it('does not apply overflow-x: hidden to html, body, or #root in styles.css', () => {
    const cssPath = path.resolve(__dirname, '../styles.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    // Root-cause fix check: Ensure body/html overflow is not hidden as a band-aid
    expect(css).not.toMatch(/html\s*,\s*body[^{]*\{[^}]*overflow-x:\s*hidden/i)
    expect(css).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/i)
    expect(css).not.toMatch(/#root[^{]*\{[^}]*overflow-x:\s*hidden/i)
  })

  it('contains proper self-contained overflow-x: auto containers for wide components', () => {
    const cssPath = path.resolve(__dirname, '../styles.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    expect(css).toMatch(/\.data-table[^{]*\{[^}]*overflow-x:\s*auto/i)
    expect(css).toMatch(/\.weekly-grid[^{]*\{[^}]*overflow-x:\s*auto/i)
    expect(css).toMatch(/\.floor-map-panel[^{]*\{[^}]*overflow-x:\s*auto/i)
    expect(css).toMatch(/\.permission-matrix-wrap[^{]*\{[^}]*overflow-x:\s*auto/i)
  })

  it('uses the key-mode public shell without the retired sidebar', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { container: defaultContainer } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <PublicLayout identity={null} loading={false} onLogout={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const defaultShell = defaultContainer.querySelector('.public-shell')
    expect(defaultShell).not.toBeNull()
    expect(defaultShell?.classList.contains('key-mode')).toBe(true)
    expect(defaultContainer.querySelector('.public-sidebar')).toBeNull()

    const { container: keyContainer } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/keys']}>
          <PublicLayout identity={null} loading={false} onLogout={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const keyShell = keyContainer.querySelector('.public-shell')
    expect(keyShell).not.toBeNull()
    expect(keyShell?.classList.contains('key-mode')).toBe(true)
    expect(keyContainer.querySelector('.public-sidebar')).toBeNull()
  })

  it('renders WeeklySchedule within a responsive availability-table-wrap container across various viewport sizes', () => {
    const viewports = [320, 375, 390, 430, 768, 1024, 1440]
    const testDate = new Date('2026-11-08T00:00:00+07:00')

    for (const width of viewports) {
      window.innerWidth = width
      const { container } = render(
        <WeeklySchedule
          rangeStart={testDate}
          events={[]}
        />
      )

      const wrap = container.querySelector('.availability-table-wrap')
      expect(wrap).not.toBeNull()
      const table = container.querySelector('.availability-table')
      expect(table).not.toBeNull()
    }
  })
})
