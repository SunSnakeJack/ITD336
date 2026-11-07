export interface KeyRequestRuleInput {
  email: string
  startsAt: string
  endsAt: string
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

  const start = bangkokParts(input.startsAt)
  const end = bangkokParts(input.endsAt)
  if (start.weekday === 'Sat' || end.weekday === 'Sat') {
    errors.date = 'ไม่สามารถทำรายการสำหรับวันเสาร์ได้'
  }

  const startMinutes = Number(start.hour) * 60 + Number(start.minute)
  const endMinutes = Number(end.hour) * 60 + Number(end.minute)
  if (startMinutes < 8 * 60 || endMinutes > 18 * 60) {
    errors.time = 'กรุณาเลือกเวลาระหว่าง 08:00–18:00 น.'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
