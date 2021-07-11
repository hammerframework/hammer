import type { APIGatewayProxyEvent } from 'aws-lambda'
import CryptoJS from 'crypto-js'

import * as DbAuthError from './errors'

// decrypts the session cookie and returns an array: [data, csrf]
export const decryptSession = (text: string | null) => {
  if (!text || text.trim() === '') {
    return []
  }

  try {
    const decoded = CryptoJS.AES.decrypt(
      text,
      process.env.SESSION_SECRET as string
    ).toString(CryptoJS.enc.Utf8)
    const [data, csrf] = decoded.split(';')
    const json = JSON.parse(data)

    return [json, csrf]
  } catch (e) {
    throw new DbAuthError.SessionDecryptionError()
  }
}

// returns the actual value of the session cookie
export const getSession = (text?: string) => {
  if (typeof text === 'undefined') {
    return null
  }

  const cookies = text.split(';')
  const sessionCookie = cookies.find((cook) => {
    return cook.split('=')[0].trim() === 'session'
  })

  if (!sessionCookie || sessionCookie === 'session=') {
    return null
  }

  return sessionCookie.split('=')[1].trim()
}

// Convenience function to get session, decrypt, and return session data all
// at once. Accepts the `event` argument from a Lambda function call.
export const dbAuthSession = (event: APIGatewayProxyEvent) => {
  if (event.headers.cookie) {
    const [session, _csrfToken] = decryptSession(
      getSession(event.headers.cookie)
    )
    return session
  } else {
    return null
  }
}
