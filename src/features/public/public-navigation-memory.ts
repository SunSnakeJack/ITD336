import { readTabState, writeTabState } from '../../shared/components/useTabDraft'

export function publicMenuRoot(pathname: string) {
  if (/^\/keys(?:\/|$)/.test(pathname)) return '/keys'
  if (/^\/meeting-room(?:\/|$)/.test(pathname)) return '/meeting-room'
  if (pathname === '/account/profile') return '/account/profile'
  if (/^\/account\/(requests|history)$/.test(pathname)) return '/account/requests'
  return undefined
}

export function rememberPublicMenu(scope: string, root: string, path: string) {
  writeTabState(`menu:${scope}:${root}`, path)
}

export function rememberedPublicMenu(scope: string, root: string) {
  const path = readTabState<string>(`menu:${scope}:${root}`)
  return typeof path === 'string' && publicMenuRoot(path.split(/[?#]/, 1)[0]) === root ? path : root
}
