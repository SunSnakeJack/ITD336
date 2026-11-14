const formats = {
  CLASSROOM: 'ห้องเรียน',
  COLD: 'ห้องควบคุมอุณหภูมิ',
  COMPUTER: 'ห้องปฏิบัติการคอมพิวเตอร์',
  ELEARNING: 'ห้องอีเลิร์นนิง',
  GAMING: 'ห้องอีสปอร์ต',
  MEETING: 'ห้องประชุม',
  STUDIO: 'ห้องสตูดิโอ',
} as const

export function roomFormatCode(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/_ROOM$/, '').replace(/^E_LEARNING$/, 'ELEARNING')
}

export function thaiRoomType(codeOrName: string) {
  const code = roomFormatCode(codeOrName)
  return (formats as Record<string, string>)[code] ?? codeOrName
}

export function roomFormatGroup(value: string) {
  const code = Object.entries(formats).find(([, label]) => label === value)?.[0] ?? roomFormatCode(value)
  if (code === 'MEETING') return 'meeting'
  if (['ELEARNING', 'GAMING', 'STUDIO'].includes(code)) return 'special'
  if (Object.hasOwn(formats, code)) return 'general'
}

export const roomGroupLabels = { general: 'ห้องทั่วไป', special: 'ห้องพิเศษ', meeting: 'ห้องประชุม' }
