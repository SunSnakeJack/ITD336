import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { NotificationBell } from './NotificationBell'

vi.mock('../notification.queries',()=>({
  notificationKeys:{all:['notifications'],mine:['notifications','mine'],unread:['notifications','unread']},
  myNotificationsQuery:()=>({queryKey:['notifications','mine'],queryFn:vi.fn()}),
  unreadNotificationsQuery:()=>({queryKey:['notifications','unread'],queryFn:vi.fn()}),
  markNotificationRead:vi.fn(),markAllNotificationsRead:vi.fn(),
}))

describe('NotificationBell',()=>{
  it('keeps read history visible and shows the dot only for unread items',()=>{
    const client=new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    client.setQueryData(['notifications','mine'],[{id:'read-1',user_id:'user-1',type:'KEY_RETURNED',title:'Returned',message:'คืนแล้ว',related_entity_type:null,related_entity_id:null,read_at:'2026-11-12T10:00:00Z',created_at:'2026-11-12T09:00:00Z'}])
    client.setQueryData(['notifications','unread'],[])
    render(<QueryClientProvider client={client}><NotificationBell/></QueryClientProvider>)
    expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/การแจ้งเตือนที่ยังไม่อ่าน 0/}))
    expect(screen.getByText('บันทึกการคืนกุญแจแล้ว')).toBeInTheDocument()
    expect(screen.getByText('คืนแล้ว')).toBeInTheDocument()
    expect(screen.getByText('คืนแล้ว').closest('.notification-list')).toContainElement(screen.getByText('บันทึกการคืนกุญแจแล้ว'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /การแจ้งเตือนที่ยังไม่อ่าน 0/ })).toHaveFocus()
  })

  it('shows the unread count and labels only unread cards as new', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    const unread = { id: 'unread-1', type: 'KEY_REQUEST_SUBMITTED', message: 'คำขอใหม่', read_at: null, created_at: '2026-11-12T09:00:00Z' }
    const read = { ...unread, id: 'read-1', message: 'คำขอเดิม', read_at: '2026-11-12T10:00:00Z' }
    client.setQueryData(['notifications', 'mine'], [unread, read])
    client.setQueryData(['notifications', 'unread'], [unread])
    render(<QueryClientProvider client={client}><NotificationBell /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'การแจ้งเตือนที่ยังไม่อ่าน 1 รายการ' }))
    expect(screen.getByText('1 รายการที่ยังไม่อ่าน')).toBeInTheDocument()
    expect(screen.getByText('ใหม่').closest('button')).toHaveTextContent('คำขอใหม่')
    expect(screen.getByText('คำขอเดิม').closest('button')).not.toHaveTextContent('ใหม่')
    expect(screen.getByRole('button', { name: 'อ่านทั้งหมด' })).toBeInTheDocument()
  })
})
