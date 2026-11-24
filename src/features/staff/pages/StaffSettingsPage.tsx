import { roomSlotTimes } from '../../schedules/request-time-options'
import { useState } from 'react'
import { keyServiceDaysQueryKey } from '../../keys/key-service-days.queries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase/client'
import { guestGeneralKey, viewerPermissionsKey } from '../../auth/viewer-permissions.queries'
import { StaffServicePermissionMatrix } from '../components/StaffServicePermissionMatrix'
import { defaultServiceGrant, serviceRoles, servicePermissionRows } from '../staff-service-permissions'
import { meetingBookingPolicyKey } from '../../meeting-rooms/meeting-booking-policy'
import { bangkokDateKey, isSaturday } from '../../schedules/saturday-policy'
import { saturdayPolicyQuery } from '../../schedules/saturday-policy.queries'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { keyLoanKeys } from '../../keys/key.queries'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import { keyRequestTimingSettingQuery, meetingAdvanceBookingDaysQuery } from '../staff-settings.queries'
import { getRoomCategoryPolicies, roomRejectionReasonQueryKey, savePermissionSettings, type PermissionChanges, type RoomPolicyCategory } from '../staff-settings.service'
import { StaffRoomCategoryFields } from '../components/StaffRoomCategoryFields'
import { useStaffViewState } from '../useStaffViewState'
import './StaffSettingsPage.css'

const categories = { LAB: 'ห้องปฎิบัติการ', SPECIAL: 'ห้องปฏิบัติการพิเศษ', MEETING: 'ห้องประชุม' } as const
const roleCatalogKey = ['staff', 'role-permission-catalog'] as const
const categoryPoliciesKey = ['staff', 'settings', 'room-category-restrictions'] as const

export function StaffSettingsPage() {
  const [category, setCategory] = useState<RoomPolicyCategory>('LAB')
  const [matrixOpen, setMatrixOpen] = useState(true)
  const [{ changes, saturdayEnabled }, updateView] = useStaffViewState<{
    changes: PermissionChanges; saturdayEnabled?: boolean
  }>('permissions', { changes: {} })
  const client = useQueryClient()
  const catalog = useQuery({
    queryKey: roleCatalogKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('roles')
        .select('code, role_permissions(permissions(code))').in('code', serviceRoles)
      if (error) throw new Error('ไม่สามารถโหลดตารางสิทธิ์ได้', { cause: error })
      return data ?? []
    },
  })
  const guestGeneral = useQuery({ queryKey: guestGeneralKey, queryFn: async () => {
    const { data, error } = await supabase.rpc('get_guest_general_key_enabled' as never)
    if (error || typeof data !== 'boolean') throw new Error('ไม่สามารถโหลดสิทธิ์ผู้เยี่ยมชมได้')
    return data as boolean
  } })
  const timing = useQuery(keyRequestTimingSettingQuery())
  const advance = useQuery(meetingAdvanceBookingDaysQuery())
  const saturday = useQuery(saturdayPolicyQuery())
  const categoryPolicies = useQuery({ queryKey: categoryPoliciesKey, queryFn: getRoomCategoryPolicies })
  const policy = changes.roomPolicies?.[category] ?? categoryPolicies.data?.[category] ?? {}
  const enabled = saturdayEnabled ?? Boolean(saturday.data)
  const date = changes.openSaturday === undefined ? saturday.data ?? '' : changes.openSaturday ?? ''
  const today = bangkokDateKey()
  const invalidSaturday = enabled && (!date || date < today || !isSaturday(date))
  const roleGrants = new Map(catalog.data?.map(role => [
    role.code, new Set(role.role_permissions.map(grant => grant.permissions?.code)),
  ]))
  const pendingChanges: PermissionChanges = {}
  if (changes.guestGeneralKey !== undefined && changes.guestGeneralKey !== guestGeneral.data) pendingChanges.guestGeneralKey = changes.guestGeneralKey
  const visibleGrants = changes.roleGrants?.filter(change => servicePermissionRows.some(([permission]) => permission === change.permission))
  if (visibleGrants?.length) pendingChanges.roleGrants = visibleGrants
  if (changes.roomPolicies && Object.keys(changes.roomPolicies).length) pendingChanges.roomPolicies = changes.roomPolicies
  if (changes.meetingAdvanceDays !== undefined && changes.meetingAdvanceDays !== advance.data) pendingChanges.meetingAdvanceDays = changes.meetingAdvanceDays
  if (changes.allowElapsed !== undefined && changes.allowElapsed !== timing.data) pendingChanges.allowElapsed = changes.allowElapsed
  if ((saturdayEnabled !== undefined || changes.openSaturday !== undefined) && (enabled ? date : null) !== saturday.data) pendingChanges.openSaturday = enabled ? date : null
  const invalidRoomPolicy = Object.values(pendingChanges.roomPolicies ?? {}).some(policy =>
    roomSlotTimes({ opensAt: policy.opensAt ?? '08:00', closesAt: policy.closesAt ?? '18:00', slotMinutes: policy.slotMinutes }).length === 0,
  )
  const save = useMutation({
    mutationFn: savePermissionSettings,
    onSuccess: async () => {
      updateView({ changes: {}, saturdayEnabled: undefined })
      await Promise.all([roleCatalogKey, categoryPoliciesKey, keyRequestTimingSettingQuery().queryKey,
        meetingAdvanceBookingDaysQuery().queryKey, saturdayPolicyQuery().queryKey,
        meetingBookingPolicyKey, keyLoanKeys.all, keyServiceDaysQueryKey, roomRejectionReasonQueryKey,
        scheduleKeys.publicRooms(), guestGeneralKey, viewerPermissionsKey].map(queryKey => client.invalidateQueries({ queryKey })))
    },
  })
  const patch = (values: PermissionChanges) => {
    save.reset()
    updateView({ changes: { ...changes, ...values } })
  }
  const toggleGrant = (role: string, permission: string, enabled: boolean) => {
    const edits = (changes.roleGrants ?? []).filter(change => change.role !== role || change.permission !== permission)
    if (enabled !== Boolean(roleGrants.get(role)?.has(permission))) edits.push({ role, permission, enabled })
    patch({ roleGrants: edits })
  }
  const resetPermissions = () => patch({
    guestGeneralKey: true,
    roleGrants: serviceRoles.filter(role => role !== 'ADMIN' && roleGrants.has(role))
      .flatMap(role => servicePermissionRows.flatMap(([permission]) => {
        const enabled = defaultServiceGrant(role, permission)
        return enabled === Boolean(roleGrants.get(role)?.has(permission)) ? [] : [{ role, permission, enabled }]
      })),
  })
  const loading = guestGeneral.isPending || catalog.isPending || timing.isPending || advance.isPending || saturday.isPending || categoryPolicies.isPending
  const error = guestGeneral.error || catalog.error || timing.error || advance.error || saturday.error || categoryPolicies.error
  const dirty = Object.keys(pendingChanges).length > 0

  return <StaffPage eyebrow="" title="การตั้งค่าสิทธิ์" description="กำหนดสิทธิ์ตามบทบาทและเงื่อนไขการใช้งานห้อง"
    actions={<button className="staff-button" type="button" disabled={loading || Boolean(error) || invalidSaturday || invalidRoomPolicy || !dirty || save.isPending}
      onClick={() => save.mutate(pendingChanges)}>{save.isPending ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}</button>}>
    {invalidRoomPolicy && <p className="panel-error" role="alert">กรุณาระบุเวลาเปิดก่อนเวลาปิด และกำหนดระยะเวลาต่อช่วงที่พอดีกับเวลาให้บริการ</p>}
    {save.error && <p className="panel-error" role="alert">{save.error.message}</p>}
    {save.isSuccess && <p role="status">บันทึกการตั้งค่าแล้ว</p>}
    <StaffQueryState loading={loading} error={error}>
      <div className="staff-permission-sections">
        <section className="staff-settings-section">
          <h3>ตั้งค่าสิทธิ์ตามบทบาท</h3>
          <div className="staff-settings-row">
            <Link to="/staff/users">ดูบทบาทรายบัญชี</Link>
            <button type="button" className="staff-button secondary" aria-expanded={matrixOpen} onClick={() => setMatrixOpen(!matrixOpen)}>
              {matrixOpen ? 'ซ่อนตาราง' : 'ดูตาราง'}
            </button>
          </div>
          {matrixOpen && <StaffServicePermissionMatrix roles={new Set(roleGrants.keys())}
            checked={(role, code) => changes.roleGrants?.find(change => change.role === role && change.permission === code)?.enabled
              ?? Boolean(roleGrants.get(role)?.has(code))}
            guestEnabled={changes.guestGeneralKey ?? guestGeneral.data ?? false} disabled={save.isPending}
            toggle={toggleGrant} toggleGuest={guestGeneralKey => patch({ guestGeneralKey })} reset={resetPermissions} />}
        </section>
        <section className="staff-settings-section">
          <h3>ตั้งค่าสิทธิ์ตามประเภทห้อง</h3>
          <div className="staff-settings-tabs" role="group" aria-label="ประเภทห้อง">
            {(Object.keys(categories) as RoomPolicyCategory[]).map(value => <button key={value} type="button" aria-pressed={category === value}
              onClick={() => setCategory(value)}>{categories[value]}</button>)}
          </div>
          <StaffRoomCategoryFields policy={policy} category={category} advanceDays={category === 'MEETING' ? advance.data ?? 0 : 0}
            disabled={save.isPending}
            onChange={policy => patch({
              roomPolicies: { ...changes.roomPolicies, [category]: policy },
              ...(category === 'MEETING' && policy.advanceDays !== undefined && policy.advanceDays > 0
                ? { meetingAdvanceDays: policy.advanceDays }
                : {}),
            })} />
          <h4 className="staff-category-global-heading">ค่ากลางของระบบ</h4>
          <fieldset className="staff-settings-fields" disabled={save.isPending}>
            <label><span>อนุญาตให้เบิกกุญแจในช่วงเวลาที่ผ่านมา <small>ค่ากลางของระบบ</small></span>
              <span className="staff-setting-switch"><input type="checkbox" role="switch" checked={changes.allowElapsed ?? timing.data ?? false} onChange={event => patch({ allowElapsed: event.target.checked })} /><span aria-hidden="true" /></span>
            </label>
            <label><span>เปิดให้จองวันเสาร์ชั่วคราว <small>ค่ากลางของระบบ</small></span>
              <span className="staff-setting-switch"><input type="checkbox" role="switch" checked={enabled} onChange={event => { save.reset(); updateView({ saturdayEnabled: event.target.checked }) }} /><span aria-hidden="true" /></span>
            </label>
            {enabled && <label>วันเสาร์ที่เปิด <input type="date" min={today} value={date} onChange={event => patch({ openSaturday: event.target.value })} /></label>}
          </fieldset>
          {invalidSaturday && <p className="panel-error" role="alert">กรุณาเลือกวันเสาร์ตั้งแต่วันนี้เป็นต้นไป</p>}
        </section>
      </div>
    </StaffQueryState>
  </StaffPage>
}
