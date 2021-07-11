import CryptoJS from 'crypto-js'

import * as error from '../errors'
import { getSession, decryptSession, dbAuthSession } from '../shared'

process.env.SESSION_SECRET = 'nREjs1HPS7cFia6tQHK70EWGtfhOgbqJQKsHQz3S'

const encrypt = (data) => {
  return CryptoJS.AES.encrypt(data, process.env.SESSION_SECRET).toString()
}

describe('getSession()', () => {
  it('returns null if no text', () => {
    expect(getSession()).toEqual(null)
  })

  it('returns null if no session cookie', () => {
    expect(getSession('foo=bar')).toEqual(null)
  })

  it('returns the value of the session cookie', () => {
    expect(getSession('session=qwerty')).toEqual('qwerty')
  })

  it('returns the value of the session cookie when there are multiple cookies', () => {
    expect(getSession('foo=bar;session=qwerty')).toEqual('qwerty')
    expect(getSession('session=qwerty;foo=bar')).toEqual('qwerty')
  })

  it('returns the value of the session cookie when there are multiple cookies separated by spaces (iOS Safari)', () => {
    expect(getSession('foo=bar; session=qwerty')).toEqual('qwerty')
    expect(getSession('session=qwerty; foo=bar')).toEqual('qwerty')
  })
})

describe('decryptSession()', () => {
  it('returns an empty array if no session', () => {
    expect(decryptSession()).toEqual([])
  })

  it('returns an empty array if session is empty', () => {
    expect(decryptSession('')).toEqual([])
    expect(decryptSession(' ')).toEqual([])
  })

  it('throws an error if decryption errors out', () => {
    expect(() => decryptSession('session=qwerty')).toThrow(
      error.SessionDecryptionError
    )
  })

  it('returns an array with contents of encrypted cookie parts', () => {
    const first = { foo: 'bar' }
    const second = 'abcd'
    const text = encrypt(JSON.stringify(first) + ';' + second)

    expect(decryptSession(text)).toEqual([first, second])
  })
})

describe('dbAuthSession()', () => {
  it('returns null if no cookies', () => {
    const event = { headers: {} }

    expect(dbAuthSession(event)).toEqual(null)
  })

  it('return session given event', () => {
    const first = { foo: 'bar' }
    const second = 'abcd'
    const text = encrypt(JSON.stringify(first) + ';' + second)
    const event = {
      headers: {
        cookie: `session=${text}`,
      },
    }

    expect(dbAuthSession(event)).toEqual(first)
  })
})
