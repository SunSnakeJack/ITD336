export type GmailKeyAction='CANCEL'|'RETURN'
export interface GmailKeyActionPayload{v:1;jti:string;requestId:string;action:GmailKeyAction;recipientDigest:string;exp:number;purpose:'gmail-key-action'}
const encoder=new TextEncoder()
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const decode=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0))
const key=(secret:string,usage:KeyUsage[])=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,usage)
export async function signGmailKeyActionToken(payload:GmailKeyActionPayload,secret:string){
 const body=encode(encoder.encode(JSON.stringify(payload)));const signature=await crypto.subtle.sign('HMAC',await key(secret,['sign']),encoder.encode(body))
 return `${body}.${encode(new Uint8Array(signature))}`
}
export async function verifyGmailKeyActionToken(token:string,secret:string,now:number){
 try{
  const[body,signature,...rest]=token.split('.');if(!body||!signature||rest.length)return null
  if(!await crypto.subtle.verify('HMAC',await key(secret,['verify']),decode(signature),encoder.encode(body)))return null
  const value=JSON.parse(new TextDecoder().decode(decode(body))) as Partial<GmailKeyActionPayload>
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if(value.v!==1||value.purpose!=='gmail-key-action'||!['CANCEL','RETURN'].includes(value.action??'')||!uuid.test(value.jti??'')||!uuid.test(value.requestId??'')||!(/^[a-f0-9]{64}$/i.test(value.recipientDigest??''))||typeof value.exp!=='number'||value.exp<=now||value.exp>now+86400)return null
  return value as GmailKeyActionPayload
 }catch{return null}
}
export async function sha256Hex(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value.trim().toLowerCase())))).map(v=>v.toString(16).padStart(2,'0')).join('')}
