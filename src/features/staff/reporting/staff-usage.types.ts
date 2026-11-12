export type UsageCategory='MEETING'|'GENERAL_LAB'|'SPECIAL_LAB'
export interface StaffUsageRow{transactionId:string;source:string;roomId:string;roomCode:string;roomName:string;roomCategory:UsageCategory;purpose:string;userName:string;startsAt:string;endsAt:string;returnedAt:string|null;status:string}
