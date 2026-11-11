import { describe, expect, it } from 'vitest'
import { displayRoleFromEmail, mergeSsoProfile, sessionStartedAt } from './account-display'

describe('account display', () => {
  it('counts only characters after the last dot before @', () => {
    expect(displayRoleFromEmail('xxx.xx@northbkk.ac.th')).toBe('อาจารย์')
    expect(displayRoleFromEmail('xxx.student@northbkk.ac.th')).toBe('นักศึกษา')
    expect(displayRoleFromEmail('xxx@northbkk.ac.th')).toBe('นักศึกษา')
  })

  it('uses issued-at time for the eight-hour session window', () => {
    expect(sessionStartedAt({ iat: 1_700_000_000 })).toBe(1_700_000_000_000)
  })

  it('uses the full name and valid picture returned by Google SSO', () => {
    expect(mergeSsoProfile({fullName:'student@northbkk.ac.th'}, {full_name:'สุฟียาน ตาเละห์',picture:'https://lh3.googleusercontent.com/avatar'})).toEqual({fullName:'สุฟียาน ตาเละห์',givenName:'สุฟียาน',avatarUrl:'https://lh3.googleusercontent.com/avatar'})
    expect(mergeSsoProfile({fullName:'เดิม'}, {name:'ชื่อจาก Google',avatar_url:'not-a-url'})).toEqual({fullName:'ชื่อจาก Google',givenName:'ชื่อจาก',avatarUrl:undefined})
  })

  it('keeps the full name but exposes the Google SSO given name for compact UI', () => {
    expect(mergeSsoProfile(
      { fullName: 'ชื่อจากโปรไฟล์', email: 'sufeeyan.tale@northbkk.ac.th' },
      { given_name: 'Sufeeyan', name: 'Sufeeyan Taleh' },
    )).toMatchObject({
      fullName: 'Sufeeyan Taleh',
      givenName: 'Sufeeyan',
    })
  })

  it('falls back to the account email when SSO and profile names are blank', () => {
    expect(mergeSsoProfile(
      { fullName: '   ', email: 'sufeeyan.tale@northbkk.ac.th' },
      { full_name: ' ', name: '' },
    )).toEqual({
      fullName: 'sufeeyan.tale@northbkk.ac.th',
      givenName: 'sufeeyan.tale',
      avatarUrl: undefined,
    })
  })
})
