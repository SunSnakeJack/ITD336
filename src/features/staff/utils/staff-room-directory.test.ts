import { describe, expect, it } from 'vitest'
import type { Room } from '../../rooms/room.types'
import { filterAndSortRooms, roomCategory } from './staff-analytics'

const room=(code:string,capacity:number,active=true,type='LAB'):Room=>({id:code,code,name:code,room_type_id:type,building:null,floor:null,location_description:null,capacity,description:null,booking_enabled:true,active,created_at:'',updated_at:''})

describe('staff room directory',()=>{
  it('classifies public room groups',()=>{
    expect(roomCategory(room('MEETING-ROOM',20),'ห้องประชุม')).toBe('meeting')
    expect(roomCategory(room('STUDIO',20),'ห้องปฏิบัติการพิเศษ')).toBe('special')
    expect(roomCategory(room('S2407',60),'ห้องปฏิบัติการ')).toBe('general')
  })
  it('combines category filters and capacity sorting',()=>{
    const rows=[room('S2408',40),room('S2407',60),room('MEETING-ROOM',20,true,'MEETING')]
    expect(filterAndSortRooms(rows,{search:'',status:'all',category:'general',sort:'capacity',typeLabel:(item)=>item.room_type_id==='MEETING'?'ห้องประชุม':'ห้องปฏิบัติการ'}).map(item=>item.code)).toEqual(['S2408','S2407'])
  })
})
