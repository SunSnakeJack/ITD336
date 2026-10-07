import { queryOptions } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase/client'
import type { Notification } from './notification.types'
export const notificationKeys={mine:['notifications','mine'] as const,unread:['notifications','unread'] as const}
export const getMyNotifications=()=>unwrap<Notification[]>(supabase.from('notifications').select('*').order('created_at',{ascending:false}))
export const getUnreadNotifications=()=>unwrap<Notification[]>(supabase.from('notifications').select('*').is('read_at',null).order('created_at',{ascending:false}))
export const markNotificationRead=(id:string)=>unwrap<null>(supabase.rpc('mark_notification_read',{p_notification_id:id}))
export const myNotificationsQuery=()=>queryOptions({queryKey:notificationKeys.mine,queryFn:getMyNotifications})
