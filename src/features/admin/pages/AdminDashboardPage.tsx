import { useQuery } from '@tanstack/react-query'
import { academicSchedulesQuery, roomsQuery } from '../../schedules/schedule.queries'

export function AdminDashboardPage() {
  const rooms = useQuery(roomsQuery())
  const schedules = useQuery(academicSchedulesQuery())
  return <section className="content-page"><div className="page-heading"><div><span>ADMIN CONSOLE</span><h1>ภาพรวมระบบ</h1><p>ข้อมูลห้องและตารางเรียนจาก Supabase</p></div></div>
    <div className="stat-grid"><article><small>ห้องทั้งหมด</small><strong>{rooms.data?.length ?? '—'}</strong></article><article><small>เปิดใช้งาน</small><strong>{rooms.data?.filter((room) => room.active).length ?? '—'}</strong></article><article><small>ตารางเรียนที่ใช้งาน</small><strong>{schedules.data?.filter((item) => item.active).length ?? '—'}</strong></article></div>
  </section>
}
