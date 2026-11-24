import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import type { AuthIdentity } from './auth.types'

export const viewerPermissionsKey = ['viewer-permissions'] as const
export const guestGeneralKey = ['guest-general-key'] as const

export function viewerPermissionsQuery(identity: AuthIdentity | null) {
  return queryOptions({
    queryKey: [...viewerPermissionsKey, identity?.userId ?? 'guest'],
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('get_viewer_permissions' as never)
      const permissions: unknown = data
      if (error || !Array.isArray(permissions) || !permissions.every((code: unknown) => typeof code === 'string')) {
        throw new Error('ไม่สามารถตรวจสอบสิทธิ์ได้', { cause: error })
      }
      return permissions
    },
  })
}

export function useViewerPermissions(identity: AuthIdentity | null) {
  return useQuery(viewerPermissionsQuery(identity))
}

export function hasViewerPermission(permissions: readonly string[] | undefined, code: string) {
  return permissions?.includes(code) === true
}

export const keyRequestPermission = (special: boolean | undefined) => special ? 'KEY_REQUEST_SPECIAL' : 'KEY_REQUEST_GENERAL'
