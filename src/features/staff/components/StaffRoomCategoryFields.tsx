import { DEFAULT_SLOT_MINUTES } from '../../schedules/request-time-options'
import type { ReactNode } from 'react'
import { SelectField } from '../../../shared/components/SelectField'
import type { RoomCategoryPolicy, RoomPolicyCategory } from '../staff-settings.service'

const defaultDays = [0, 1, 2, 3, 4, 5]
const weekdays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function Row({ title, children }: { title: string; children: ReactNode }) {
  return <div className="staff-category-rule"><span>{title}</span><div>{children}</div></div>
}

export function StaffRoomCategoryFields({ policy, category, advanceDays, onChange, disabled }: {
  policy: RoomCategoryPolicy; category: RoomPolicyCategory; advanceDays: number
  onChange: (policy: RoomCategoryPolicy) => void; disabled: boolean
}) {
  const meeting = category === 'MEETING'
  const approvalMode = policy.approvalMode ?? (category === 'SPECIAL' ? 'MANUAL' : 'AUTO')
  const loginLabel = meeting ? 'เข้าสู่ระบบก่อนจองห้อง' : 'เข้าสู่ระบบก่อนเบิกกุญแจ'
  const days = policy.days ?? defaultDays
  const opens = policy.opensAt ?? '08:00'
  const closes = policy.closesAt ?? '18:00'

  return <fieldset className="staff-category-policy-columns" disabled={disabled}>
    <Row title={loginLabel}>
      <label className="staff-setting-switch"><input type="checkbox" role="switch" aria-label={loginLabel}
        checked={meeting || category === 'SPECIAL' || policy.loginForKey === true}
        disabled={meeting || category === 'SPECIAL'}
        onChange={event => onChange({ ...policy, loginForKey: event.target.checked ? true : undefined })} /><span aria-hidden="true" /></label>
    </Row>
    <Row title="วันให้บริการ">
      <div className="staff-category-days">{[1, 2, 3, 4, 5, 6, 0].map(day =>
        <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => onChange({
          ...policy, days: days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort(),
        })}>{weekdays[day]}</button>)}</div>
    </Row>
    <Row title="รูปแบบการอนุมัติ">
      <SelectField label="รูปแบบการอนุมัติ" value={approvalMode} placeholder="เลือกรูปแบบการอนุมัติ" disabled={disabled}
        options={[{ value: 'AUTO', label: 'อนุมัติอัตโนมัติ' }, { value: 'MANUAL', label: 'รอผู้ดูแลระบบอนุมัติ' }]}
        onChange={approvalMode => onChange({ ...policy, approvalMode })} />
    </Row>
    <Row title="เวลาเปิด–ปิดบริการ">
      <input type="time" aria-label="เวลาเปิดบริการ" value={opens}
        onChange={event => onChange({ ...policy, opensAt: event.target.value, closesAt: closes })} />
      <input type="time" aria-label="เวลาปิดบริการ" value={closes}
        onChange={event => onChange({ ...policy, opensAt: opens, closesAt: event.target.value })} />
    </Row>
    <Row title="เส้นตายอนุมัติ">
      <div className="staff-approval-deadline" data-inactive={approvalMode === 'AUTO'}>
        <SelectField label="เส้นตายอนุมัติ" value={policy.approvalDeadline ?? 'END'} placeholder="เลือกเส้นตายอนุมัติ"
          disabled={disabled || approvalMode === 'AUTO'}
          options={[{ value: 'START', label: 'ก่อนเวลาเริ่มใช้งาน' }, { value: 'END', label: 'ก่อนเวลาสิ้นสุดการใช้งาน' }]}
          onChange={approvalDeadline => onChange({ ...policy, approvalDeadline })} />
        {approvalMode === 'AUTO' && <small>ใช้เมื่อรอผู้ดูแลระบบอนุมัติ</small>}
      </div>
    </Row>
    <Row title="ระยะเวลาต่อช่วง (นาที)">
      <input aria-label="ระยะเวลาต่อช่วง (นาที)" type="number" min={1} max={1440}
        value={policy.slotMinutes ?? DEFAULT_SLOT_MINUTES} onChange={event => {
          const slotMinutes = event.target.valueAsNumber
          onChange({ ...policy, slotMinutes: Number.isNaN(slotMinutes) ? undefined : slotMinutes })
        }} />
    </Row>
    <Row title="ระบุเหตุผลเมื่อไม่อนุมัติ">
      <label className="staff-setting-switch"><input type="checkbox" role="switch" aria-label="ระบุเหตุผลเมื่อไม่อนุมัติ"
        checked={policy.requireRejectionReason ?? true}
        onChange={event => onChange({ ...policy, requireRejectionReason: event.target.checked })} /><span aria-hidden="true" /></label>
    </Row>
    <Row title="จองล่วงหน้าสูงสุด (วัน)">
      <input aria-label="จองล่วงหน้าสูงสุด (วัน)" type="number" min={0} max={30}
        value={policy.advanceDays ?? advanceDays} onChange={event => {
          const value = event.target.valueAsNumber
          if (Number.isInteger(value) && value >= 0 && value <= 30) onChange({ ...policy, advanceDays: value })
        }} />
    </Row>
  </fieldset>
}
