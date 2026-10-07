import { supabase, unwrap } from '../../lib/supabase/client'
import type { AvailabilityConflict, Room } from './room.types'
export const getRooms = () => unwrap<Room[]>(supabase.from('rooms').select('*').order('name'))
export const getRoomById = (id:string) => unwrap<Room>(supabase.from('rooms').select('*').eq('id',id).single())
export const getAvailableRooms = (start:string,end:string) => unwrap<Room[]>(supabase.rpc('list_available_rooms',{p_starts_at:start,p_ends_at:end}))
export const checkRoomAvailability = (roomId:string,start:string,end:string) => unwrap<AvailabilityConflict[]>(supabase.rpc('check_room_availability',{p_room_id:roomId,p_starts_at:start,p_ends_at:end}))
