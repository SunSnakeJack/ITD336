import { SelectField } from '../../../shared/components/SelectField'

type RequesterType='STUDENT'|'TEACHER'
const OPTIONS:Array<{value:RequesterType;label:string}>=[{value:'STUDENT',label:'นักศึกษา'},{value:'TEACHER',label:'อาจารย์'}]

export function RequesterStatusSelect({value,onChange}:{value:RequesterType;onChange:(value:RequesterType)=>void}){
  return <SelectField label="สถานะ" value={value} placeholder="กรุณาเลือกสถานะ" options={OPTIONS} onChange={onChange}/>
}
