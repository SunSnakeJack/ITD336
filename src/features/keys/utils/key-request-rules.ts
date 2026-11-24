import { DEFAULT_ROOM_SLOT_POLICY, type RoomSlotPolicy } from '../../schedules/request-time-options'
import { bangkokDateKey, isSaturdayClosed } from '../../schedules/saturday-policy'

export interface KeyRequestRuleInput {
  email: string
  startsAt: string
  endsAt: string
  openSaturday?: string | null
  hours?: RoomSlotPolicy
}

export interface KeyRequestRuleErrors {
  email?: string
  date?: string
  time?: string
}

const UNIVERSITY_EMAIL = /^[^\s@]+@northbkk\.ac\.th$/i
const BANGKOK_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function bangkokParts(value: string) {
  const parts = BANGKOK_PARTS.formatToParts(new Date(value))
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function validateKeyRequest(input: KeyRequestRuleInput) {
  const errors: KeyRequestRuleErrors = {}
  if (!UNIVERSITY_EMAIL.test(input.email.trim())) {
    errors.email = 'กรุณาใช้อีเมลมหาวิทยาลัย @northbkk.ac.th'
  }

  if (!Number.isFinite(Date.parse(input.startsAt)) || !Number.isFinite(Date.parse(input.endsAt))) {
    errors.time = 'กรุณาเลือกเวลาเริ่มต้นและเวลาสิ้นสุด'
    return { valid: false, errors }
  }

  const start = bangkokParts(input.startsAt)
  const end = bangkokParts(input.endsAt)
  if (start.weekday === 'Sat' || end.weekday === 'Sat') {
    if ([input.startsAt, input.endsAt].some(value => isSaturdayClosed(bangkokDateKey(new Date(value)), input.openSaturday))) {
      errors.date = 'ไม่สามารถทำรายการสำหรับวันเสาร์ได้'
    }
  }

  const { opensAt, closesAt } = input.hours ?? DEFAULT_ROOM_SLOT_POLICY
  if (`${start.hour}:${start.minute}` < opensAt || `${end.hour}:${end.minute}` > closesAt) {
    errors.time = `กรุณาเลือกเวลาระหว่าง ${opensAt}–${closesAt} น.`
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
