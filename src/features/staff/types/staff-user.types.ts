export interface StaffUserDirectoryItem {
  id: string
  fullName: string
  email: string
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  roleCodes: string[]
  roleNames: string[]
}

export interface StaffRoleOption {code:string;name:string}
