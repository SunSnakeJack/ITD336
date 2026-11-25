const beforeStartTemplates = new Set(['key-request-submitted', 'key-request-approved', 'key-request-starting-soon'])
const returnTemplates = new Set(['key-request-ending-soon', 'key-request-ended', 'key-request-overdue'])

export function keyRequestEmailActions(template: string, status: string, startsAt: string, now: number) {
  const start = Date.parse(startsAt)
  const updated = template === 'key-request-updated'
  const awaitingStart = start > now && ['PENDING_APPROVAL', 'APPROVED'].includes(status)

  return {
    cancel: awaitingStart && beforeStartTemplates.has(template),
    edit: awaitingStart && (beforeStartTemplates.has(template) || updated),
    returnKey: start <= now && ['APPROVED', 'IN_USE'].includes(status) && (returnTemplates.has(template) || updated),
  }
}
