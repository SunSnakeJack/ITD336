export interface Room { id:string; code:string; name:string; room_type_id:string; building:string|null; floor:string|null; location_description:string|null; capacity:number; description:string|null; booking_enabled:boolean; active:boolean; image_url?:string|null;computer_type?:string|null;display_type?:string|null;created_at:string; updated_at:string }
export interface AvailabilityConflict { available:boolean; conflict_type:string|null; conflict_id:string|null; conflict_description:string|null }
export interface RoomEditorOption{id:string;code:string;name:string}
export interface RoomEquipmentItem{equipmentId:string;name?:string;quantity:number;notes:string|null}
export interface AdminRoomDetail extends Room{room_type_name:string;equipment:RoomEquipmentItem[]}
export interface RoomEditorOptions{roomTypes:RoomEditorOption[];equipment:RoomEditorOption[]}
export interface SaveRoomInput{roomId:string|null;code:string;name:string;roomTypeId:string;building:string;floor:string;locationDescription:string;capacity:number;description:string;bookingEnabled:boolean;active:boolean;imageUrl:string;imageFile?:File|null;computerType:string;displayType:string;equipment:RoomEquipmentItem[]}
