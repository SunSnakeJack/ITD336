import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { lecturerLanguageQuery, type LecturerNameLanguage } from '../../keys/lecturer-display.queries'
import { refreshLecturerOptions, setLecturerNameLanguage } from '../staff-lecturer-names'
import { StaffQueryState } from './StaffPage'

export function StaffLecturerLanguageSettings() {
  const query = useQuery(lecturerLanguageQuery())
  const client = useQueryClient()
  const [draft, setDraft] = useState<LecturerNameLanguage>()
  const selection = draft ?? query.data
  const save = useMutation({
    mutationFn: setLecturerNameLanguage,
    onSuccess: async (language) => {
      client.setQueryData(lecturerLanguageQuery().queryKey, language)
      setDraft(undefined)
      await refreshLecturerOptions(client)
    },
  })

  return <StaffQueryState loading={query.isPending} error={query.error}>
    <form className="staff-card grid gap-4 mt-4" onSubmit={event => {
      event.preventDefault()
      if (selection && selection !== query.data) save.mutate(selection)
    }}>
      <fieldset className="grid gap-3" disabled={save.isPending}>
        <legend className="mb-3 font-semibold">ภาษาชื่ออาจารย์</legend>
        {([['th', 'ภาษาไทย'], ['en', 'English']] as const).map(([language, label]) => (
          <label className="flex items-center gap-2" key={language}>
            <input name="lecturer-language" type="radio" checked={selection === language}
              onChange={() => { save.reset(); setDraft(language) }} />
            {label}
          </label>
        ))}
      </fieldset>
      {query.data && <p>ภาษาที่บันทึกไว้ {query.data === 'th' ? 'ภาษาไทย' : 'English'}</p>}
      <p>ใช้กับรายชื่ออาจารย์ในหน้าจัดการผู้ใช้งานและฟอร์มเบิกกุญแจ หากยังไม่มีชื่อในภาษาที่เลือก ระบบจะแสดงชื่อเดิม สามารถเพิ่มชื่อได้จากปุ่ม «แก้ไขชื่ออาจารย์»</p>
      <button className="staff-button justify-self-start" disabled={!selection || selection === query.data || save.isPending}>
        {save.isPending ? 'กำลังบันทึก…' : 'บันทึกภาษาชื่ออาจารย์'}
      </button>
      {save.isError && <p role="alert">{save.error.message}</p>}
      {save.isSuccess && <p role="status">บันทึกภาษาชื่ออาจารย์แล้ว</p>}
    </form>
  </StaffQueryState>
}
