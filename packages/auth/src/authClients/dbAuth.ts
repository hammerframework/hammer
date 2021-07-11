import { AuthClient } from './index'

export interface LoginAttributes {
  username: string
  password: string
}

export type SignupAttributes = Record<string, unknown> & LoginAttributes

export type DbAuth = () => null

export const dbAuth = (): AuthClient => {
  const getToken = async () => {
    const response = await fetch(
      `${global.__REDWOOD__API_PROXY_PATH}/auth?method=getToken`
    )
    const token = await response.text()
    return token
  }

  const login = async (attributes: LoginAttributes) => {
    const { username, password } = attributes
    const response = await fetch(`${global.__REDWOOD__API_PROXY_PATH}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, method: 'login' }),
    })
    return await response.json()
  }

  const logout = async () => {
    await fetch(`${global.__REDWOOD__API_PROXY_PATH}/auth`, {
      method: 'POST',
      body: JSON.stringify({ method: 'logout' }),
    })
    return true
  }

  const signup = async (attributes: SignupAttributes) => {
    const response = await fetch(`${global.__REDWOOD__API_PROXY_PATH}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...attributes, method: 'signup' }),
    })
    return await response.json()
  }

  return {
    type: 'dbAuth',
    client: () => null,
    login,
    logout,
    signup,
    getToken,
    getUserMetadata: getToken,
  }
}
