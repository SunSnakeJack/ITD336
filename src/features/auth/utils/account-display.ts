export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000

export function displayRoleFromEmail(email: string) {
  const localPart = email.split('@', 1)[0] ?? ''
  const dot = localPart.lastIndexOf('.')
  if (dot < 0) return 'นักศึกษา'
  const suffixLength = localPart.slice(dot + 1).length
  return suffixLength > 0 && suffixLength <= 2 ? 'อาจารย์' : 'นักศึกษา'
}

export function sessionStartedAt(claims: { iat?: number }) {
  return typeof claims.iat === 'number' ? claims.iat * 1000 : Date.now()
}

export function compactAccountName(fullName:string,email:string){
  const normalizedName=fullName.trim()
  if(normalizedName&&normalizedName!==email.trim())return normalizedName.split(/\s+/)[0]
  return email.trim().split('@',1)[0]||'ผู้ใช้งาน'
}

export function mergeSsoProfile(current:{fullName:string;email?:string},metadata:Record<string,unknown>){
  const ssoName=[metadata.full_name,metadata.name].find((value)=>typeof value==='string'&&value.trim())
  const ssoGivenName=typeof metadata.given_name==='string'?metadata.given_name.trim():''
  const rawAvatar=[metadata.avatar_url,metadata.picture].find((value)=>typeof value==='string'&&value.trim())
  const profileName=current.fullName.trim()
  const fallbackName=current.email?.trim()||'ผู้ใช้งาน'
  const fullName=typeof ssoName==='string'?ssoName.trim():profileName||fallbackName
  const givenName=ssoGivenName||compactAccountName(fullName,current.email??'')
  let avatarUrl:string|undefined
  if(typeof rawAvatar==='string')try{const url=new URL(rawAvatar);if(['https:','http:'].includes(url.protocol))avatarUrl=url.toString()}catch{avatarUrl=undefined}
  return{fullName,givenName,avatarUrl}
}
