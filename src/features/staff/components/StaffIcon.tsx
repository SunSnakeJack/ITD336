const paths = {
  dashboard: 'M3 3h7v8H3z M14 3h7v5h-7z M3 15h7v6H3z M14 12h7v9h-7z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8',
  rooms: 'M3 21h18 M5 21V5h14v16 M9 9h.01 M15 9h.01 M9 13h.01 M15 13h.01 M10 21v-4h4v4',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
  pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v7 M9 15l3 3 3-3',
  print: 'M6 9V3h12v6 M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M6 14h12v7H6z M6 12h.01',
  close: 'M6 6l12 12 M18 6L6 18',
}

export type StaffIconName = keyof typeof paths

export function StaffIcon({ name }: { name: StaffIconName }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>
}
