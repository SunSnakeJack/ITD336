import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App foundation', () => {
  it('identifies the backend foundation without presenting product UI', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Room Booking System Backend Foundation' })).toBeInTheDocument()
  })
})
