import{supabase}from'../../lib/supabase/client'
export async function setOpenSaturday(date: string | null) {
  const { error } = await supabase.rpc('set_open_saturday' as never, { p_date: date } as never)
  if (error) throw new Error(error.message)
}
export async function getKeyRequestTimingSetting(){const{data,error}=await supabase.rpc('get_admin_key_request_timing_setting' as never)as unknown as{data:boolean|null;error:{message:string}|null};if(error)throw new Error(error.message);return data===true}
export async function setKeyRequestTimingSetting(enabled:boolean){const{data,error}=await supabase.rpc('set_admin_key_request_timing_setting' as never,{p_enabled:enabled}as never)as unknown as{data:boolean|null;error:{message:string}|null};if(error)throw new Error(error.message);return data===true}
