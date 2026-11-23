const paths = {
  dashboard: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M2 11h20 M11 11v9',
  users: 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M16 21H2v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5z M18 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M18 14h.5a3.5 3.5 0 0 1 3.5 3.5V19h-3',
  rooms: 'M2 21h20 M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16 M8 7h.01 M12 7h.01 M16 7h.01 M8 11h.01 M12 11h.01 M16 11h.01 M10 21v-4a2 2 0 0 1 4 0v4',
  person: 'M5 20v-2a7 7 0 0 1 14 0v2H5Zm11-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  monitor: 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M12 17v4 M8 21h8',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
  permissions: 'M12 2 3 6v5c0 5 3.5 8.5 9 11 5.5-2.5 9-6 9-11V6z M8.5 12l2.3 2.3 4.7-4.7',
  gear: 'M10 2h4l.7 2.8 1.6.7 2.5-1.5 2.8 2.8-1.5 2.5.7 1.6 2.2.5v3.2l-2.2.5-.7 1.6 1.5 2.5-2.8 2.8-2.5-1.5-1.6.7-.7 2.8h-4l-.7-2.8-1.6-.7-2.5 1.5-2.8-2.8 1.5-2.5-.7-1.6-2.2-.5v-3.2l2.2-.5.7-1.6-1.5-2.5 2.8-2.8 2.5 1.5 1.6-.7z M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  reports: 'M3 3v18h19 M6.5 17v-4h3v4z M12 17V9h3v8z M17.5 17V5h3v12z',
  logs: 'M8 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3 M8 4h2a2 2 0 0 1 4 0h2v3H8z M7 11h.01 M7 15h.01 M7 19h.01 M10 11h7 M10 15h7 M10 19h7',
  pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v7 M9 15l3 3 3-3',
  print: 'M6 9V3h12v6 M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M6 14h12v7H6z M6 12h.01',
  close: 'M6 6l12 12 M18 6L6 18',
}

export type StaffIconName = keyof typeof paths

export function StaffIcon({ name }: { name: StaffIconName }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} transform={name === 'gear' ? 'translate(1.5 .6) scale(.875)' : undefined} />
  </svg>
}
