import './RoomScheduleGrid.css'

type SlotState = 'free' | 'elapsed' | 'occupied' | 'closed' | 'selected'
export type RoomScheduleSlot = { state: SlotState; label: string; disabled: boolean }

export function RoomScheduleGrid({ times, getSlot, onSelect, occupiedLabel = 'มีผู้ใช้' }: {
  times: string[]; getSlot: (time: string) => RoomScheduleSlot; onSelect: (time: string) => void; occupiedLabel?: string
}) {
  return <>
    <div className="key-slot-legend key-schedule-legend" aria-label="สถานะช่วงเวลา">
      <span data-state="free"><i />ว่าง</span>
      <span data-state="elapsed"><i />ผ่านแล้ว</span>
      <span data-state="occupied"><i />{occupiedLabel}</span>
      <span data-state="selected"><i />เลือกแล้ว</span>
    </div>
    <div className="key-slot-grid key-schedule-grid">
      {times.map(time => {
        const { state, label, disabled } = getSlot(time)
        return <button key={time} type="button" aria-label={`${time} ${label}`} aria-disabled={disabled}
          className={disabled ? 'unavailable' : state === 'selected' ? 'selected' : undefined}
          data-state={state} onClick={() => onSelect(time)}>
          <strong>{time}</strong><small>{label}</small>
        </button>
      })}
    </div>
  </>
}
