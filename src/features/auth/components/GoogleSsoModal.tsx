import { signInWithGoogle } from '../auth.service'
import { createPortal } from 'react-dom'

export function GoogleSsoModal({ returnTo, onClose }: { returnTo: string; onClose: () => void }) {
  return createPortal(<div className="key-login-overlay" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="key-login-title">
      <header><strong>IT KeySpace</strong><button type="button" aria-label="ปิด" onClick={onClose}>×</button></header>
      <h2 id="key-login-title">กรุณาเข้าสู่ระบบ</h2>
      <button className="google-sso-button" type="button" onClick={() => void signInWithGoogle(returnTo)}>
        <svg className="google-logo" aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#fbbc05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z"/><path fill="#ea4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z"/></svg>
        <span>เข้าสู่ระบบด้วย Google<br/><b>@northbkk.ac.th</b></span>
      </button>
      <button className="key-login-cancel" type="button" onClick={onClose}>ยกเลิก</button>
    </div>
  </div>, document.body)
}
