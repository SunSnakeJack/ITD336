interface StaffUserIdentity {
  id: string
  firstName?: string
  lastName?: string
  fullName: string
  email: string
  roleCodes: string[]
  roleNames: string[]
}

export interface StaffRegisteredUser extends StaffUserIdentity {
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  pendingRegistration?: false
}

export type StaffUserDirectoryItem = StaffRegisteredUser | (StaffUserIdentity & {
  accountStatus: null
  pendingRegistration: true
})

export interface StaffRoleOption {code:string;name:string}
