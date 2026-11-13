import type { StaffUserDirectoryItem } from '../types/staff-user.types'

export interface UserDirectoryFilters { search: string; role: string; status: string }

export function filterUserDirectory(users: StaffUserDirectoryItem[], filters: UserDirectoryFilters) {
  const search = filters.search.trim().toLocaleLowerCase('th')
  return users.filter((user) => {
    const matchesSearch = !search || `${user.fullName} ${user.email}`.toLocaleLowerCase('th').includes(search)
    return matchesSearch
      && (filters.role === 'ALL' || user.roleCodes.includes(filters.role))
      && (filters.status === 'ALL' || user.accountStatus === filters.status)
  })
}

export function userDirectoryStats(users: StaffUserDirectoryItem[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.accountStatus === 'ACTIVE').length,
    suspended: users.filter((user) => user.accountStatus === 'SUSPENDED').length,
  }
}
