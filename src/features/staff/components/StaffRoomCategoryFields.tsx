import type { ReactNode } from 'react'
import { SelectField } from '../../../shared/components/SelectField'
import type { RoomCategoryPolicy, RoomPolicyCategory } from '../staff-settings.service'

const timeOptions = Array.from({ length: 1440 }, (_, minute) => {
  const value = [Math.floor(minute / 60), minute % 60].map(part => String(part).padStart(2, '0')).join(':')
  return { value, label: value }
})
const durationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return [hours ? `${hours} ชั่วโมง` : '', remainder ? `${remainder} นาที` : ''].filter(Boolean).join(' ')
}
const durationOptions = Array.from({ length: 48 }, (_, index) => {
  const minutes = (index + 1) * 30
  return { value: String(minutes), label: durationLabel(minutes) }
})
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
  const loginLabel = meeting ? 'เข้าสู่ระบบก่อนจองห้อง' : 'เข้าสู่ระบบก่อนเบิกกุญแจ'
  const days = policy.days ?? defaultDays
  const opens = policy.opensAt ?? '08:00'
  const closes = policy.closesAt ?? '18:00'
  const min = policy.minMinutes ?? 30
  const max = policy.maxMinutes ?? 600
  const unavailable = <span className="staff-category-policy-legacy">ยังใช้งานไม่ได้</span>
  const duration = (value: number, label: string, key: 'minMinutes' | 'maxMinutes', isInvalid: (minutes: number) => boolean) => {
    const options = durationOptions.some(option => Number(option.value) === value)
      ? durationOptions
      : [...durationOptions, { value: String(value), label: durationLabel(value) }].sort((a, b) => Number(a.value) - Number(b.value))
    return <SelectField label={label} value={String(value)} placeholder={label}
      disabled={disabled} options={options.map(option => ({ ...option, disabled: isInvalid(Number(option.value)) }))}
      onChange={minutes => onChange({ ...policy, minMinutes: min, maxMinutes: max, [key]: Number(minutes) })} />
  }

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
    <Row title="รูปแบบการอนุมัติ">{unavailable}</Row>
    <Row title="เวลาเปิด–ปิดบริการ">
      <SelectField label="เวลาเปิดบริการ" value={opens} placeholder="เลือกเวลาเปิด" disabled={disabled}
        options={timeOptions.map(option => ({ ...option, disabled: option.value >= closes }))}
        onChange={opensAt => onChange({ ...policy, opensAt, closesAt: closes })} />
      <SelectField label="เวลาปิดบริการ" value={closes} placeholder="เลือกเวลาปิด" disabled={disabled}
        options={timeOptions.map(option => ({ ...option, disabled: option.value <= opens }))}
        onChange={closesAt => onChange({ ...policy, opensAt: opens, closesAt })} />
    </Row>
    <Row title="เส้นตายอนุมัติ">{unavailable}</Row>
    <Row title="ระยะเวลาขั้นต่ำ–สูงสุด">
      {duration(min, 'ระยะเวลาขั้นต่ำ', 'minMinutes', minutes => minutes > max)}
      {duration(max, 'ระยะเวลาสูงสุด', 'maxMinutes', minutes => minutes < min)}
    </Row>
    <Row title="ระบุเหตุผลเมื่อไม่อนุมัติ">{unavailable}</Row>
    <Row title="เวลาแก้ไขหรือยกเลิก">{unavailable}</Row>
    <Row title="จองล่วงหน้าสูงสุด (วัน)">
      <input aria-label="จองล่วงหน้าสูงสุด (วัน)" type="number" min={0} max={30}
        value={policy.advanceDays ?? advanceDays} onChange={event => {
          const value = event.target.valueAsNumber
          if (Number.isInteger(value) && value >= 0 && value <= 30) onChange({ ...policy, advanceDays: value })
        }} />
    </Row>
    <Row title="เจ้าหน้าที่แก้ไขแทน">{unavailable}</Row>
    <Row title="ผู้ยืนยันรับคืนกุญแจ">{unavailable}</Row>
  </fieldset>
}
