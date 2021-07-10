import type { Magic, MagicUserMetadata } from 'magic-sdk'

import type { AuthClient } from './'

export type MagicLink = Magic
export type MagicUser = MagicUserMetadata
export interface AuthClientMagicLink extends AuthClient {
  login(options: { email: string }): Promise<any>
}

export const magicLink = (client: MagicLink): AuthClientMagicLink => {
  let token: string | null
  let expireTime = 0
  return {
    type: 'magicLink',
    client,
    login: async ({ email }) =>
      await client.auth.loginWithMagicLink({ email }),
    logout: async () => {
      await client.user.logout()
    },
    signup: async ({ email }) =>
      await client.auth.loginWithMagicLink({ email }),
    getToken: async () => {
      if (!token || Date.now() <= expireTime) {
        expireTime = Date.now() + 600 // now + 10 min
        return (token = await client.user.getIdToken())
      } else {
        return token
      }
    },
    getUserMetadata: async () =>
      (await client.user.isLoggedIn()) ? await client.user.getMetadata() : null,
  }
}
