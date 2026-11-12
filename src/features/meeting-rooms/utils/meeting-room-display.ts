export function meetingRoomDisplayName(room: { code: string; name: string }) {
  return room.name && room.name !== room.code && room.name.toUpperCase() !== 'MEETING-ROOM'
    ? room.name
    : 'ห้องประชุมคณะ IT'
}
