import { supabase } from '../../lib/supabase/client'

export type KeyRequestEmailAction='TRACK'|'CANCEL'|'RETURN'
export interface KeyRequestActionResult{ok:boolean;code?:string;message?:string;requestCode?:string;status?:string;room?:string;startsAt?:string;endsAt?:string}

export async function executeKeyRequestEmailAction(action:KeyRequestEmailAction,token:string,preview=false):Promise<KeyRequestActionResult>{
  const{data,error}=await supabase.functions.invoke('key-request-action',{body:preview?{action,token,preview:true}:{action,token}})
  if(error)throw new Error('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง')
  return data as KeyRequestActionResult
}
