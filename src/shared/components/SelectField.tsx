import { useEffect, useId, useRef, useState } from 'react'

export interface SelectFieldOption<T extends string> {
  value: T
  label: string
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T | ''
  placeholder: string
  options: Array<SelectFieldOption<T>>
  onChange: (value: T) => void
  error?: string
}

export function SelectField<T extends string>({
  label,
  value,
  placeholder,
  options,
  onChange,
  error,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const triggerId = useId()
  const listId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  return (
    <div className="app-select-field" ref={root}>
      <label className="app-select-label" htmlFor={triggerId}>{label}</label>
      <button
        id={triggerId}
        type="button"
        className="app-select-trigger"
        aria-label={`${label} ${selected?.label ?? placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={selected ? '' : 'placeholder'}>{selected?.label ?? placeholder}</span>
        <svg className="key-select-arrow" data-direction={open ? 'up' : 'down'} aria-hidden="true" viewBox="0 0 12 8">
          <path d="M1 1.5 6 6.5l5-5" />
        </svg>
      </button>
      {open && (
        <ul className="app-select-options" id={listId} role="listbox" aria-label={`ตัวเลือก${label}`}>
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  )
}
