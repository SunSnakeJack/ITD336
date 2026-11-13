export type StaffUserTone = 'blue' | 'teal' | 'amber' | 'purple' | 'red' | 'slate'

const tones: StaffUserTone[] = ['blue', 'teal', 'amber', 'purple', 'red', 'slate']

export function getUserTone(seed: string): StaffUserTone {
  const hash = [...seed].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0)
  return tones[hash % tones.length]
}

export function getRoleTone(code: string): StaffUserTone {
  const roleTones: Record<string, StaffUserTone> = {
    ADMIN: 'blue', ADMINISTRATOR: 'blue', STAFF: 'teal', STUDENT: 'amber',
    TEACHER: 'purple', PRIORITY_USER: 'red',
  }
  return roleTones[code] ?? 'slate'
}
