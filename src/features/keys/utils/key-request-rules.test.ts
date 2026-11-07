import { describe, expect, it } from 'vitest'
import { validateKeyRequest } from './key-request-rules'

const validRequest = {
  email: 'student@northbkk.ac.th',
  startsAt: '2026-11-09T08:00:00+07:00',
  endsAt: '2026-11-09T18:00:00+07:00',
}

describe('validateKeyRequest', () => {
  it('accepts a university email during service hours', () => {
    expect(validateKeyRequest(validRequest)).toEqual({ valid: true, errors: {} })
  })

  it('rejects addresses outside the exact northbkk.ac.th domain', () => {
    expect(validateKeyRequest({ ...validRequest, email: 'student@northbkk.ac.th.example.com' }).errors.email)
      .toBe('กรุณาใช้อีเมลมหาวิทยาลัย @northbkk.ac.th')
  })

  it('rejects a request on Saturday in Bangkok time', () => {
    const result = validateKeyRequest({
      ...validRequest,
      startsAt: '2026-11-14T10:00:00+07:00',
      endsAt: '2026-11-14T11:00:00+07:00',
    })
    expect(result.errors.date).toBe('ไม่สามารถทำรายการสำหรับวันเสาร์ได้')
  })

  it('rejects a request that starts before 08:00', () => {
    const result = validateKeyRequest({ ...validRequest, startsAt: '2026-11-09T07:59:00+07:00' })
    expect(result.errors.time).toBe('กรุณาเลือกเวลาระหว่าง 08:00–18:00 น.')
  })

  it('rejects a request that ends after 18:00', () => {
    const result = validateKeyRequest({ ...validRequest, endsAt: '2026-11-09T18:01:00+07:00' })
    expect(result.errors.time).toBe('กรุณาเลือกเวลาระหว่าง 08:00–18:00 น.')
  })
})
