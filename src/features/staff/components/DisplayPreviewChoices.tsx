import type { ReactNode } from 'react'

type Choice<T extends string> = { value: T; label: string; preview: ReactNode }

export function DisplayPreviewChoices<T extends string>({ title, name, options, selected, onChange }: {
  title: string; name: string; options: readonly Choice<T>[]; selected: T | undefined; onChange: (value: T) => void
}) {
  return <fieldset className="staff-display-group">
    <legend>{title}</legend>
    <div className="staff-display-options">
      {options.map(({ value, label, preview }) => <label className="staff-display-option" key={value}>
        <span className="staff-display-preview" aria-hidden="true">{preview}</span>
        <span className="staff-display-label"><input type="radio" name={name} checked={selected === value}
          onChange={() => onChange(value)} />{label}</span>
      </label>)}
    </div>
  </fieldset>
}

export function CatalogPreview({ mode }: { mode: 'current' | 'current-no-history' | 'key-tags' }) {
  if (mode === 'key-tags') return <span className="staff-preview-tags">
    <span>กุญแจ <strong>S2407</strong></span><span>กุญแจ <strong>Studio</strong></span>
  </span>
  return <span className="staff-preview-room">
    <strong>ห้อง S2407</strong><span>ช่วงเวลาที่เบิกได้ 09:00–11:00</span>
    {mode === 'current' && <small>รายการเบิกล่าสุด · 08:30–09:00</small>}
  </span>
}

export function NavigationPreview({ mode }: { mode: 'top' | 'bottom' | 'both' }) {
  return <span className="staff-preview-screen">
    <span className="staff-preview-bar" data-visible={mode !== 'bottom'}>ITD336</span>
    <span className="staff-preview-screen-body"><span /><span /></span>
    <span className="staff-preview-bar" data-visible={mode !== 'top'}>เบิกกุญแจ · จองห้อง · ประวัติ</span>
  </span>
}
