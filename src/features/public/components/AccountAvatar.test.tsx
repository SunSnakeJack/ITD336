import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AuthIdentity } from '../../auth/auth.types'
import { AccountAvatar } from './AccountAvatar'

const identity: AuthIdentity = {
  userId: 'user-1',
  fullName: 'Sufeeyan Taleh',
  email: 'sufeeyan.taleh@northbkk.ac.th',
  role: null,
}

describe('AccountAvatar', () => {
  it('uses the neutral fallback when an authenticated SSO account has no picture', () => {
    render(<AccountAvatar identity={identity} />)

    expect(screen.getByTestId('avatar-fallback')).toHaveClass('guest')
  })

  it('uses the neutral fallback when the SSO picture cannot be loaded', () => {
    render(<AccountAvatar identity={{ ...identity, avatarUrl: 'https://example.test/broken.png' }} />)

    fireEvent.error(screen.getByRole('img', { name: `รูปโปรไฟล์ของ ${identity.fullName}` }))

    expect(screen.getByTestId('avatar-fallback')).toHaveClass('guest')
  })
})
