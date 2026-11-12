import { queryOptions } from '@tanstack/react-query'
import { getAdminRoomDetail, getAdminRoomEditorOptions, getAvailableRooms, getRoomById, getRooms } from './room.service'
export const roomKeys = { all:['rooms'] as const, detail:(id:string)=>['rooms','detail',id] as const, availability:(start:string,end:string)=>['rooms','availability',start,end] as const }
export const roomsQuery = () => queryOptions({queryKey:roomKeys.all,queryFn:getRooms})
export const roomQuery = (id:string) => queryOptions({queryKey:roomKeys.detail(id),queryFn:()=>getRoomById(id)})
export const availableRoomsQuery = (start:string,end:string) => queryOptions({queryKey:roomKeys.availability(start,end),queryFn:()=>getAvailableRooms(start,end),enabled:Boolean(start&&end)})
export const adminRoomDetailQuery=(id:string)=>queryOptions({queryKey:[...roomKeys.detail(id),'admin'],queryFn:()=>getAdminRoomDetail(id),enabled:Boolean(id)})
export const roomEditorOptionsQuery=()=>queryOptions({queryKey:[...roomKeys.all,'editor-options'],queryFn:getAdminRoomEditorOptions,staleTime:5*60_000})
