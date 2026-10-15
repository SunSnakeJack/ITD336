export interface ExternalBookingInput {
  bookingId?: string
  roomId: string
  date: string
  startTime: string
  endTime: string
  externalName: string
  reason: string
}

export interface ExternalBookingDetail {
  bookingId: string
  externalName: string
  date: string
  startTime: string
  endTime: string
  reason: string
}
