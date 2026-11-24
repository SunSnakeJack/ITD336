import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useStaffViewState } from '../useStaffViewState'
import { keyCatalogDisplayQuery } from '../../keys/key-catalog-display.queries'
import { setKeyCatalogDisplay, type KeyCatalogDisplay } from '../../keys/key-catalog-display.service'
import { lecturerLanguageQuery, type LecturerNameLanguage } from '../../keys/lecturer-display.queries'
import { refreshLecturerOptions, setLecturerNameLanguage } from '../staff-lecturer-names'
import { setShowElapsedRoomSlots, showElapsedRoomSlotsQuery } from '../../schedules/schedule-display.queries'
import { navigationModes, publicNavigationQuery, saveNavigationMode, type NavigationMode } from '../../public/public-navigation.queries'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import { CatalogPreview, DisplayPreviewChoices, NavigationPreview } from '../components/DisplayPreviewChoices'
import './StaffDisplaySettingsPage.css'

const catalogChoices = [
  { value: 'current', label: 'แบบปัจจุบัน' },
  { value: 'current-no-history', label: 'แบบปัจจุบัน ไม่มีรายการบันทึก' },
  { value: 'key-tags', label: 'แบบป้ายกุญแจ' },
] as const
const languageChoices = [
  { value: 'th', label: 'ภาษาไทย', preview: <strong>อาจารย์ กานต์ ใจดี</strong> },
  { value: 'en', label: 'English', preview: <strong>Karn Jaidee</strong> },
] as const
const navigationChoices = (['top', 'bottom', 'both'] as const).map(value => ({
  value, label: navigationModes[value], preview: <NavigationPreview mode={value} />,
}))
type Draft = { catalog?: KeyCatalogDisplay; language?: LecturerNameLanguage; elapsed?: boolean; navigation?: NavigationMode }

export function StaffDisplaySettingsPage() {
  const catalog = useQuery(keyCatalogDisplayQuery())
  const language = useQuery(lecturerLanguageQuery())
  const elapsed = useQuery(showElapsedRoomSlotsQuery())
  const navigation = useQuery(publicNavigationQuery())
  const client = useQueryClient()
  const [draft, update] = useStaffViewState<Draft>('display-settings', {})
  const patch = (next: Draft) => { save.reset(); update(next) }
  const changes = {
    catalog: draft.catalog !== catalog.data ? draft.catalog : undefined,
    language: draft.language !== language.data ? draft.language : undefined,
    elapsed: draft.elapsed !== elapsed.data ? draft.elapsed : undefined,
    navigation: draft.navigation !== navigation.data ? draft.navigation : undefined,
  }
  const loading = catalog.isPending || language.isPending || elapsed.isPending || navigation.isPending
  const error = catalog.error || language.error || elapsed.error || navigation.error
  const dirty = Object.values(changes).some(value => value !== undefined)
  const save = useMutation({
    mutationFn: async (pending: Draft) => {
      const tasks: { label: string; run: () => Promise<void> }[] = []
      const { catalog, language, elapsed, navigation } = pending
      if (catalog !== undefined) tasks.push({ label: 'รูปแบบหน้าเบิกกุญแจ', run: async () => {
        client.setQueryData(keyCatalogDisplayQuery().queryKey, await setKeyCatalogDisplay(catalog))
        update({ catalog: undefined })
      } })
      if (language !== undefined) tasks.push({ label: 'ภาษาชื่ออาจารย์', run: async () => {
        client.setQueryData(lecturerLanguageQuery().queryKey, await setLecturerNameLanguage(language))
        update({ language: undefined })
        await refreshLecturerOptions(client)
      } })
      if (elapsed !== undefined) tasks.push({ label: 'ตารางการใช้งานห้อง', run: async () => {
        client.setQueryData(showElapsedRoomSlotsQuery().queryKey, await setShowElapsedRoomSlots(elapsed))
        update({ elapsed: undefined })
      } })
      if (navigation !== undefined) tasks.push({ label: 'รูปแบบเมนูนำทาง', run: async () => {
        client.setQueryData(publicNavigationQuery().queryKey, await saveNavigationMode(navigation))
        update({ navigation: undefined })
      } })
      const results = await Promise.allSettled(tasks.map(task => task.run()))
      return results.flatMap((result, index) => result.status === 'rejected' ? [tasks[index].label] : [])
    },
  })

  return <StaffPage eyebrow="" title="การตั้งค่าการแสดงผล" description="กำหนดรูปแบบที่ผู้เข้าชมเห็นเมื่อใช้งานระบบ"
    actions={<button className="staff-button" type="submit" form="staff-display-settings"
      disabled={loading || Boolean(error) || !dirty || save.isPending}>
      {save.isPending ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}
    </button>}>
    <StaffQueryState loading={loading} error={error}>
      <form id="staff-display-settings" onSubmit={event => {
        event.preventDefault()
        if (dirty && !save.isPending) save.mutate(changes)
      }}>
        <fieldset className="staff-display-sections" disabled={save.isPending} aria-label="ตัวเลือกการแสดงผล">
          <DisplayPreviewChoices title="รูปแบบหน้าเบิกกุญแจ" name="catalog-display"
            options={catalogChoices.map(option => ({ ...option, preview: <CatalogPreview mode={option.value} /> }))}
            selected={draft.catalog ?? catalog.data} onChange={catalog => patch({ catalog })} />
          <section className="staff-display-language">
            <DisplayPreviewChoices title="ภาษาชื่ออาจารย์" name="lecturer-language" options={languageChoices}
              selected={draft.language ?? language.data} onChange={language => patch({ language })} />
            <p>ภาษาที่บันทึกไว้ {language.data === 'th' ? 'ภาษาไทย' : 'English'} · หากยังไม่มีชื่อในภาษาที่เลือก ระบบจะแสดงชื่อเดิม</p>
          </section>
          <fieldset className="staff-display-group">
            <legend>ตารางการใช้งานห้อง</legend>
            <label className="staff-display-toggle">
              <span>แสดงเวลาที่ผ่านมาแล้ว</span>
              <span className="staff-setting-switch"><input type="checkbox" role="switch"
                checked={draft.elapsed ?? elapsed.data ?? true} onChange={event => patch({ elapsed: event.target.checked })} />
                <span aria-hidden="true" /></span>
            </label>
          </fieldset>
          <DisplayPreviewChoices title="รูปแบบเมนูนำทาง" name="public-navigation-mode" options={navigationChoices}
            selected={draft.navigation ?? navigation.data} onChange={navigation => patch({ navigation })} />
        </fieldset>
        {save.data?.length ? <p role="alert">บันทึกไม่สำเร็จบางรายการ ({save.data.join(', ')}) กรุณาลองบันทึกอีกครั้ง</p>
          : save.isSuccess && <p role="status">บันทึกการตั้งค่าแล้ว</p>}
      </form>
    </StaffQueryState>
  </StaffPage>
}
