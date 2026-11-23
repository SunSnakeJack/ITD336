import { readTabState, writeTabState } from '../../../shared/components/useTabDraft'

export type MeetingDetailSelection = {
  start: string | null
  end: string | null
  scheduleView: 'daily' | 'weekly'
}

export const meetingDetailSelectionKey = (scope: string, roomId: string, date: string) =>
  `meeting-detail:${scope}:${roomId}:${date}`

export function clearMeetingDetailTimes(scope: string, roomId: string, date: string) {
  const key = meetingDetailSelectionKey(scope, roomId, date)
  const selection = readTabState<MeetingDetailSelection>(key)
  if (selection) writeTabState(key, { ...selection, start: null, end: null })
}
