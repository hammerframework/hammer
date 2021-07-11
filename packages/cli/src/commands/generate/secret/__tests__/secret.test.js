import { generateSecret } from './../secret.js'

describe('generateSecret', () => {
  it('contains only uppercase letters, lowercase letters, and digits', () => {
    const secret = generateSecret()

    expect(secret).toMatch(/^[A-Za-z0-9]{64}$/)
  })

  it('can optionally accept a length', () => {
    const secret = generateSecret(16)

    expect(secret.length).toEqual(16)
  })
})
