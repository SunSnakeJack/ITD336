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
    const client=new QueryClient()
    client.setQueryData(['notifications','mine'],[{id:'read-1',user_id:'user-1',type:'KEY_RETURNED',title:'Returned',message:'คืนแล้ว',related_entity_type:null,related_entity_id:null,read_at:'2026-11-12T10:00:00Z',created_at:'2026-11-12T09:00:00Z'}])
    client.setQueryData(['notifications','unread'],[])
    render(<QueryClientProvider client={client}><NotificationBell/></QueryClientProvider>)
    expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/การแจ้งเตือนที่ยังไม่อ่าน 0/}))
    expect(screen.getByText('บันทึกการคืนกุญแจแล้ว')).toBeInTheDocument()
    expect(screen.getByText('คืนแล้ว')).toBeInTheDocument()
  })
})
