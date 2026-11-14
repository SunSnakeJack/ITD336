import{useEffect,useState}from'react'
import{SelectField}from'../../../shared/components/SelectField'
import type{AdminRoomDetail,RoomEditorOptions,SaveRoomInput}from'../room.types'
import defaultRoomImage from '../../../assets/default-room.jpg'
import{roomFormatCode,roomFormatGroup,roomGroupLabels,thaiRoomType}from'../utils/room-type-label'
import'./RoomEditorForm.css'
interface Props{formId?:string;room?:AdminRoomDetail;options:RoomEditorOptions;pending:boolean;error?:string;onCancel:()=>void;onSave:(input:SaveRoomInput)=>void}
const empty={code:'',name:'',roomTypeId:'',building:'',floor:'',locationDescription:'',capacity:1,description:'',bookingEnabled:true,active:true,imageUrl:'',computerType:'',displayType:'',equipment:[]}satisfies Omit<SaveRoomInput,'roomId'>
export function RoomEditorForm({formId,room,options,pending,error,onCancel,onSave}:Props){
 const selectableFormats = options.roomTypes.filter(item => roomFormatCode(item.code || item.name) !== 'COLD')
 const [selectedGroup, setSelectedGroup] = useState<keyof typeof roomGroupLabels | ''>('')
 const[form,setForm]=useState<Omit<SaveRoomInput,'roomId'>>(empty),[validation,setValidation]=useState(''),[preview,setPreview]=useState('')
 useEffect(()=>{if(room)setForm({code:room.code,name:room.name,roomTypeId:room.room_type_id,building:room.building??'',floor:room.floor??'',locationDescription:room.location_description??'',capacity:room.capacity,description:room.description??'',bookingEnabled:room.booking_enabled,active:room.active,imageUrl:room.image_url??'',computerType:room.computer_type??'',displayType:room.display_type??'',equipment:room.equipment});else setForm({...empty,roomTypeId:options.roomTypes.find(item => roomFormatCode(item.code || item.name) !== 'COLD')?.id??''})},[room,options.roomTypes])
 const field=<K extends keyof typeof form>(key:K,value:(typeof form)[K])=>setForm(current=>({...current,[key]:value}))
 const toggleEquipment=(equipmentId:string,checked:boolean)=>field('equipment',checked?[...form.equipment,{equipmentId,quantity:1,notes:null}]:form.equipment.filter(item=>item.equipmentId!==equipmentId))
 const chooseImage=(file:File|null)=>{if(!file){field('imageFile',null);setPreview('');return}if(!file.type.startsWith('image/')||file.size>5*1024*1024){setValidation('กรุณาเลือกไฟล์รูปภาพขนาดไม่เกิน 5 MB');return}field('imageFile',file);setPreview(URL.createObjectURL(file));setValidation('')}
 const submit=(event:React.FormEvent)=>{event.preventDefault();if(!form.code.trim()||!form.name.trim()||!form.roomTypeId||form.capacity<1){setValidation('กรุณากรอกข้อมูลห้องที่จำเป็นให้ครบถ้วน');return}setValidation('');onSave({roomId:room?.id??null,...form,equipment:form.equipment.map(item=>({...item,quantity:1,notes:null}))})}
 const currentFormat = options.roomTypes.find(item => item.id === form.roomTypeId)
 const group = selectedGroup || (currentFormat && roomFormatGroup(currentFormat.code || currentFormat.name)) || ''
 const shownFormats = selectableFormats.filter(item => !group || roomFormatGroup(item.code || item.name) === group || item.id === form.roomTypeId)
 if (currentFormat && !shownFormats.some(item => item.id === currentFormat.id)) shownFormats.push(currentFormat)
 return <form id={formId} className="room-editor-form" onSubmit={submit}>
  <section className="room-editor-switches"><Toggle label="เปิดให้จอง" checked={form.bookingEnabled} onChange={checked=>field('bookingEnabled',checked)}/><Toggle label="เปิดใช้งานห้อง" checked={form.active} onChange={checked=>field('active',checked)}/></section>
  <div className="room-editor-column"><section><h3>ข้อมูลห้อง</h3><div className="room-editor-grid"><label>รหัสห้อง *<input value={form.code} onChange={event=>field('code',event.target.value)}/></label><label>ชื่อสำหรับหน้าจัดการ *<input value={form.name} onChange={event=>field('name',event.target.value)}/></label><SelectField label="กลุ่มห้อง" value={group} placeholder="เลือกกลุ่มห้อง" options={Object.entries(roomGroupLabels).map(([value,label])=>({value:value as keyof typeof roomGroupLabels,label}))} onChange={value=>{
   setSelectedGroup(value)
   if (!currentFormat || roomFormatGroup(currentFormat.code || currentFormat.name) !== value) field('roomTypeId','')
  }}/><SelectField key={group} label="รูปแบบห้อง *" value={form.roomTypeId} placeholder="เลือกรูปแบบห้อง" options={shownFormats.map(item=>({value:item.id,label:thaiRoomType(item.code || item.name)}))} onChange={value=>field('roomTypeId',value)}/><label>ความจุ *<input type="number" min="1" value={form.capacity} onChange={event=>field('capacity',Number(event.target.value))}/></label><label className="wide">คำอธิบายใต้ชื่อห้อง<textarea rows={3} value={form.description} onChange={event=>field('description',event.target.value)}/></label></div></section></div>
  <div className="room-editor-column"><section><h3>อุปกรณ์เพิ่มเติม</h3><div className="room-editor-equipment">{options.equipment.length?options.equipment.map(option=><label key={option.id}><input type="checkbox" checked={form.equipment.some(item=>item.equipmentId===option.id)} onChange={event=>toggleEquipment(option.id,event.target.checked)}/>{option.name}</label>):<p>ยังไม่มีรายการอุปกรณ์ในระบบ</p>}</div></section><section><h3>รูปภาพห้อง</h3><div className="room-editor-image"><img className="room-editor-preview" src={preview||form.imageUrl||defaultRoomImage} alt="ตัวอย่างรูปภาพห้อง"/><label className="room-image-picker">เลือกรูปภาพห้อง<input aria-label="รูปภาพห้อง" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event=>chooseImage(event.target.files?.[0]??null)}/><small>รองรับ JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB</small></label></div></section></div>
  {(validation||error)&&<p className="staff-role-error" role="alert">{validation||error}</p>}{!formId&&<footer><button type="button" disabled={pending} onClick={onCancel}>ยกเลิก</button><button className="staff-button" disabled={pending}>{pending?'กำลังบันทึก…':'บันทึกข้อมูลห้อง'}</button></footer>}
 </form>
}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(checked:boolean)=>void}){return <label className="room-editor-toggle"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span aria-hidden="true"/><b>{label}</b></label>}
