export type RoomMapItem =
  | { kind: 'room'; code: string; label: string; detail?: string; className: string }
  | { kind: 'reference'; label: string; detail?: string; className: string }

export const ROOM_MAP_ITEMS: RoomMapItem[] = [
  { kind: 'reference', label: 'ห้องคณะ ITD', detail: 'ห้องทำงานอาจารย์ · ห้องระบบ', className: 'faculty-area' },
  { kind: 'room', code: 'MEET-FACULTY', label: 'ห้องประชุมคณะ', className: 'meeting-room' },
  { kind: 'room', code: 'STUDIO', label: 'Studio', detail: 'ชั้น 4.5 · ใกล้บันได', className: 'studio-room' },
  { kind: 'reference', label: 'บันได', className: 'stairs-west' },
  { kind: 'room', code: 'ESPORT', label: 'E-sport', detail: 'ชั้น 3.5', className: 'esport-room' },
  { kind: 'room', code: 'ELEARNING', label: 'E-learning', detail: 'ชั้น 4', className: 'elearning-room' },
  ...Array.from({ length: 6 }, (_, index) => ({ kind: 'room' as const, code: `${2401 + index}`, label: `ห้องเรียน ${2401 + index}`, className: `classroom-${2401 + index}` })),
  { kind: 'reference', label: 'ทางเดิน', detail: '←          →', className: 'corridor' },
  { kind: 'reference', label: 'ลิฟต์', detail: '⇅', className: 'lift-one' },
  { kind: 'reference', label: 'ลิฟต์', detail: '⇅', className: 'lift-two' },
  ...Array.from({ length: 6 }, (_, index) => ({ kind: 'room' as const, code: `S${2412 - index}`, label: `S${2412 - index}`, detail: 'ห้องปฏิบัติการ', className: `lab-${2412 - index}` })),
]
