const labels:Record<string,string>={CLASSROOM:'ห้องเรียน',COLD_ROOM:'ห้องควบคุมอุณหภูมิ',COMPUTER_ROOM:'ห้องปฏิบัติการคอมพิวเตอร์',E_LEARNING_ROOM:'ห้องอีเลิร์นนิง',GAMING_ROOM:'ห้องอีสปอร์ต',MEETING_ROOM:'ห้องประชุม',STUDIO_ROOM:'ห้องสตูดิโอ'}
export function thaiRoomType(codeOrName:string){const key=codeOrName.trim().toUpperCase().replace(/[\s-]+/g,'_');return labels[key]??codeOrName}
