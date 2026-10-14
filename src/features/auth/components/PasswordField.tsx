import { useState } from 'react'

interface PasswordFieldProps {
  value: string
  onChange: (value: string) => void
}

export function PasswordField({ value, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="input-shell">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" /></svg>
      <input
        autoComplete="current-password"
        aria-label="รหัสผ่าน"
        name="password"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Password"
        required
        type={visible ? 'text' : 'password'}
        value={value}
      />
      <button
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        className="visibility-button"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
      </button>
    </div>
  )
}
