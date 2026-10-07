import { supabase, unwrap } from '../../lib/supabase/client'
export interface AuditLog { id:number; actor_id:string|null; action:string; entity_type:string; entity_id:string|null; metadata:Record<string,unknown>; created_at:string }
export const getAuditHistory=(entityType?:string,entityId?:string)=>{
 let query=supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(200)
 if(entityType) query=query.eq('entity_type',entityType)
 if(entityId) query=query.eq('entity_id',entityId)
 return unwrap<AuditLog[]>(query)
}
