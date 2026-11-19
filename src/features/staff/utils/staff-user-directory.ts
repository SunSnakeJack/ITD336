import type { StaffUserDirectoryItem } from '../types/staff-user.types'

export interface UserDirectoryFilters { search: string; role: string; status: string }

export function getStaffInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('th') || 'U'
}

export function filterUserDirectory(users: StaffUserDirectoryItem[], filters: UserDirectoryFilters) {
  const search = filters.search.trim().toLocaleLowerCase('th')
  return users.filter((user) => {
    const matchesSearch = !search || `${user.fullName} ${user.email}`.toLocaleLowerCase('th').includes(search)
    return matchesSearch
      && (filters.role === 'ALL' || user.roleCodes.includes(filters.role))
      && (filters.status === 'ALL' || (user.pendingRegistration ? 'PENDING_REGISTRATION' : user.accountStatus) === filters.status)
  })
}

export function userDirectoryStats(users: StaffUserDirectoryItem[]) {
  return {
    total: users.filter((user) => !user.pendingRegistration).length,
    active: users.filter((user) => user.accountStatus === 'ACTIVE').length,
    suspended: users.filter((user) => user.accountStatus === 'SUSPENDED').length,
  }
}
