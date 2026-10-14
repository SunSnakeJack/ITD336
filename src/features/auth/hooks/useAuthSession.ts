import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../../../lib/supabase/client'
import { getMyIdentity, signOut } from '../auth.service'
import type { AuthIdentity } from '../auth.types'

interface AuthSessionState {
  identity: AuthIdentity | null
  loading: boolean
  error: string | null
  logout: () => Promise<void>
}

async function resolveIdentity(session: Session | null) {
  return session ? getMyIdentity(session.user.id) : null
}

export function useAuthSession(): AuthSessionState {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return
      try {
        if (sessionError) throw sessionError
        setIdentity(await resolveIdentity(data.session))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ไม่สามารถตรวจสอบบัญชีได้')
        await signOut()
      } finally {
        if (active) setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void resolveIdentity(session)
          .then((nextIdentity) => {
            if (!active) return
            setIdentity(nextIdentity)
            setError(null)
          })
          .catch(async (caught: unknown) => {
            if (!active) return
            setIdentity(null)
            setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลดบทบาทผู้ใช้ได้')
            await signOut()
          })
          .finally(() => {
            if (active) setLoading(false)
          })
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback(async () => {
    const { error: logoutError } = await signOut()
    if (logoutError) throw new Error(logoutError.message)
    setIdentity(null)
  }, [])

  return { identity, loading, error, logout }
}
