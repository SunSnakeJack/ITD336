import { Link } from 'react-router-dom'
import { useMergedRoomCatalog } from '../useMergedRoomCatalog'

const items = [
  { href: '/keys', label: 'เลือกห้อง', path: 'M5 20V5h3m9 0h2v15M3 20h5m9 0h4M8 4l9-2v18l-9 2zM14 12h.01' },
  { href: '/account/requests', label: 'การจอง', path: 'M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 14h.01m4 0h.01m4 0h.01M8 17h.01m4 0h.01' },
  { href: '/account/profile', label: 'โปรไฟล์', path: 'M4 21a8 8 0 0 1 16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' },
]

const combinedItems = [
  { ...items[0], label: 'เบิกกุญแจ', path: 'M15 3a5 5 0 0 0-4.8 6.4L3 16.6V21h4v-3h3v-3l3.6-3.6A5 5 0 1 0 15 3ZM16 7h.01' },
  { ...items[1], href: '/meeting-room', label: 'จองห้อง' },
  { ...items[1], label: 'ประวัติ', path: 'M3 12a9 9 0 1 1 3 6.7M3 5v7h7M12 7v5l3 2' },
  items[2],
]

export function PublicBottomNav({ pathname, combined, destination }: { pathname: string; combined: boolean; destination: (root: string) => string }) {
  const mergedCatalog = useMergedRoomCatalog()
  const active = pathname.startsWith('/account/profile') ? '/account/profile'
    : pathname.startsWith('/account/') ? '/account/requests'
    : combined && !mergedCatalog && /^\/meeting-room(?:\/|$)/.test(pathname) ? '/meeting-room'
    : '/keys'
  const links = mergedCatalog ? [combinedItems[0], combinedItems[2], combinedItems[3]] : combined ? combinedItems : items
  const layout = mergedCatalog ? ' public-bottom-nav-merged' : combined ? ' public-bottom-nav-combined' : ''
  return <nav className={`public-bottom-nav${layout}`} aria-label="เมนูหลัก">
    {links.map(({ href, label, path }) => <Link key={href} to={mergedCatalog && href === '/keys' ? href : destination(href)} aria-current={href === active ? 'page' : undefined}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d={path} /></svg>
      {mergedCatalog && href === '/keys' ? 'เบิกกุญแจและจองห้อง' : label}
    </Link>)}
  </nav>
}
