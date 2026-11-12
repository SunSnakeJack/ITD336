import { useEffect, useState } from 'react'
import type { AuthIdentity } from '../../auth/auth.types'

export const PersonIcon=()=> <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>

export function AccountAvatar({identity}:{identity:AuthIdentity|null}){
  const[broken,setBroken]=useState(false)
  useEffect(()=>setBroken(false),[identity?.avatarUrl])
  if(identity?.avatarUrl&&!broken)return <img className="key-avatar-photo" src={identity.avatarUrl} alt={`รูปโปรไฟล์ของ ${identity.fullName}`} onError={()=>setBroken(true)}/>
  return <span className="key-avatar guest" data-testid={identity?'avatar-fallback':'guest-avatar'} aria-hidden="true"><PersonIcon/></span>
}
