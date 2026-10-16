import type { AdminKeyLoan, KeyCabinetRoom } from '../key.types'

export const keyCabinetLabels: Record<KeyCabinetRoom['keyStatus'], string> = {
  AVAILABLE: 'กุญแจพร้อมใช้งาน',
  CHECKED_OUT: 'มีผู้ถือกุญแจ',
  OVERDUE: 'เกินกำหนดคืนกุญแจ',
  ROOM_CLOSED: 'ห้องปิดใช้งาน',
}

export function getBorrowerIdentity(loan: Pick<AdminKeyLoan, 'borrower_id' | 'borrowerName' | 'borrowerUniversityId' | 'borrowerEmail'>) {
  return {
    name: loan.borrowerName?.trim() || loan.borrowerEmail?.trim() || 'ไม่ระบุชื่อผู้ยืม',
    identifier: loan.borrowerUniversityId?.trim() || `รหัสระบบ ${loan.borrower_id.slice(0, 8)}…`,
  }
}
