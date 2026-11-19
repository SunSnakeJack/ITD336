import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keyCatalogDisplayQuery } from '../../keys/key-catalog-display.queries'
import { setKeyCatalogDisplay, type KeyCatalogDisplay } from '../../keys/key-catalog-display.service'
import { StaffPage, StaffQueryState } from '../components/StaffPage'

const options = [
  { value: 'current', label: 'แบบปัจจุบัน' },
  { value: 'key-tags', label: 'แบบป้ายกุญแจ' },
] as const

export function StaffDisplaySettingsPage() {
  const query = useQuery(keyCatalogDisplayQuery())
  const client = useQueryClient()
  const [draft, setDraft] = useState<KeyCatalogDisplay>()
  const selection = draft ?? query.data
  const save = useMutation({
    mutationFn: setKeyCatalogDisplay,
    onSuccess: (mode) => {
      client.setQueryData(keyCatalogDisplayQuery().queryKey, mode)
      setDraft(undefined)
    },
  })

  return <StaffPage eyebrow="Display settings" title="การตั้งค่าการแสดงผล" description="เลือกรูปแบบหน้าเบิกกุญแจที่จะใช้กับผู้เข้าชมทุกคน">
    <StaffQueryState loading={query.isPending} error={query.error}>
      <form className="staff-card grid gap-4" onSubmit={(event) => {
        event.preventDefault()
        if (selection && selection !== query.data) save.mutate(selection)
      }}>
        <fieldset className="grid gap-3" disabled={save.isPending}>
          <legend className="mb-3 font-semibold">รูปแบบหน้าเบิกกุญแจ</legend>
          {options.map(({ value, label }) => <label className="flex items-center gap-2" key={value}>
            <input name="catalog-display" type="radio" checked={selection === value} onChange={() => { save.reset(); setDraft(value) }} />
            {label}
          </label>)}
        </fieldset>
        <button className="staff-button justify-self-start" type="submit" disabled={!selection || selection === query.data || save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
        </button>
        {save.isError && <p role="alert">บันทึกการตั้งค่าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์แล้วลองใหม่</p>}
        {save.isSuccess && <p role="status">บันทึกการตั้งค่าแล้ว</p>}
      </form>
    </StaffQueryState>
  </StaffPage>
}
