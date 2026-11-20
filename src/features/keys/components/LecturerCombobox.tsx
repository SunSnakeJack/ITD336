import { useId, useMemo, useState } from 'react'
import type { KeyRequestReferenceOption } from '../key.types'

interface Props {
  options: KeyRequestReferenceOption[]
  value: string
  onChange: (value: string) => void
  loading: boolean
  error?: string
}

const thaiCollator = new Intl.Collator('th')
const latinCollator = new Intl.Collator('en', { sensitivity: 'base' })
const thaiInitial = /^\p{Script=Thai}/u
const titlePrefix = /^(?:(?:ศ|รศ|ผศ|อ|ดร)\.\s*)+/u

function compareLecturerNames(a: KeyRequestReferenceOption, b: KeyRequestReferenceOption) {
  const left = a.lecturerName.trim().replace(titlePrefix, '')
  const right = b.lecturerName.trim().replace(titlePrefix, '')
  const leftIsThai = thaiInitial.test(left)
  const rightIsThai = thaiInitial.test(right)
  if (leftIsThai !== rightIsThai) return leftIsThai ? -1 : 1
  return (leftIsThai ? thaiCollator : latinCollator).compare(left, right)
}

export function LecturerCombobox({ options, value, onChange, loading, error }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(-1)
  const selected = options.find(option => option.id === value)
  const normalize = (name: string) => name.normalize('NFC').toLowerCase().trim()
  const orderedOptions = useMemo(() => [...options].sort(compareLecturerNames), [options])
  const search = normalize(query)
  const matches = orderedOptions.filter(option => [option.lecturerName, ...(option.alternateNames ?? [])]
    .some(name => normalize(name).includes(search)))
  const active = open ? matches[index] : undefined
  const close = () => { setOpen(false); setQuery(''); setIndex(-1) }
  const choose = (option: KeyRequestReferenceOption) => {
    onChange(option.id)
    close()
  }

  return (
    <div className="app-select-field lecturer-combobox">
      <label className="app-select-label" htmlFor={id}>อาจารย์ผู้สอน</label>
      <input
        id={id}
        className="app-select-trigger"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? id + '-list' : undefined}
        aria-activedescendant={active ? id + '-' + active.id : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        placeholder={loading ? 'กำลังโหลดรายชื่ออาจารย์…' : 'ค้นหาชื่ออาจารย์ผู้สอน'}
        value={open ? query : selected?.lecturerName ?? ''}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={close}
        onChange={event => { setQuery(event.target.value); setIndex(-1); setOpen(true) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            close()
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            const next = event.key === 'ArrowDown' ? Math.min(index + 1, matches.length - 1) : Math.max(index - 1, 0)
            setIndex(index < 0 && event.key === 'ArrowUp' ? matches.length - 1 : next)
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (active) choose(active)
          }
        }}
      />
      {open && (
        <div className="app-select-options placement-bottom">
          <div id={id + '-list'} role="listbox" aria-label="รายชื่ออาจารย์ผู้สอน" aria-busy={loading}>
            {matches.map(option => (
              <button type="button" key={option.id} id={id + '-' + option.id} role="option"
                tabIndex={-1} aria-selected={option.id === value}
                data-highlighted={option.id === active?.id}
                ref={node => { if (node && option.id === active?.id) node.scrollIntoView?.({ block: 'nearest' }) }}
                onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
                {option.lecturerName}
              </button>
            ))}
          </div>
          {!loading && !error && !matches.length && <small role="status">ไม่พบรายชื่ออาจารย์</small>}
        </div>
      )}
      {error && <small id={id + '-error'} role="alert">{error}</small>}
    </div>
  )
}
