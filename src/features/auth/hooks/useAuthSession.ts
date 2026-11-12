import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../../../lib/supabase/client'
import { getMyIdentity, signOut } from '../auth.service'
import type { AuthIdentity } from '../auth.types'
import { mergeSsoProfile, SESSION_MAX_AGE_MS, sessionStartedAt } from '../utils/account-display'

interface AuthSessionState {
  identity: AuthIdentity | null
  loading: boolean
  error: string | null
  logout: () => Promise<void>
}

async function resolveIdentity(session: Session | null) {
  if(!session)return null
  const identity=await getMyIdentity(session.user.id)
  return {...identity,...mergeSsoProfile(identity,session.user.user_metadata)}
}

export function useAuthSession(): AuthSessionState {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let expiryTimer=0

    const enforceSessionLimit=(session:Session|null)=>{
      window.clearTimeout(expiryTimer)
      if(!session){Object.keys(window.localStorage).filter((key)=>key.startsWith('itd336-session-start:')).forEach((key)=>window.localStorage.removeItem(key));return}
      const key=`itd336-session-start:${session.user.id}`
      const stored=Number(window.localStorage.getItem(key))
      const started=Number.isFinite(stored)&&stored>0?stored:sessionStartedAt(JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))))
      window.localStorage.setItem(key,String(started))
      const remaining=started+SESSION_MAX_AGE_MS-Date.now()
      const expire=()=>{window.localStorage.removeItem(key);void signOut()}
      if(remaining<=0){expire();return}
      expiryTimer=window.setTimeout(expire,remaining)
    }

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return
      try {
        if (sessionError) throw sessionError
        enforceSessionLimit(data.session)
        setIdentity(await resolveIdentity(data.session))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ไม่สามารถตรวจสอบบัญชีได้')
        await signOut()
      } finally {
        if (active) setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      enforceSessionLimit(session)
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

    let identityChannel:ReturnType<typeof supabase.channel>|null=null
    void supabase.auth.getSession().then(({data})=>{
      const userId=data.session?.user.id
      if(!active||!userId)return
      identityChannel=supabase.channel(`identity:${userId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:`id=eq.${userId}`},()=>{
        void resolveIdentity(data.session).then((nextIdentity)=>{if(active)setIdentity(nextIdentity)}).catch(()=>undefined)
      }).subscribe()
    })

    return () => {
      active = false
      window.clearTimeout(expiryTimer)
      listener.subscription.unsubscribe()
      if(identityChannel)void supabase.removeChannel(identityChannel)
    }
  }, [])

  const logout = useCallback(async () => {
    Object.keys(window.localStorage).filter((key)=>key.startsWith('itd336-session-start:')).forEach((key)=>window.localStorage.removeItem(key))
    const { error: logoutError } = await signOut()
    if (logoutError) throw new Error(logoutError.message)
    setIdentity(null)
  }, [])

  return { identity, loading, error, logout }
}
