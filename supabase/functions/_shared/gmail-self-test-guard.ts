const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface ScopeInput{deliveryMode?:string;enabled?:string;allowedRecipient?:string;requestIds?:string;expiresAt?:string;now:number}

async function sha256(value:string){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('')
}

export async function createGmailSelfTestScope(input:ScopeInput){
 const recipient=input.allowedRecipient?.trim().toLowerCase()??''
 const requestIds=new Set((input.requestIds??'').split(',').map(value=>value.trim()).filter(Boolean))
 const expiresAt=Number(input.expiresAt)
 if(input.deliveryMode!=='test'||input.enabled!=='true'||!recipient||!requestIds.size||[...requestIds].some(value=>!uuid.test(value))||!Number.isFinite(expiresAt)||expiresAt<=input.now||expiresAt>input.now+3600)return null
 const recipientDigest=await sha256(recipient)
 return{
  expiresAt,
  digestRecipient:(value:string)=>sha256(value.trim().toLowerCase()),
  allows:(requestId:string,digest:string,now=input.now)=>now<expiresAt&&requestIds.has(requestId)&&digest.toLowerCase()===recipientDigest,
 }
}
