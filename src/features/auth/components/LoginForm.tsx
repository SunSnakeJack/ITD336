import { type FormEvent, useState } from 'react'

import { setSessionPersistence } from '../../../lib/supabase/client'
import { signInWithPassword } from '../auth.service'
import { LoginBrand } from './LoginBrand'
import { PasswordField } from './PasswordField'

export function LoginForm({ embedded=false, onClose, onSuccess }: { embedded?:boolean;onClose?:()=>void;onSuccess?:()=>void }={}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      setSessionPersistence(remember)
      const { error: signInError } = await signInWithPassword(email.trim(), password)
      if (signInError) throw signInError
      onSuccess?.()
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const card = <section aria-labelledby="login-heading" className={`login-card${embedded?' login-card-embedded':''}`}>
        {embedded&&<button className="login-modal-close" aria-label="ปิดหน้าต่างเข้าสู่ระบบ" onClick={onClose} type="button">×</button>}
        <LoginBrand />
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-shell">
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            <input
              autoComplete="email"
              aria-label="อีเมล"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              type="email"
              value={email}
            />
          </div>
          <PasswordField onChange={setPassword} value={password} />
          <div className="login-options">
            <label className="remember-option">
              <input
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                type="checkbox"
              />
              <span>Remember Me</span>
            </label>
            <span aria-disabled="true" className="disabled-link">Forgot Password</span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="login-button" disabled={submitting} type="submit">
            {submitting ? 'กำลังเข้าสู่ระบบ…' : 'Log In'}
          </button>
        </form>
        <div className="or-divider"><span>OR</span></div>
        <button className="google-button" disabled type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path fill="#4285f4" d="M21.6 12.23c0-.72-.06-1.41-.19-2.08H12v3.93h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.89-1.74 2.98-4.3 2.98-7.42Z" />
            <path fill="#34a853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.63A10 10 0 0 0 12 22Z" />
            <path fill="#fbbc05" d="M6.4 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.32-1.86V7.51H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.49l3.34-2.63Z" />
            <path fill="#ea4335" d="M12 6.02c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.51l3.34 2.63C7.19 7.78 9.4 6.02 12 6.02Z" />
          </svg>
          <span>Login with Google</span>
        </button>
        <p className="signup-copy">Don't have an account? <span aria-disabled="true">Sign up</span></p>
        <footer aria-label="ตราสัญลักษณ์มหาวิทยาลัยและคณะ" className="login-footer">
          <a
            aria-label="ไปยังเว็บไซต์มหาวิทยาลัยนอร์ทกรุงเทพ (เปิดในแท็บใหม่)"
            className="nbu-logo-link"
            href="https://nbu-mockup.vercel.app/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <img className="nbu-footer-logo" src="/images/nbu-logo-white.png" alt="มหาวิทยาลัยนอร์ทกรุงเทพ" />
          </a>
          <span aria-hidden="true" className="footer-separator" />
          <img className="faculty-footer-logo" src="/images/faculty-logo-placeholder.png" alt="โลโก้ชั่วคราวคณะเทคโนโลยีสารสนเทศและนวัตกรรมดิจิทัล" />
        </footer>
      </section>
  return embedded?<div className="login-modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose?.()}}>{card}</div>:<main className="login-page">{card}</main>
}
