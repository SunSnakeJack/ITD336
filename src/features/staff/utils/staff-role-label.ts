import { ROLE_LABELS } from '../../auth/auth.types'

export function staffRoleThaiLabel(code: string): string | undefined {
  return Object.hasOwn(ROLE_LABELS, code) ? ROLE_LABELS[code as keyof typeof ROLE_LABELS] : undefined
}
