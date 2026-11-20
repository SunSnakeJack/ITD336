import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LecturerCombobox } from './LecturerCombobox'

it('orders Thai names before Latin names, ignoring academic titles when sorting', () => {
  const options = ['Zane', 'อ. สมชาย', 'Alice', 'ดร. กานต์'].map(lecturerName => ({
    id: lecturerName, lecturerName,
  }))
  render(<LecturerCombobox options={options} value="" loading={false} onChange={vi.fn()} />)
  fireEvent.focus(screen.getByRole('combobox'))
  expect(screen.getAllByRole('option').map(option => option.textContent))
    .toEqual(['ดร. กานต์', 'อ. สมชาย', 'Alice', 'Zane'])
})

it('finds an instructor by the other language without changing the displayed name or selected ID', () => {
  const onChange = vi.fn()
  render(<LecturerCombobox options={[{ id: 'teacher-1', lecturerName: 'อ. กานต์', alternateNames: ['Kan Example'] }]}
    value="" loading={false} onChange={onChange} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'example' } })
  fireEvent.click(screen.getByRole('option', { name: 'อ. กานต์' }))
  expect(onChange).toHaveBeenCalledWith('teacher-1')
})
