import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { supabase } from '../../../lib/supabase/client'
import { StaffRoleSettingsPage } from './StaffRoleSettingsPage'

vi.mock('../../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

it('paginates and filters the compact list and edits both display names without changing the system role code', async () => {
  const roles = [
    { code: 'ADMIN', name: 'Administrator', name_th: 'ผู้ดูแลระบบ', locked: true },
    ...Array.from({ length: 5 }, (_, index) => ({ code: 'ROLE_' + index, name: 'Role ' + index, name_th: null, locked: false })),
  ]
  vi.mocked(supabase.rpc).mockImplementation((async (rpc: string, args?: { p_name: string; p_name_th: string }) => {
    if (rpc === 'manage_admin_role_label_v2' && args) {
      roles[0].name = args.p_name
      roles[0].name_th = args.p_name_th
      return { data: null, error: null }
    }
    return { data: roles.map(role => ({ ...role })), error: null }
  }) as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><StaffRoleSettingsPage /></QueryClientProvider>)
  expect(await screen.findByText('หน้า 1 จาก 2')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
  expect(screen.getByText('Role 4')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ผู้ดูแล' } })
  expect(screen.queryByText('Role 4')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ลบ Administrator' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'แก้ไข Administrator' }))
  const editor = within(screen.getByRole('dialog', { name: 'แก้ไขบทบาท' }))
  expect(editor.getByLabelText('รหัสบทบาท')).toHaveAttribute('readonly')
  fireEvent.change(editor.getByLabelText('ชื่อภาษาอังกฤษ'), { target: { value: 'System Administrator' } })
  fireEvent.change(editor.getByLabelText('ชื่อภาษาไทย'), { target: { value: 'ผู้ดูแลระบบหลัก' } })
  fireEvent.click(editor.getByRole('button', { name: 'บันทึก' }))
  expect(await screen.findByText('ผู้ดูแลระบบหลัก')).toBeInTheDocument()
  expect(supabase.rpc).toHaveBeenCalledWith('manage_admin_role_label_v2', {
    p_operation: 'RENAME', p_code: 'ADMIN', p_name: 'System Administrator', p_name_th: 'ผู้ดูแลระบบหลัก',
  })
})
