import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import { keyLoanKeys } from '../../features/keys/key.queries'
import { scheduleKeys } from '../../features/schedules/schedule.queries'
import { notificationKeys } from '../../features/notifications/notification.queries'

export function useRealtimeInvalidation(enabled:boolean){
  const client=useQueryClient()
  useEffect(()=>{
    if(!enabled||typeof supabase.channel!=='function')return
    const refreshBookings=()=>{void client.invalidateQueries({queryKey:['bookings']});void client.invalidateQueries({queryKey:keyLoanKeys.all});void client.invalidateQueries({queryKey:scheduleKeys.all})}
    const refreshRooms=()=>{void client.invalidateQueries({queryKey:scheduleKeys.all})}
    const channel=supabase.channel('itd336-live-state')
      .on('postgres_changes',{event:'*',schema:'public',table:'bookings'},refreshBookings)
      .on('postgres_changes',{event:'*',schema:'public',table:'key_loans'},refreshBookings)
      .on('postgres_changes',{event:'*',schema:'public',table:'key_incidents'},()=>void client.invalidateQueries({queryKey:keyLoanKeys.all}))
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>void client.invalidateQueries({queryKey:notificationKeys.all}))
      .on('postgres_changes',{event:'*',schema:'public',table:'rooms'},refreshRooms)
      .on('postgres_changes',{event:'*',schema:'public',table:'class_schedules'},refreshRooms)
      .subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[client,enabled])
}
