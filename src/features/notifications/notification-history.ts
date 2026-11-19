import type { Notification } from './notification.types'
import { bangkokClock } from '../keys/utils/key-catalog-time'

export function notificationHistoryPath(item: Notification) {
  const type = item.related_entity_type
  const prefix = item.type.startsWith('BOOKING_') ? 'booking'
    : item.type.startsWith('KEY_REQUEST_') ? 'key_request' : null
  const entity = type ?? prefix
  const params = new URLSearchParams()
  if (entity === 'key_loan' || entity === 'key_request') params.set('tab', 'keys')
  if (type && item.related_entity_id) params.set('item', item.related_entity_id)
  const search = params.size ? `?${params}` : ''
  if (entity === 'booking' || entity === 'key_loan' || entity === 'key_request') return `/account/requests${search}`
}

export function notificationRequestMessage(item: {
  roomName: string; roomCode: string; startsAt: string; endsAt: string; purpose: string
}) {
  return [item.roomName !== '—' && item.roomName || item.roomCode,
    `${bangkokClock(item.startsAt)}–${bangkokClock(item.endsAt)} น.`, item.purpose]
    .filter(value => value.trim() && value !== '—').join(' · ')
}
