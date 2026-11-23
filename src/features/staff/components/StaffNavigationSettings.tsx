import { useStaffViewState } from '../useStaffViewState'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { navigationModes, publicNavigationQuery, saveNavigationMode, type NavigationMode } from '../../public/public-navigation.queries'
import { StaffQueryState } from './StaffPage'

export function StaffNavigationSettings() {
  const options = publicNavigationQuery()
  const setting = useQuery(options)
  const client = useQueryClient()
  const [{ draft }, updateView] = useStaffViewState<{ draft?: NavigationMode }>('display-navigation', {})
  const setDraft = (draft: NavigationMode | undefined) => updateView({ draft })
  const save = useMutation({
    mutationFn: saveNavigationMode,
    onSuccess: mode => { client.setQueryData(options.queryKey, mode); setDraft(undefined) },
  })
  return <section className="staff-card grid gap-3 mt-4">
    <StaffQueryState loading={setting.isPending} error={setting.error}>
      <form className="grid gap-3" onSubmit={event => {
        event.preventDefault()
        if (draft && draft !== setting.data) save.mutate(draft)
      }}>
        <fieldset className="grid gap-2" disabled={save.isPending}>
          <legend className="mb-2 font-semibold">รูปแบบเมนูนำทาง</legend>
          {Object.entries(navigationModes).map(([mode, label]) => <label key={mode} className="flex items-center gap-2">
            <input type="radio" name="public-navigation-mode" checked={(draft ?? setting.data) === mode}
              onChange={() => { save.reset(); setDraft(mode as NavigationMode) }} />
            {label}
          </label>)}
        </fieldset>
        <button type="submit" className="staff-button justify-self-start" disabled={!draft || draft === setting.data || save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึกรูปแบบเมนูนำทาง'}
        </button>
        {save.isError && <p role="alert">{save.error.message}</p>}
        {save.isSuccess && <p role="status">บันทึกรูปแบบเมนูนำทางแล้ว</p>}
      </form>
    </StaffQueryState>
  </section>
}
